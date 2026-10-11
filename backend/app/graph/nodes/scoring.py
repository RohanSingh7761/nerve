"""Risk scoring: deterministic noisy-OR aggregation over verified findings only (§8.2)."""

from __future__ import annotations

import logging
from typing import Any
from pydantic import BaseModel

from app.graph.state import NerveState
from app.llm.client import complete_json

logger = logging.getLogger("nerve.nodes.scoring")

RULES_TABLE = {
    "R01": {"label": "SMS interception/sending + network exfiltration path", "weight": 0.55},
    "R02": {"label": "Accessibility service abuse", "weight": 0.55},
    "R03": {"label": "Dynamic code loading of embedded/remote payload", "weight": 0.35},
    "R04": {"label": "Persistence (boot receiver, hidden icon, device admin)", "weight": 0.25},
    "R05": {"label": "Communication with flagged IOC / C2", "weight": 0.50},
    "R06": {"label": "Known-malicious hash or family YARA match", "weight": 0.85},
    "R07": {"label": "Overlay/credential phishing patterns", "weight": 0.60},
    "R08": {"label": "Packer / heavy obfuscation (APKiD)", "weight": 0.15},
    "R09": {"label": "Excessive permissions beyond declared purpose", "weight": 0.10},
    "R10": {"label": "Contacts/call-log/location harvesting", "weight": 0.40},
    # Vulnerability & Security Posture Rules (OWASP MASVS)
    "V01": {"label": "Application Debuggable flag enabled (JDWP exposure)", "weight": 0.45},
    "V02": {"label": "Insecure Application Backup enabled (ADB backup leak)", "weight": 0.25},
    "V03": {"label": "Cleartext HTTP communication permitted", "weight": 0.35},
    "V04": {"label": "User custom CA certificates trusted in network config", "weight": 0.30},
    "V05": {"label": "Unprotected Exported Components (Activity/Service/Provider)", "weight": 0.40},
}


class ScoringRationaleOutput(BaseModel):
    summary_rationale: str
    top_risk_factors: list[str]


async def risk_scoring_node(state: NerveState) -> dict[str, Any]:
    """Computes explainable deterministic risk score using noisy-OR over verified findings."""
    meta = state.get("apk_meta", {})
    findings = state.get("findings", [])
    is_packed = meta.get("is_packed", False)

    # Filter strictly for verified findings
    verified = [f for f in findings if f.verification == "verified"]

    # Rule R08 special case: if APK is packed, add R08 automatically
    active_rules: dict[str, dict[str, Any]] = {}

    if is_packed:
        active_rules["R08"] = {
            "label": RULES_TABLE["R08"]["label"],
            "weight": RULES_TABLE["R08"]["weight"],
            "v_i": 1.0,
            "finding_id": None,
        }

    for f in verified:
        r_id = f.rule_id
        if r_id and r_id in RULES_TABLE:
            conf = f.verification_confidence if f.verification_confidence is not None else 1.0
            # Keep highest confidence if multiple findings trigger the same rule
            if r_id not in active_rules or conf > active_rules[r_id]["v_i"]:
                active_rules[r_id] = {
                    "label": RULES_TABLE[r_id]["label"],
                    "weight": RULES_TABLE[r_id]["weight"],
                    "v_i": conf,
                    "finding_id": f.id,
                }

    # Noisy-OR computation: risk = 100 * (1 - Product(1 - w_i * v_i))
    product_term = 1.0
    breakdown_list = []

    for r_id, r_info in active_rules.items():
        w = r_info["weight"]
        v = r_info["v_i"]
        product_term *= (1.0 - (w * v))
        contribution = round(w * v * 100, 2)
        breakdown_list.append(
            {
                "rule_id": r_id,
                "label": r_info["label"],
                "weight": w,
                "verification_confidence": v,
                "contribution": contribution,
                "finding_id": r_info["finding_id"],
            }
        )

    risk_score = round(100.0 * (1.0 - product_term), 2)

    # Verdict bands: < 30 low_risk · 30–60 suspicious · >= 60 likely_malicious
    if risk_score < 30.0:
        verdict = "low_risk"
    elif risk_score < 60.0:
        verdict = "suspicious"
    else:
        verdict = "likely_malicious"

    # Confidence calculation: caps if packed (limited visibility)
    base_confidence = min(1.0, 0.4 + (len(verified) * 0.15))
    if is_packed:
        base_confidence = min(base_confidence, 0.65)
    confidence = round(base_confidence, 2)

    # LLM writes human-readable rationale explanation (CANNOT change the number!)
    prompt = (
        f"Computed Risk Score: {risk_score} / 100\n"
        f"Verdict: {verdict}\n"
        f"Active Rules: {', '.join([b['rule_id'] + ': ' + b['label'] for b in breakdown_list])}\n"
        f"Packed payload: {is_packed}\n\n"
        "Explain the risk assessment concisely and identify top risk factors."
    )

    try:
        rationale_resp = await complete_json(
            tier="triage",
            messages=[
                {
                    "role": "system",
                    "content": "You are a cybersecurity risk assessor. Write an executive summary rationale for the deterministic score.",
                },
                {"role": "user", "content": prompt},
            ],
            schema=ScoringRationaleOutput,
        )
        rationale = rationale_resp.summary_rationale
        top_factors = rationale_resp.top_risk_factors
    except Exception as e:
        logger.warning("Scoring rationale LLM call failed (%s); using template", e)
        rationale = f"Risk score {risk_score} determined by {len(breakdown_list)} verified rules."
        top_factors = [b["label"] for b in breakdown_list[:3]]

    score_result = {
        "risk_score": risk_score,
        "verdict": verdict,
        "confidence": confidence,
        "limited_visibility": is_packed,
        "breakdown": breakdown_list,
        "rationale": rationale,
        "top_factors": top_factors,
    }

    return {
        "score": score_result,
        "messages": [
            {
                "from_agent": "scoring",
                "to_agent": "report",
                "type": "handoff",
                "payload": {"score": risk_score, "verdict": verdict},
            }
        ],
    }
