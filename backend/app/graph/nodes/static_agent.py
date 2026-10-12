"""Static Analysis Agent: analyzes components, permissions, strings, and emits hypotheses (§6.3)."""

from __future__ import annotations

import hashlib
import logging
from typing import Any
from pydantic import BaseModel, Field, AliasChoices, field_validator

from app.graph.state import ArtifactModel, HypothesisModel, NerveState
from app.llm.client import complete_json
from app.security.untrusted import wrap_untrusted

logger = logging.getLogger("nerve.nodes.static")


class StaticHypothesisOutput(BaseModel):
    category: str = Field(
        default="malware_behavior",
        validation_alias=AliasChoices("category", "type", "threat_type", "classification"),
    )
    statement: str = Field(
        default="",
        validation_alias=AliasChoices("statement", "description", "details", "reason", "hypothesis", "summary"),
    )
    attack_technique: str = Field(
        default="T1000",
        validation_alias=AliasChoices("attack_technique", "technique", "mitre_technique", "technique_id", "attack"),
    )
    confidence: float = Field(
        default=0.7,
        validation_alias=AliasChoices("confidence", "score", "confidence_score", "probability"),
    )
    relevant_indicators: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("relevant_indicators", "indicators", "evidence", "signals", "matches"),
    )

    @field_validator("confidence", mode="before")
    @classmethod
    def parse_confidence(cls, v: Any) -> float:
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ("high", "critical"):
                return 0.85
            if v_lower in ("medium", "med"):
                return 0.65
            if v_lower in ("low", "info"):
                return 0.45
            try:
                return float(v_lower)
            except ValueError:
                return 0.7
        return 0.7

    @field_validator("statement", mode="before")
    @classmethod
    def parse_statement(cls, v: Any) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip()
        return "Suspicious behavioral pattern identified during static metadata analysis."

    @field_validator("relevant_indicators", mode="before")
    @classmethod
    def parse_indicators(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            return [str(item) for item in v]
        if isinstance(v, str) and v.strip():
            return [v.strip()]
        return []


class StaticAgentResponse(BaseModel):
    hypotheses: list[StaticHypothesisOutput] = Field(
        default_factory=list,
        validation_alias=AliasChoices("hypotheses", "findings", "items", "results"),
    )
    summary: str = Field(
        default="Static analysis completed",
        validation_alias=AliasChoices("summary", "rationale", "overview", "explanation", "analysis"),
    )


async def static_agent_node(state: NerveState) -> dict[str, Any]:
    """Static agent reviews extracted metadata and emits behavior hypotheses."""
    meta = state.get("apk_meta", {})
    permissions = meta.get("permissions", [])
    components = meta.get("components", {})
    strings = meta.get("strings", [])

    system_prompt = (
        "You are the Static Analysis Agent for Nerve.\n"
        "Your role is to formulate suspicious behavior hypotheses based on Android components, permissions, and strings.\n"
        "Valid categories include:\n"
        "- sms_interception\n"
        "- accessibility_abuse\n"
        "- overlay_phishing\n"
        "- dynamic_code_loading\n"
        "- persistence\n"
        "- contact_exfiltration\n"
        "- c2_communication\n"
        "- device_admin_abuse\n"
        "- anti_analysis\n"
        "- excess_permissions\n\n"
        "Respond ONLY in valid JSON conforming to this schema:\n"
        "{\n"
        '  "summary": "High-level summary of static observations",\n'
        '  "hypotheses": [\n'
        "    {\n"
        '      "category": "excess_permissions",\n'
        '      "statement": "Application requests broader permissions than needed for declared functionality",\n'
        '      "attack_technique": "T1000",\n'
        '      "confidence": 0.8,\n'
        '      "relevant_indicators": ["android.permission.SEND_SMS"]\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Package: {meta.get('package_name')}\n"
        f"Declared Permissions: {', '.join(permissions[:30])}\n"
        f"Activities ({len(components.get('activities', []))}): {', '.join(components.get('activities', [])[:10])}\n"
        f"Services ({len(components.get('services', []))}): {', '.join(components.get('services', [])[:10])}\n"
        f"Receivers ({len(components.get('receivers', []))}): {', '.join(components.get('receivers', [])[:10])}\n"
        f"Sample Strings: {', '.join(strings[:40])}\n"
    )

    hypotheses: list[HypothesisModel] = []
    artifacts: list[ArtifactModel] = []

    try:
        resp = await complete_json(
            tier="triage",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": wrap_untrusted(user_prompt, "static-meta")},
            ],
            schema=StaticAgentResponse,
        )

        for i, h in enumerate(resp.hypotheses, start=1):
            hypotheses.append(
                HypothesisModel(
                    id=f"H-{i:02d}",
                    category=h.category,
                    statement=h.statement,
                    attack_technique=h.attack_technique,
                    status="proposed",
                    confidence=h.confidence,
                    proposed_by="static_agent",
                )
            )

    except Exception as e:
        logger.warning("Static agent LLM call failed (%s); using deterministic rule mapping", e)
        # Deterministic fallback mapping
        idx = 1
        perms_str = " ".join(permissions).upper()
        if "SMS" in perms_str:
            hypotheses.append(
                HypothesisModel(
                    id=f"H-{idx:02d}",
                    category="sms_interception",
                    statement="App possesses SMS permissions and may intercept incoming SMS or 2FA tokens.",
                    attack_technique="T1412 (SMS Interception)",
                    confidence=0.7,
                    proposed_by="static_agent",
                )
            )
            idx += 1
        if "ACCESSIBILITY" in perms_str or any("accessibility" in s.lower() for s in components.get("services", [])):
            hypotheses.append(
                HypothesisModel(
                    id=f"H-{idx:02d}",
                    category="accessibility_abuse",
                    statement="App registers accessibility service, possibly abusing it for automated interactions or keylogging.",
                    attack_technique="T1437 (Application Layer Protocol)",
                    confidence=0.8,
                    proposed_by="static_agent",
                )
            )
            idx += 1
        if "BOOT_COMPLETED" in perms_str or any("boot" in r.lower() for r in components.get("receivers", [])):
            hypotheses.append(
                HypothesisModel(
                    id=f"H-{idx:02d}",
                    category="persistence",
                    statement="App listens for system boot completion to establish persistence.",
                    attack_technique="T1402 (Broadcast Receivers)",
                    confidence=0.6,
                    proposed_by="static_agent",
                )
            )
            idx += 1

    # Emit component artifact
    comp_content = (
        f"Activities:\n" + "\n".join(components.get("activities", [])) + "\n\n"
        f"Services:\n" + "\n".join(components.get("services", [])) + "\n\n"
        f"Receivers:\n" + "\n".join(components.get("receivers", []))
    )
    artifacts.append(
        ArtifactModel(
            id="A-0003",
            kind="component",
            location="AndroidManifest.xml#components",
            content=comp_content[:3000],
            content_sha256=hashlib.sha256(comp_content.encode()).hexdigest(),
        )
    )

    # Automatically prioritize newly created hypotheses in plan
    updated_plan = {
        **state.get("plan", {}),
        "prioritized_hypotheses": [h.id for h in hypotheses],
    }

    return {
        "hypotheses": hypotheses,
        "artifacts": artifacts,
        "plan": updated_plan,
        "messages": [
            {
                "from_agent": "static",
                "to_agent": "orchestrator",
                "type": "handoff",
                "payload": {"hypotheses_count": len(hypotheses)},
            }
        ],
    }
