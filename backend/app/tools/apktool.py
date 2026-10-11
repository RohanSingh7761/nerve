"""Apktool integration for smali disassembly and manifest decoding (§6.4, §9.1)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional
import uuid

from app.config import get_settings
from app.tools.runner import runner, ToolExecutionResult

logger = logging.getLogger("nerve.apktool")


async def disassemble_apk(
    apk_path: str | Path,
    out_dir: str | Path,
    agent_run_id: Optional[uuid.UUID] = None,
) -> ToolExecutionResult:
    """Disassemble an APK to smali code and resources using apktool."""
    settings = get_settings()
    out_dir = Path(out_dir).resolve()

    args = [
        "d",
        "-f",  # force overwrite
        "-o",
        str(out_dir),
        str(apk_path),
    ]

    return await runner.run(
        binary=settings.apktool_bin,
        args=args,
        cwd=out_dir.parent,
        agent_run_id=agent_run_id,
    )


def search_smali(
    smali_dir: str | Path,
    pattern: str,
    max_matches: int = 5,
    max_lines: int = 100,
) -> list[dict[str, Any]]:
    """Search smali files for a specific opcode or method call pattern (e.g. SmsManager, DexClassLoader)."""
    results: list[dict[str, Any]] = []
    root = Path(smali_dir)

    if not root.is_dir():
        return results

    count = 0
    for smali_file in root.rglob("*.smali"):
        try:
            with open(smali_file, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            if pattern in content:
                lines = content.splitlines()
                for idx, line in enumerate(lines):
                    if pattern in line:
                        start = max(0, idx - 10)
                        end = min(len(lines), start + max_lines)
                        snippet = "\n".join(lines[start:end])
                        rel_path = smali_file.relative_to(root)
                        results.append(
                            {
                                "file": str(rel_path),
                                "line": idx + 1,
                                "snippet": snippet,
                            }
                        )
                        count += 1
                        if count >= max_matches:
                            return results
                        break
        except Exception as e:
            logger.debug("Error searching smali file %s: %s", smali_file, e)

    return results
