"""Jadx decompiler integration (§6.4, §9.1)."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional
import uuid

from app.config import get_settings
from app.tools.runner import runner, ToolExecutionResult

logger = logging.getLogger("nerve.jadx")


async def decompile_apk(
    apk_path: str | Path,
    out_dir: str | Path,
    agent_run_id: Optional[uuid.UUID] = None,
) -> ToolExecutionResult:
    """Run jadx to decompile the APK into Java sources in out_dir."""
    settings = get_settings()
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    args = [
        "-d",
        str(out_dir),
        "--no-res",  # fast decompile of code only
        "--threads-count",
        "2",
        str(apk_path),
    ]

    return await runner.run(
        binary=settings.jadx_bin,
        args=args,
        cwd=out_dir,
        agent_run_id=agent_run_id,
    )


async def decompile_class(
    apk_path: str | Path,
    class_pattern: str,
    out_dir: str | Path,
    agent_run_id: Optional[uuid.UUID] = None,
) -> ToolExecutionResult:
    """Run targeted jadx decompile for a single class or package pattern."""
    settings = get_settings()
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    args = [
        "-d",
        str(out_dir),
        "--include-pkg",
        class_pattern,
        str(apk_path),
    ]

    return await runner.run(
        binary=settings.jadx_bin,
        args=args,
        cwd=out_dir,
        agent_run_id=agent_run_id,
    )


def extract_snippet(
    source_file: str | Path,
    target_symbol: str,
    max_lines: int = 150,
) -> Optional[tuple[str, int, int]]:
    """Extract a method or snippet (up to max_lines) containing target_symbol from a Java file.
    Returns (snippet_content, start_line, end_line) or None.
    """
    path = Path(source_file)
    if not path.is_file():
        return None

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        for idx, line in enumerate(lines):
            if target_symbol in line:
                start = max(0, idx - 15)
                end = min(len(lines), start + max_lines)
                snippet = "".join(lines[start:end])
                return snippet, start + 1, end
    except Exception as e:
        logger.warning("Failed to extract snippet from %s: %s", source_file, e)

    return None
