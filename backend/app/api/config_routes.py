"""Config API routes: provider, models, and runtime options without exposing secrets (§15)."""

from __future__ import annotations

from fastapi import APIRouter
from app.config import get_settings
from app.llm.client import REGISTRY, get_usable_providers, resolve_model

router = APIRouter(prefix="/config", tags=["Configuration"])


@router.get("")
async def get_configuration():
    """Return runtime configuration: active LLM provider, tier model mapping, and toolchain info."""
    settings = get_settings()
    provider = settings.llm_provider
    cfg = REGISTRY.get(provider, {})

    return {
        "active_provider": provider,
        "models": {
            "triage": resolve_model(provider, "triage"),
            "strong": resolve_model(provider, "strong"),
            "verify": resolve_model(provider, "verify"),
        },
        "usable_providers": get_usable_providers(),
        "fallback_chain": settings.fallback_providers_list,
        "verifier_override_provider": settings.llm_provider_verify,
        "intel_mode": settings.intel_mode,
        "toolchain_mode": settings.toolchain_mode,
        "reference_prices": {
            "in_per_1m": settings.ref_price_in_per_1m,
            "out_per_1m": settings.ref_price_out_per_1m,
        },
    }
