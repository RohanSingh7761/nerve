"""Report Agent: generates executive and technical reports with mandatory evidence citations (§6.8)."""

from __future__ import annotations

import logging
import re
from typing import Any
from pydantic import BaseModel

from app.graph.state import NerveState
from app.llm.client import complete_json

logger = logging.getLogger("nerve.nodes.report")


class ReportOutput(BaseModel):
    executive_markdown: str
    technical_markdown: str


def check_citations(report_text: str, valid_artifact_ids: set[str]) -> dict[str, Any]:
    """Inspects markdown report for [E-<artifact_id>] citations and validates them."""
    matches = re.findall(r"\[E-([A-Za-z0-9_-]+)\]", report_text)
    total_citations = len(matches)
    valid_citations = [m for m in matches if m in valid_artifact_ids or f"A-{m}" in valid_artifact_ids]

    return {
        "total_citations": total_citations,
        "valid_citations": len(valid_citations),
        "citation_density": round(total_citations / max(1, len(report_text.split("\n\n"))), 2),
    }


async def report_agent_node(state: NerveState) -> dict[str, Any]:
    """Generates cited executive and technical reports from verified findings."""
    meta = state.get("apk_meta", {})
    score_data = state.get("score", {})
    artifacts = state.get("artifacts", [])
    valid_art_ids = {a.id for a in artifacts} | {a.id.replace("A-", "") for a in artifacts}

    findings = state.get("findings", [])
    verified_findings = [f for f in findings if f.verification == "verified"]
    unverified_findings = [f for f in findings if f.verification != "verified"]

    # Format findings summary with evidence links
    findings_prompt_text = ""
    for f in verified_findings:
        evidence_str = ", ".join([f"[E-{e}]" for e in f.evidence_ids])
        findings_prompt_text += (
            f"### {f.title} ({f.severity.upper()})\n"
            f"- Rule: {f.rule_id}\n"
            f"- Claim: {f.claim}\n"
            f"- Evidence Citations: {evidence_str}\n"
            f"- Verifier Note: {f.verifier_notes}\n\n"
        )

    system_prompt = (
        "You are the Report Writer for Nerve, an agentic Android malware triage platform.\n"
        "Generate two markdown reports:\n"
        "1. Executive Report: Verdict, Score, Top 3 Risks, Business Impact, Action Recommendation (block/quarantine/allow/escalate).\n"
        "2. Technical Report: Comprehensive findings with cited artifacts [E-A-XXXX], IOCs, ATT&CK mapping, unverified leads, and limited visibility.\n"
        "CITATION RULE: Every factual technical claim MUST cite the corresponding evidence artifact using the format [E-<artifact_id>].\n"
        "Do not invent facts not in the evidence. Output JSON conforming to schema."
    )

    user_prompt = (
        f"Application: {meta.get('package_name')} (v{meta.get('version_name')})\n"
        f"Verdict: {score_data.get('verdict')} (Score: {score_data.get('risk_score')}/100, Confidence: {score_data.get('confidence')})\n"
        f"Is Packed: {meta.get('is_packed')}\n\n"
        f"Verified Findings:\n{findings_prompt_text or 'No malicious findings verified.'}\n"
        f"Unverified Leads Count: {len(unverified_findings)}\n"
    )

    try:
        report_resp = await complete_json(
            tier="strong",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=ReportOutput,
        )
        exec_md = report_resp.executive_markdown
        tech_md = report_resp.technical_markdown
    except Exception as e:
        logger.warning("Report LLM call failed (%s); generating structured template", e)
        # Robust template generation
        exec_md = (
            f"# Executive Security Triage Report\n\n"
            f"**Target:** `{meta.get('package_name')}`  \n"
            f"**Verdict:** `{score_data.get('verdict')}` (Risk Score: **{score_data.get('risk_score')}/100**)  \n"
            f"**Confidence:** {score_data.get('confidence')}  \n\n"
            f"## Key Risk Factors\n"
            + "\n".join([f"- {f.title} ({f.severity.upper()})" for f in verified_findings[:3]])
            + "\n\n## Recommended Action\n"
            + ("**BLOCK** application from deployment and quarantine." if score_data.get("risk_score", 0) >= 60 else "**REVIEW** suspicious capabilities.")
        )
        tech_md = (
            f"# Technical Analysis Report\n\n"
            f"**Package:** `{meta.get('package_name')}`\n\n"
            f"## Verified Findings\n\n"
            + findings_prompt_text
            + f"\n## Methodology & Verification\nAll findings checked through independent deterministic and semantic verification protocols.\n"
        )

    # Post-check citation accuracy
    citation_metrics = check_citations(tech_md, valid_art_ids)

    reports = {
        "executive": exec_md,
        "technical": tech_md,
        "citation_metrics": citation_metrics,
    }

    return {
        "reports": reports,
        "messages": [
            {
                "from_agent": "report",
                "to_agent": "all",
                "type": "resolution",
                "payload": {"reports_generated": True, "citation_metrics": citation_metrics},
            }
        ],
    }
