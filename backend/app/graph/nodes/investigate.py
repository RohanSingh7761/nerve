"""Investigation node: executes Reverse Engineering and Threat Intel for hypotheses (§7, §8.4)."""

from __future__ import annotations

import logging
from typing import Any

from app.graph.nodes.reverse_eng import investigate_hypothesis_re
from app.graph.nodes.threat_intel import threat_intel_node
from app.graph.state import ArtifactModel, FindingModel, HypothesisModel, NerveState

logger = logging.getLogger("nerve.nodes.investigate")


async def investigate_node(state: NerveState) -> dict[str, Any]:
    """Runs RE deep analysis on prioritized hypotheses and collects Threat Intel."""
    plan = state.get("plan", {})
    prioritized_ids = plan.get("prioritized_hypotheses", [])
    retry_ids = plan.get("retry_hypotheses", [])
    target_ids = set(retry_ids if retry_ids else prioritized_ids)

    hypotheses = state.get("hypotheses", [])
    artifacts: list[ArtifactModel] = []
    findings: list[FindingModel] = []
    updated_hypotheses: list[HypothesisModel] = []

    # 1. Run RE on each targeted hypothesis
    for h in hypotheses:
        if not target_ids or h.id in target_ids:
            h.status = "investigating"
            finding, arts, outcome = await investigate_hypothesis_re(h, state)
            h.status = outcome  # confirmed, refuted, or inconclusive
            if finding:
                findings.append(finding)
            artifacts.extend(arts)
        updated_hypotheses.append(h)

    # 2. Run Threat Intel (YARA, local blocklists, IOCs)
    ti_result = await threat_intel_node(state)
    artifacts.extend(ti_result.get("artifacts", []))
    findings.extend(ti_result.get("findings", []))

    return {
        "hypotheses": updated_hypotheses,
        "artifacts": artifacts,
        "findings": findings,
        "messages": [
            {
                "from_agent": "investigate",
                "to_agent": "verifier",
                "type": "handoff",
                "payload": {
                    "findings_produced": len(findings),
                    "artifacts_extracted": len(artifacts),
                },
            }
        ],
    }
