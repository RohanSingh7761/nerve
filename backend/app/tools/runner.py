"""Hardened subprocess tool runner with allowlists, scrubbed environment, and timeouts (§10)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Optional, Protocol

from app.config import get_settings
from app.security.arg_validator import SecurityValidationError, validate_path_within

logger = logging.getLogger("nerve.tools")

ALLOWLISTED_BINARIES = {
    "jadx",
    "jadx.bat",
    "apktool",
    "apktool.bat",
    "aapt2",
    "aapt2.exe",
    "apkid",
    "apkid.exe",
    "yara",
    "yara.exe",
    "strings",
    "python",
    "python.exe",
}


class ToolExecutionResult:
    def __init__(
        self,
        exit_code: int,
        stdout: str,
        stderr: str,
        duration_ms: int,
        cached: bool = False,
    ):
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        self.duration_ms = duration_ms
        self.cached = cached

    @property
    def succeeded(self) -> bool:
        return self.exit_code == 0


class ToolRunner(Protocol):
    async def run(
        self,
        binary: str,
        args: list[str],
        cwd: Optional[Path] = None,
        timeout_s: Optional[int] = None,
        agent_run_id: Optional[uuid.UUID] = None,
    ) -> ToolExecutionResult:
        ...


class LocalSubprocessRunner:
    """Runs allowlisted CLI tools in hardened native subprocesses without containers."""

    def __init__(self):
        settings = get_settings()
        self.timeout_s = settings.tool_timeout_s
        self.max_concurrency = settings.tool_max_concurrency
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._cache: dict[str, ToolExecutionResult] = {}

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.max_concurrency)
        return self._semaphore

    def _build_scrubbed_env(self) -> dict[str, str]:
        """Build an environment that strips out all secrets, database URLs, and API keys."""
        settings = get_settings()
        env: dict[str, str] = {}

        # Allow basic system paths and runtime variables
        for key in ["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP"]:
            if key in os.environ:
                env[key] = os.environ[key]

        # Java home
        if settings.java_home:
            env["JAVA_HOME"] = settings.java_home
        elif "JAVA_HOME" in os.environ:
            env["JAVA_HOME"] = os.environ["JAVA_HOME"]

        # Limit JVM heap size for jadx/apktool
        env["JAVA_OPTS"] = "-Xmx2048m -XX:+UseG1GC"
        env["_JAVA_OPTIONS"] = "-Xmx2048m"

        return env

    def _hash_args(self, binary: str, args: list[str], cwd: Optional[Path]) -> str:
        payload = json.dumps({"bin": binary, "args": args, "cwd": str(cwd) if cwd else ""})
        return hashlib.sha256(payload.encode()).hexdigest()

    async def run(
        self,
        binary: str,
        args: list[str],
        cwd: Optional[Path] = None,
        timeout_s: Optional[int] = None,
        agent_run_id: Optional[uuid.UUID] = None,
    ) -> ToolExecutionResult:
        settings = get_settings()
        bin_base = Path(binary).name.lower()

        # 1. Allowlist check
        if bin_base not in ALLOWLISTED_BINARIES and not any(
            bin_base.startswith(allowed) for allowed in ["jadx", "apktool", "apkid", "yara"]
        ):
            raise SecurityValidationError(f"Binary '{binary}' is not in the allowlist")

        # 2. Fault injection check (NERVE_FAULT=jadx_crash)
        if settings.nerve_fault == "jadx_crash" and "jadx" in bin_base:
            logger.info("Fault injection: simulating crash in jadx")
            return ToolExecutionResult(
                exit_code=137,
                stdout="",
                stderr="Fault injection: Simulated jadx process crash (SIGSEGV / OOM)",
                duration_ms=50,
            )

        # 3. Check tool output cache
        args_hash = self._hash_args(binary, args, cwd)
        if args_hash in self._cache:
            cached_res = self._cache[args_hash]
            return ToolExecutionResult(
                exit_code=cached_res.exit_code,
                stdout=cached_res.stdout,
                stderr=cached_res.stderr,
                duration_ms=0,
                cached=True,
            )

        timeout = timeout_s or self.timeout_s
        clean_env = self._build_scrubbed_env()
        sem = self._get_semaphore()

        # Locate executable
        resolved_bin = shutil.which(binary) or binary

        async with sem:
            t0 = time.time()
            try:
                proc = await asyncio.create_subprocess_exec(
                    resolved_bin,
                    *args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(cwd) if cwd else None,
                    env=clean_env,
                )

                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
                duration_ms = int((time.time() - t0) * 1000)

                # Cap output sizes to 10 MB
                stdout = stdout_bytes[: 10 * 1024 * 1024].decode("utf-8", errors="replace")
                stderr = stderr_bytes[: 10 * 1024 * 1024].decode("utf-8", errors="replace")

                result = ToolExecutionResult(
                    exit_code=proc.returncode or 0,
                    stdout=stdout,
                    stderr=stderr,
                    duration_ms=duration_ms,
                )

                if result.succeeded:
                    self._cache[args_hash] = result

                # Asynchronously log tool call to database
                if agent_run_id:
                    asyncio.create_task(
                        self._log_tool_call(
                            agent_run_id=agent_run_id,
                            tool_name=bin_base,
                            args={"args": args, "cwd": str(cwd) if cwd else ""},
                            args_hash=args_hash,
                            status="succeeded" if result.succeeded else "failed",
                            exit_code=result.exit_code,
                            duration_ms=duration_ms,
                            error=stderr if not result.succeeded else None,
                        )
                    )

                return result

            except asyncio.TimeoutError:
                duration_ms = int((time.time() - t0) * 1000)
                try:
                    proc.kill()
                except Exception:
                    pass

                if agent_run_id:
                    asyncio.create_task(
                        self._log_tool_call(
                            agent_run_id=agent_run_id,
                            tool_name=bin_base,
                            args={"args": args},
                            args_hash=args_hash,
                            status="timeout",
                            exit_code=-1,
                            duration_ms=duration_ms,
                            error=f"Tool exceeded timeout of {timeout}s",
                        )
                    )

                return ToolExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Process timed out after {timeout} seconds",
                    duration_ms=duration_ms,
                )

            except Exception as exc:
                duration_ms = int((time.time() - t0) * 1000)
                return ToolExecutionResult(
                    exit_code=1,
                    stdout="",
                    stderr=f"Execution failed: {exc}",
                    duration_ms=duration_ms,
                )

    async def _log_tool_call(
        self,
        agent_run_id: uuid.UUID,
        tool_name: str,
        args: dict[str, Any],
        args_hash: str,
        status: str,
        exit_code: int,
        duration_ms: int,
        error: Optional[str] = None,
    ) -> None:
        try:
            from app.db.models import ToolCall
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as session:
                record = ToolCall(
                    agent_run_id=agent_run_id,
                    tool_name=tool_name,
                    args=args,
                    args_hash=args_hash,
                    status=status,
                    exit_code=exit_code,
                    duration_ms=duration_ms,
                    error=error,
                )
                session.add(record)
                await session.commit()
        except Exception as e:
            logger.warning("Could not log tool call to DB: %s", e)


# Global runner instance
runner = LocalSubprocessRunner()
