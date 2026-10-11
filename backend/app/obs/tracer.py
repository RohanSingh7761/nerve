"""Neatlogs tracing and observability integration (§17)."""

from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger("nerve.obs")

_neatlogs_initialized = False


def init_neatlogs() -> bool:
    """Initialize Neatlogs SDK with configured endpoint and API key."""
    global _neatlogs_initialized
    if _neatlogs_initialized:
        return True

    settings = get_settings()
    api_key = settings.neatlogs_api_key
    if not api_key:
        logger.info("NEATLOGS_API_KEY not set; skipping Neatlogs initialization")
        return False

    try:
        import neatlogs

        neatlogs.init(
            endpoint="https://ingest.neatlogs.com",
            workflow_name="nerve-agent-workflow",
            api_key=api_key,
        )
        _neatlogs_initialized = True
        logger.info("Neatlogs tracing initialized successfully")
        return True
    except Exception as exc:
        logger.warning("Failed to initialize Neatlogs: %s", exc)
        return False


def flush_traces() -> None:
    """Flush pending trace spans to Neatlogs ingest endpoint."""
    if not _neatlogs_initialized:
        return
    try:
        import neatlogs

        neatlogs.flush()
    except Exception as e:
        logger.debug("Neatlogs flush error: %s", e)
