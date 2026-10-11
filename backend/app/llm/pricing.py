"""Shadow pricing and token cost calculation for Nerve."""

from __future__ import annotations

from typing import Optional
from app.config import get_settings


def calculate_reference_cost(
    tokens_in: int,
    tokens_out: int,
    price_in_per_1m: Optional[float] = None,
    price_out_per_1m: Optional[float] = None,
) -> float:
    """Calculate the reference (shadow) cost in USD based on configured rates."""
    settings = get_settings()
    p_in = price_in_per_1m if price_in_per_1m is not None else settings.ref_price_in_per_1m
    p_out = price_out_per_1m if price_out_per_1m is not None else settings.ref_price_out_per_1m

    cost = (tokens_in * p_in / 1_000_000.0) + (tokens_out * p_out / 1_000_000.0)
    return round(cost, 6)


def calculate_actual_cost(
    provider: str,
    tokens_in: int,
    tokens_out: int,
    litellm_cost: Optional[float] = None,
) -> float:
    """Actual cost calculation. Returns 0.0 for free tier providers, or reported cost."""
    free_providers = {"gemini", "groq", "openrouter", "mistral", "ollama"}
    if provider.lower() in free_providers:
        return 0.0
    if litellm_cost is not None and litellm_cost >= 0:
        return round(litellm_cost, 6)
    return 0.0
