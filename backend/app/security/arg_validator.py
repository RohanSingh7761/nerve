"""Path and argument validation for tool subprocesses to enforce workspace isolation."""

from __future__ import annotations

import os
from pathlib import Path


class SecurityValidationError(Exception):
    """Raised when an argument violates security policy."""
    pass


def validate_path_within(target_path: str | Path, allowed_root: str | Path) -> Path:
    """Ensure that target_path strictly resolves within allowed_root (prevent path traversal)."""
    root_resolved = Path(allowed_root).resolve()
    target_resolved = Path(target_path).resolve()

    try:
        target_resolved.relative_to(root_resolved)
    except ValueError:
        raise SecurityValidationError(
            f"Path traversal detected: '{target_path}' is outside allowed root '{allowed_root}'"
        )

    return target_resolved
