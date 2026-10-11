"""Conditional edge routers for the LangGraph multi-agent flow (§8.4)."""

from __future__ import annotations

from typing import Literal
from app.graph.state import NerveState


def depth_router(state: NerveState) -> Literal["score", "investigate"]:
    """Decide whether to execute deep investigation or shallow scoring."""
    plan = state.get("plan", {})
    if plan.get("depth") == "shallow":
        return "score"
    return "investigate"


def loop_router(state: NerveState) -> Literal["score", "investigate"]:
    """Decide whether to execute another targeted investigation iteration or proceed to score."""
    plan = state.get("plan", {})
    retry = plan.get("retry_hypotheses", [])
    if retry:
        return "investigate"
    return "score"
