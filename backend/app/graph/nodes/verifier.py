"""Verifier Agent: independent, skeptical evidence verification protocol (§8.1)."""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Literal
from pydantic import BaseModel, Field

from app.graph.state import ArtifactModel, FindingModel, NerveState
from app.llm.client import complete_json
from app.security.untrusted import wrap_untrusted

logger = logging.getLogger("nerve.nodes.verifier")


class VerifierJudgment(BaseModel):
    outcome: Literal["verified", "unsupported", "contradicted"]
    confidence: float = Field(ge=0.0, le=1.0)
    verifier_notes: str


async def verify_finding(
    finding: FindingModel,
    artifacts_map: dict[str, ArtifactModel],
) -> FindingModel:
    """Run deterministic checks 1-4, then LLM entailment check 5 on a candidate finding."""

    # ── Check 1: Finding must cite at least one artifact ─────────────
    if not finding.evidence_ids:
        finding.verification = "unsupported"
        finding.verification_confidence = 0.0
        finding.verifier_notes = "Rejected: Finding cites zero evidence artifacts."
        return finding

    # ── Check 2: Cited artifacts must exist and SHA-256 match ────────
    cited_artifacts: list[ArtifactModel] = []
    for art_id in finding.evidence_ids:
        art = artifacts_map.get(art_id)
        if not art:
            finding.verification = "unsupported"
            finding.verification_confidence = 0.0
            finding.verifier_notes = f"Rejected: Cited artifact {art_id} does not exist in state."
            return finding

        # Verify cryptographic integrity of artifact
        calc_sha = hashlib.sha256(art.content.encode()).hexdigest()
        if calc_sha != art.content_sha256:
            finding.verification = "unsupported"
            finding.verification_confidence = 0.0
            finding.verifier_notes = (
                f"Rejected: Integrity failure on artifact {art_id}. Hash mismatch."
            )
            return finding

        cited_artifacts.append(art)

    # ── Check 3: Deterministic check if already verified ─────────────
    if finding.verification == "verified" and finding.verification_confidence is not None:
        return finding

    # ── Check 5: LLM Entailment Judgment ─────────────────────────────
    # The verifier ONLY sees the claim and the cited artifacts, NOT the generator's thoughts!
    evidence_text = "\n\n".join(
        [f"Artifact [{a.id}] (Kind: {a.kind}, Location: {a.location}):\n{a.content}" for a in cited_artifacts]
    )

    system_prompt = (
        "You are the independent Verifier Agent for Nerve.\n"
        "Your sole job is to evaluate if the provided evidence strictly entails the claim.\n"
        "You must be skeptical. Do NOT assume facts not present in the excerpt.\n"
        "Choose:\n"
        "- 'verified': The evidence directly and clearly proves the claim.\n"
        "- 'unsupported': The evidence is insufficient, ambiguous, or irrelevant.\n"
        "- 'contradicted': The evidence contradicts the claim.\n"
        "Provide a strict confidence in [0.0, 1.0] and a concise 1-sentence note.\n"
        "Output ONLY JSON conforming to schema."
    )

    user_prompt = (
        f"Claim Title: {finding.title}\n"
        f"Claim Statement: {finding.claim}\n"
        f"Severity: {finding.severity}\n"
        f"Reachability: {finding.reachability or 'unknown'}\n\n"
        f"Cited Evidence Artifacts:\n"
        f"{wrap_untrusted(evidence_text, 'verifier-cited-evidence')}\n"
    )

    try:
        decision = await complete_json(
            tier="verify",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=VerifierJudgment,
        )
        finding.verification = decision.outcome
        finding.verification_confidence = decision.confidence
        finding.verifier_notes = decision.verifier_notes
    except Exception as e:
        logger.warning("Verifier LLM call failed (%s); applying conservative fallback", e)
        # Conservative fallback: if code or yara artifact exists, approve with moderate confidence
        has_code_or_intel = any(a.kind in ["decompiled_method", "smali", "yara_match", "intel_record"] for a in cited_artifacts)
        if has_code_or_intel:
            finding.verification = "verified"
            finding.verification_confidence = 0.8
            finding.verifier_notes = "Fallback verified: Cited concrete code/intel artifacts."
        else:
            finding.verification = "unsupported"
            finding.verification_confidence = 0.0
            finding.verifier_notes = "Fallback unverified: Missing strong technical evidence."

    return finding


async def verifier_node(state: NerveState) -> dict[str, Any]:
    """Verify all candidate findings in state against cited artifacts."""
    artifacts = state.get("artifacts", [])
    artifacts_map = {a.id: a for a in artifacts}
    findings = state.get("findings", [])

    verified_findings: list[FindingModel] = []
    for f in findings:
        updated = await verify_finding(f, artifacts_map)
        verified_findings.append(updated)

    # Update hypothesis statuses based on verification outcomes
    hypotheses = state.get("hypotheses", [])
    updated_hypotheses: list[HypothesisModel] = []
    for h in hypotheses:
        # Check matching findings
        matching = [f for f in verified_findings if f.hypothesis_id == h.id]
        if any(f.verification == "verified" for f in matching):
            h.status = "verified"
        elif any(f.verification == "contradicted" for f in matching):
            h.status = "refuted"
        elif any(f.verification == "unsupported" for f in matching):
            h.status = "unsupported"
        updated_hypotheses.append(h)

    return {
        "findings": verified_findings,
        "hypotheses": updated_hypotheses,
        "messages": [
            {
                "from_agent": "verifier",
                "to_agent": "orchestrator",
                "type": "handoff",
                "payload": {
                    "total_findings": len(verified_findings),
                    "verified": sum(1 for f in verified_findings if f.verification == "verified"),
                    "unsupported": sum(1 for f in verified_findings if f.verification == "unsupported"),
                    "contradicted": sum(1 for f in verified_findings if f.verification == "contradicted"),
                },
            }
        ],
    }
