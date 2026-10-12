"""Provider-agnostic LLM client with tier routing, failover chain, JSON repair, and shadow pricing."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Optional, Type, TypeVar

import litellm
import yaml
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.llm.pricing import calculate_actual_cost, calculate_reference_cost

logger = logging.getLogger("nerve.llm")

# Silence noisy litellm logs
litellm.suppress_debug_info = True

try:
    import neatlogs
    _neatlogs_agent_span = neatlogs.span(kind="AGENT", name="llm_agent_complete", capture_input=True, capture_output=True)
except Exception:
    def _neatlogs_agent_span(fn):
        return fn

T = TypeVar("T", bound=BaseModel)

PROVIDERS_FILE = Path(__file__).resolve().parent / "providers.yaml"


def load_registry() -> dict[str, Any]:
    with open(PROVIDERS_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("providers", {})


REGISTRY = load_registry()

# Concurrency throttler
_semaphore: Optional[asyncio.Semaphore] = None
# Per-provider last call timestamp for RPM pacing
_provider_last_call: dict[str, float] = {}

# Fault injection tracker
_fault_injected = False


class AllProvidersFailedError(Exception):
    """Raised when all providers in the fallback chain fail."""
    pass


def get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        settings = get_settings()
        _semaphore = asyncio.Semaphore(settings.llm_max_concurrency)
    return _semaphore


def get_usable_providers(preferred_provider: Optional[str] = None) -> list[str]:
    """Return the ordered list of providers that have valid credentials."""
    settings = get_settings()
    chain: list[str] = []

    if preferred_provider:
        chain.append(preferred_provider)

    primary = settings.llm_provider
    if primary not in chain:
        chain.append(primary)

    for fallback in settings.fallback_providers_list:
        if fallback not in chain:
            chain.append(fallback)

    usable: list[str] = []
    for p in chain:
        if p not in REGISTRY:
            logger.warning("Provider '%s' not recognized in providers.yaml", p)
            continue
        cfg = REGISTRY[p]
        key_env = cfg.get("key_env")
        base_env = cfg.get("base_env")

        # Provider requires key_env or base_env
        if key_env:
            val = os.getenv(key_env, getattr(settings, key_env.lower(), ""))
            if not val:
                logger.debug("Provider '%s' skipped: %s not set", p, key_env)
                continue
        if base_env:
            val = os.getenv(base_env, getattr(settings, base_env.lower(), ""))
            if not val:
                logger.debug("Provider '%s' skipped: %s not set", p, base_env)
                continue
        usable.append(p)

    return usable


def resolve_model(provider: str, tier: str) -> str:
    """Resolve full LiteLLM model identifier for provider + tier."""
    settings = get_settings()
    cfg = REGISTRY[provider]
    prefix = cfg.get("prefix", "")

    # Check env override first (e.g. MODEL_TRIAGE, MODEL_STRONG, MODEL_VERIFY)
    tier_override = getattr(settings, f"model_{tier.lower()}", "")
    
    # Only use tier_override if it matches the current provider or doesn't belong to another provider
    if tier_override:
        # If user explicitly configured e.g. gemini-3-flash-preview, do not force it onto groq/openai/etc.
        override_matches_provider = (
            tier_override.startswith(f"{prefix}/")
            or (prefix == "gemini" and ("gemini" in tier_override or tier_override.startswith("models/")))
            or (prefix == "groq" and ("llama" in tier_override or "gpt-oss" in tier_override or "mixtral" in tier_override or "qwen" in tier_override))
            or (prefix == "anthropic" and "claude" in tier_override)
            or (prefix not in ["gemini", "anthropic"])
        )
        if override_matches_provider:
            # Strip groq/ prefix if present because prefix is prepended below
            model_name = tier_override[len("groq/"):] if (prefix == "groq" and tier_override.startswith("groq/")) else tier_override
        else:
            model_name = cfg["models"].get(tier, cfg["models"].get("triage", ""))
    else:
        model_name = cfg["models"].get(tier, cfg["models"].get("triage", ""))

    # If provider is gemini and model_name has models/ prefix, strip it so litellm formats as gemini/<model>
    if prefix == "gemini" and model_name.startswith("models/"):
        model_name = model_name[len("models/"):]

    if prefix and not model_name.startswith(f"{prefix}/"):
        return f"{prefix}/{model_name}"
    return model_name


async def _pace_provider(provider: str) -> None:
    """Ensure we respect the provider's RPM limit by spacing requests."""
    cfg = REGISTRY.get(provider, {})
    rpm = cfg.get("rpm", 20)
    min_interval = 60.0 / max(rpm, 1)

    now = time.time()
    last_call = _provider_last_call.get(provider, 0.0)
    elapsed = now - last_call
    if elapsed < min_interval:
        await asyncio.sleep(min_interval - elapsed)
    _provider_last_call[provider] = time.time()


def strip_json_fences(content: str) -> str:
    """Extract valid JSON from LLM response which may be wrapped in code fences."""
    text = content.strip()
    if text.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
    # Try finding the outermost JSON object or array
    start_obj = text.find("{")
    end_obj = text.rfind("}")
    start_arr = text.find("[")
    end_arr = text.rfind("]")

    if start_obj != -1 and end_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        return text[start_obj : end_obj + 1]
    elif start_arr != -1 and end_arr != -1:
        return text[start_arr : end_arr + 1]

    return text


async def log_call_to_db(
    agent_run_id: Optional[uuid.UUID],
    provider: str,
    model: str,
    status: str,
    tokens_in: Optional[int],
    tokens_out: Optional[int],
    latency_ms: Optional[int],
    reference_cost_usd: Optional[float],
    error: Optional[str] = None,
    fallback_of: Optional[uuid.UUID] = None,
) -> Optional[uuid.UUID]:
    """Record LLM call in the llm_calls table if agent_run_id is provided."""
    if not agent_run_id:
        return None

    try:
        from app.db.models import LlmCall
        from app.db.session import AsyncSessionLocal

        call_id = uuid.uuid4()
        async with AsyncSessionLocal() as session:
            record = LlmCall(
                id=call_id,
                agent_run_id=agent_run_id,
                provider=provider,
                model=model,
                status=status,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=latency_ms,
                reference_cost_usd=reference_cost_usd,
                error=error,
                fallback_of=fallback_of,
            )
            session.add(record)
            await session.commit()
            return call_id
    except Exception as e:
        logger.warning("Could not log LLM call to DB: %s", e)
        return None


def _annotate_telemetry_span(provider: str, model: str, tokens_in: int, tokens_out: int, ref_cost: float):
    """Set LLM semantic attributes on the active Neatlogs telemetry span."""
    try:
        from opentelemetry import trace as otel_trace
        span = otel_trace.get_current_span()
        if span and span.is_recording():
            span.set_attribute("neatlogs.llm.provider", provider)
            span.set_attribute("neatlogs.llm.model_name", model)
            span.set_attribute("neatlogs.llm.token_count.prompt", tokens_in)
            span.set_attribute("neatlogs.llm.token_count.completion", tokens_out)
            span.set_attribute("neatlogs.llm.token_count.total", tokens_in + tokens_out)
            span.set_attribute("neatlogs.llm.cost_usd", ref_cost)
            span.set_attribute("llm.model_name", model)
            span.set_attribute("llm.token_count.prompt", tokens_in)
            span.set_attribute("llm.token_count.completion", tokens_out)
            span.set_attribute("llm.token_count.total", tokens_in + tokens_out)
    except Exception:
        pass


@_neatlogs_agent_span
async def complete_json(
    tier: str,
    messages: list[dict[str, str]],
    schema: Type[T],
    agent_run_id: Optional[uuid.UUID] = None,
    preferred_provider: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: int = 4096,
) -> T:
    """Execute a completion using the provider chain and return validated Pydantic model.

    Features:
    - Tier-based model selection
    - Automatic provider failover on errors / rate limits
    - JSON extraction & schema validation
    - Single automatic repair prompt on invalid JSON
    - Shadow pricing and call logging
    """
    global _fault_injected
    settings = get_settings()

    # For verify tier, check if a dedicated verify provider is configured
    if tier == "verify" and settings.llm_provider_verify and not preferred_provider:
        preferred_provider = settings.llm_provider_verify

    usable = get_usable_providers(preferred_provider)
    if not usable:
        # Fall back to primary anyway so litellm produces an informative error
        usable = [settings.llm_provider]

    sem = get_semaphore()
    prev_call_id: Optional[uuid.UUID] = None
    last_exception: Optional[Exception] = None

    for provider in usable:
        cfg = REGISTRY.get(provider, {})
        full_model = resolve_model(provider, tier)
        effective_temp = 1.0 if ("gemini-3" in full_model and temperature == 0.0) else temperature
        kwargs: dict[str, Any] = {
            "model": full_model,
            "messages": list(messages),
            "temperature": effective_temp,
            "max_tokens": max_tokens,
            "timeout": 60,
        }

        # Provider specific base/key
        if cfg.get("base_env"):
            base_var = cfg["base_env"]
            kwargs["api_base"] = os.getenv(base_var) or getattr(settings, base_var.lower(), None)
        if cfg.get("key_env"):
            key_var = cfg["key_env"]
            kwargs["api_key"] = os.getenv(key_var) or getattr(settings, key_var.lower(), None)

        # Fault injection test (NERVE_FAULT=llm_rate_limit)
        if settings.nerve_fault == "llm_rate_limit" and not _fault_injected:
            _fault_injected = True
            logger.info("Fault injection triggered: simulating RateLimitError on %s", provider)
            prev_call_id = await log_call_to_db(
                agent_run_id=agent_run_id,
                provider=provider,
                model=full_model,
                status="rate_limited",
                tokens_in=0,
                tokens_out=0,
                latency_ms=10,
                reference_cost_usd=0.0,
                error="Fault injection: Simulated rate limit (429)",
                fallback_of=prev_call_id,
            )
            continue

        async with sem:
            await _pace_provider(provider)
            t0 = time.time()

            try:
                logger.debug("Invoking LLM: provider=%s, model=%s, tier=%s", provider, full_model, tier)
                response = await litellm.acompletion(**kwargs)
                latency_ms = int((time.time() - t0) * 1000)

                raw_content = response.choices[0].message.content or ""
                usage = getattr(response, "usage", None)
                tokens_in = getattr(usage, "prompt_tokens", 0) or 0
                tokens_out = getattr(usage, "completion_tokens", 0) or 0
                ref_cost = calculate_reference_cost(tokens_in, tokens_out)

                # Attempt parsing and validation
                try:
                    cleaned_json = strip_json_fences(raw_content)
                    data = json.loads(cleaned_json)
                    validated = schema.model_validate(data)

                    await log_call_to_db(
                        agent_run_id=agent_run_id,
                        provider=provider,
                        model=full_model,
                        status="ok",
                        tokens_in=tokens_in,
                        tokens_out=tokens_out,
                        latency_ms=latency_ms,
                        reference_cost_usd=ref_cost,
                        fallback_of=prev_call_id,
                    )
                    _annotate_telemetry_span(provider, full_model, tokens_in, tokens_out, ref_cost)
                    return validated

                except (json.JSONDecodeError, ValidationError) as parse_err:
                    logger.warning(
                        "LLM output failed validation (%s). Attempting repair prompt...",
                        parse_err,
                    )
                    # Attempt 1 repair prompt on the same provider
                    await _pace_provider(provider)
                    repair_messages = list(messages) + [
                        {"role": "assistant", "content": raw_content},
                        {
                            "role": "user",
                            "content": (
                                f"The output was invalid JSON or did not match the expected schema:\n"
                                f"Error: {parse_err}\n\n"
                                f"Please output ONLY valid raw JSON conforming strictly to the schema:\n"
                                f"{json.dumps(schema.model_json_schema(), indent=2)}"
                            ),
                        },
                    ]
                    repair_resp = await litellm.acompletion(
                        model=full_model,
                        messages=repair_messages,
                        temperature=0.0,
                        max_tokens=max_tokens,
                        timeout=60,
                        **({"api_base": kwargs["api_base"]} if "api_base" in kwargs else {}),
                        **({"api_key": kwargs["api_key"]} if "api_key" in kwargs else {}),
                    )
                    repair_content = repair_resp.choices[0].message.content or ""
                    repaired_json = strip_json_fences(repair_content)
                    data = json.loads(repaired_json)
                    validated = schema.model_validate(data)

                    await log_call_to_db(
                        agent_run_id=agent_run_id,
                        provider=provider,
                        model=full_model,
                        status="repaired",
                        tokens_in=tokens_in,
                        tokens_out=tokens_out,
                        latency_ms=latency_ms,
                        reference_cost_usd=ref_cost,
                        fallback_of=prev_call_id,
                    )
                    _annotate_telemetry_span(provider, full_model, tokens_in, tokens_out, ref_cost)
                    return validated

            except (
                litellm.RateLimitError,
                litellm.Timeout,
                litellm.ServiceUnavailableError,
                litellm.APIConnectionError,
                Exception,
            ) as exc:
                latency_ms = int((time.time() - t0) * 1000)
                status_label = (
                    "rate_limited"
                    if isinstance(exc, litellm.RateLimitError)
                    else "provider_error"
                )
                logger.warning(
                    "Provider '%s' failed with %s: %s. Failing over to next provider in chain.",
                    provider,
                    type(exc).__name__,
                    exc,
                )
                last_exception = exc
                prev_call_id = await log_call_to_db(
                    agent_run_id=agent_run_id,
                    provider=provider,
                    model=full_model,
                    status=status_label,
                    tokens_in=0,
                    tokens_out=0,
                    latency_ms=latency_ms,
                    reference_cost_usd=0.0,
                    error=str(exc),
                    fallback_of=prev_call_id,
                )
                continue

    raise AllProvidersFailedError(
        f"All LLM providers failed. Last exception: {last_exception}"
    )
