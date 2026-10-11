"""StateGraph compilation and lifecycle management for Nerve (§8.4)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.graph.nodes.intake import intake_node
from app.graph.nodes.investigate import investigate_node
from app.graph.nodes.orchestrator import orchestrator_node, orchestrator_resolve_node
from app.graph.nodes.report import report_agent_node
from app.graph.nodes.scoring import risk_scoring_node
from app.graph.nodes.static_agent import static_agent_node
from app.graph.nodes.verifier import verifier_node
from app.graph.routing import depth_router, loop_router
from app.graph.state import NerveState

logger = logging.getLogger("nerve.graph")


def build_nerve_graph(checkpointer: Optional[Any] = None) -> Any:
    """Build and compile the multi-agent LangGraph workflow."""
    builder = StateGraph(NerveState)

    # Add Nodes
    builder.add_node("intake", intake_node)
    builder.add_node("orchestrator", orchestrator_node)
    builder.add_node("static", static_agent_node)
    builder.add_node("investigate", investigate_node)
    builder.add_node("verify", verifier_node)
    builder.add_node("resolve", orchestrator_resolve_node)
    builder.add_node("score", risk_scoring_node)
    builder.add_node("report", report_agent_node)

    # Add Edges
    builder.add_edge(START, "intake")
    builder.add_edge("intake", "orchestrator")
    builder.add_edge("orchestrator", "static")

    # Conditional routing after static analysis
    builder.add_conditional_edges(
        "static",
        depth_router,
        {"investigate": "investigate", "score": "score"},
    )

    builder.add_edge("investigate", "verify")
    builder.add_edge("verify", "resolve")

    # Conditional routing after resolution / conflict check
    builder.add_conditional_edges(
        "resolve",
        loop_router,
        {"investigate": "investigate", "score": "score"},
    )

    builder.add_edge("score", "report")
    builder.add_edge("report", END)

    # Use provided checkpointer or default memory saver for thread resumption
    cp = checkpointer or MemorySaver()
    return builder.compile(checkpointer=cp)


# Precompiled graph instance
graph = build_nerve_graph()
