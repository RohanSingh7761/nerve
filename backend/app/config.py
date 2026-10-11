"""Nerve configuration — loaded from environment variables via pydantic-settings."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic_settings import BaseSettings
from pydantic import Field


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # nerve/
BACKEND_ROOT = Path(__file__).resolve().parent.parent          # nerve/backend/


class Settings(BaseSettings):
    """All Nerve configuration — every field maps to an env var."""

    # ── LLM Provider ──────────────────────────────────────────────
    llm_provider: str = "gemini"
    llm_fallback_providers: str = ""  # comma-separated
    llm_provider_verify: Optional[str] = None

    # Keys
    gemini_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    mistral_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    ollama_api_base: str = "http://localhost:11434"
    custom_openai_base_url: str = ""
    custom_openai_api_key: str = ""

    # Model overrides
    model_triage: str = ""
    model_strong: str = ""
    model_verify: str = ""

    # LLM behaviour
    llm_max_concurrency: int = 2
    llm_cache: bool = False
    nerve_max_tokens: int = 120_000
    nerve_max_iterations: int = 3

    # ── Shadow Pricing ────────────────────────────────────────────
    ref_price_in_per_1m: float = 0.15
    ref_price_out_per_1m: float = 0.60

    # ── Toolchain ─────────────────────────────────────────────────
    toolchain_mode: Literal["full", "minimal"] = "full"
    jadx_bin: str = "jadx"
    apktool_bin: str = "apktool"
    apkid_bin: str = "apkid"
    java_home: str = ""
    tool_timeout_s: int = 120
    tool_max_concurrency: int = 2
    samples_dir: str = str(PROJECT_ROOT / "data" / "samples")
    artifacts_dir: str = str(PROJECT_ROOT / "data" / "artifacts")

    # ── Process Model ─────────────────────────────────────────────
    embedded_worker: bool = True

    # ── Threat Intel ──────────────────────────────────────────────
    intel_mode: Literal["offline", "online"] = "offline"
    vt_api_key: str = ""
    malwarebazaar_api_key: str = ""

    # ── Database ──────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://nerve:nerve@localhost:5432/nerve"

    # ── Observability ─────────────────────────────────────────────
    neatlogs_api_key: str = ""

    # ── Demo / Testing ────────────────────────────────────────────
    nerve_fault: str = ""  # jadx_crash | llm_rate_limit

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # ── Derived helpers ───────────────────────────────────────────
    @property
    def samples_path(self) -> Path:
        p = Path(self.samples_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def artifacts_path(self) -> Path:
        p = Path(self.artifacts_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def fallback_providers_list(self) -> list[str]:
        if not self.llm_fallback_providers:
            return []
        return [p.strip() for p in self.llm_fallback_providers.split(",") if p.strip()]

    @property
    def sync_database_url(self) -> str:
        """For alembic or sync operations — swap asyncpg for psycopg2."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
