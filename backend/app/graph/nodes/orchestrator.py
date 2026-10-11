"""Orchestrator Agent: planning, delegation, budget enforcement, and disagreement resolution (§6.2)."""

from __future__ import annotations

import logging
from typing import Any, Literal
from pydantic import BaseModel, Field, AliasChoices

from app.graph.state import NerveState
from app.llm.client import complete_json
from app.security.untrusted import wrap_untrusted

logger = logging.getLogger("nerve.nodes.orchestrator")


class OrchestratorPlan(BaseModel):
    depth: Literal["shallow", "deep"] = Field(
        default="deep",
        validation_alias=AliasChoices("depth", "recommendation", "investigation_depth"),
    )
    prioritized_hypothesis_ids: list[str] = Field(default_factory=list)
    rationale: str = Field(
        default="Standard triage decomposition",
        validation_alias=AliasChoices("rationale", "reason", "reasoning", "explanation"),
    )
    stop_early: bool = False


async def orchestrator_node(state: NerveState) -> dict[str, Any]:
    """Orchestrator plans the investigation or updates priorities based on current findings."""
    meta = state.get("apk_meta", {})
    permissions = meta.get("permissions", [])
    is_packed = meta.get("is_packed", False)
    hypotheses = state.get("hypotheses", [])

    # Check for dangerous Android permissions
    dangerous_perms = [
        p for p in permissions
        if any(d in p for d in ["SMS", "RECEIVE_BOOT", "ACCESSIBILITY", "READ_CONTACTS", "SYSTEM_ALERT_WINDOW", "RECORD_AUDIO"])
    ]

    # Fast heuristic if no hypotheses yet: decide default depth
    system_prompt = (
        "You are the Orchestrator for Nerve, an agentic Android malware triage system.\n"
        "Your task is to analyze the intake metadata and plan the investigation.\n"
        "If there are no dangerous permissions, no packing, and minimal attack surface, recommend 'shallow'.\n"
        "Otherwise recommend 'deep' and prioritize hypotheses.\n"
        "Output ONLY JSON matching the schema."
    )

    hypotheses_summary = "\n".join([f"- [{h.id}] ({h.category}) {h.statement} (status: {h.status})" for h in hypotheses])
    user_prompt = (
        f"Package: {meta.get('package_name')}\n"
        f"Is Packed: {is_packed}\n"
        f"Dangerous Permissions ({len(dangerous_perms)}): {', '.join(dangerous_perms)}\n"
        f"Current Hypotheses:\n{hypotheses_summary or 'None proposed yet.'}\n\n"
        "Provide your investigation plan."
    )

    try:
        plan_result = await complete_json(
            tier="strong",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": wrap_untrusted(user_prompt, "meta-plan")},
            ],
            schema=OrchestratorPlan,
        )
        depth = plan_result.depth
        prioritized = plan_result.prioritized_hypothesis_ids
        rationale = plan_result.rationale
    except Exception as e:
        logger.warning("Orchestrator LLM call failed (%s); using heuristic fallback", e)
        depth = "deep" if (dangerous_perms or is_packed or hypotheses) else "shallow"
        prioritized = [h.id for h in hypotheses]
        rationale = "Heuristic plan based on permission and packing indicators."

    new_plan = {
        "depth": depth,
        "prioritized_hypotheses": prioritized,
        "rationale": rationale,
    }

    return {
        "plan": new_plan,
        "messages": [
            {
                "from_agent": "orchestrator",
                "to_agent": "all",
                "type": "handoff",
                "payload": {"plan": new_plan},
            }
        ],
    }


class OrchestratorResolution(BaseModel):
    resolutions: list[dict[str, Any]] = Field(default_factory=list)
    retry_hypotheses: list[str] = Field(default_factory=list)
    should_stop: bool = True
    stop_reason: str = Field(
        default="Completed investigation cycle",
        validation_alias=AliasChoices("stop_reason", "reason", "rationale"),
    )


async def orchestrator_resolve_node(state: NerveState) -> dict[str, Any]:
    """Orchestrator resolves conflicts and decides whether to perform another investigation round."""
    iteration = state.get("iteration", 0) + 1
    budget = state.get("budget", {})
    max_iter = budget.get("max_iterations", 3)

    findings = state.get("findings", [])
    contradicted = [f for f in findings if f.verification == "contradicted"]

    if iteration >= max_iter or not contradicted:
        # Finish investigation
        return {
            "iteration": iteration,
            "plan": {**state.get("plan", {}), "retry_hypotheses": []},
            "messages": [
                {
                    "from_agent": "orchestrator",
                    "to_agent": "scoring",
                    "type": "resolution",
                    "payload": {
                        "action": "proceed_to_score",
                        "iteration": iteration,
                        "unresolved_contradictions": len(contradicted),
                    },
                }
            ],
        }

    # Needs targeted retry on contradicted hypotheses
    retry_ids = list(set([f.hypothesis_id for f in contradicted]))
    return {
        "iteration": iteration,
        "plan": {**state.get("plan", {}), "retry_hypotheses": retry_ids},
        "messages": [
            {
                "from_agent": "orchestrator",
                "to_agent": "investigate",
                "type": "challenge",
                "payload": {
                    "action": "retry_hypotheses",
                    "retry_ids": retry_ids,
                    "iteration": iteration,
                },
            }
        ],
    }
