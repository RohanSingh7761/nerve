"""LangGraph state model and Pydantic representations for Nerve (§8.3)."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, Optional, TypedDict
from pydantic import BaseModel, Field


def merge_by_id(existing: list[Any], new_items: list[Any]) -> list[Any]:
    """Reducer that merges items by their .id attribute, updating or appending."""
    res_map = {item.id if hasattr(item, "id") else item["id"]: item for item in existing}
    for item in new_items:
        key = item.id if hasattr(item, "id") else item["id"]
        res_map[key] = item
    return list(res_map.values())


class ArtifactModel(BaseModel):
    id: str  # "A-0042"
    kind: Literal[
        "manifest",
        "permission",
        "component",
        "string",
        "decompiled_method",
        "smali",
        "ioc",
        "yara_match",
        "intel_record",
        "tool_error",
    ]
    location: str  # "com.foo.SmsReceiver#onReceive" or "AndroidManifest.xml:L34"
    content: str  # truncated excerpt (<= ~150 lines)
    content_sha256: str
    flags: list[str] = Field(default_factory=list)
    created_by_tool_call: Optional[str] = None


class HypothesisModel(BaseModel):
    id: str  # "H-03"
    category: str
    statement: str
    attack_technique: Optional[str] = None
    status: Literal[
        "proposed",
        "investigating",
        "confirmed",
        "refuted",
        "inconclusive",
        "verified",
        "unsupported",
    ] = "proposed"
    confidence: float = 0.5
    proposed_by: str = "static"
    iteration: int = 0


class FindingModel(BaseModel):
    id: str  # "F-01"
    hypothesis_id: str
    title: str
    severity: Literal["info", "low", "medium", "high", "critical"] = "medium"
    claim: str
    rule_id: Optional[str] = None  # R01..R10
    reachability: Optional[Literal["reachable", "unreachable", "unknown"]] = None
    evidence_ids: list[str] = Field(default_factory=list)
    verification: Optional[Literal["verified", "unsupported", "contradicted"]] = None
    verification_confidence: Optional[float] = None
    verifier_notes: Optional[str] = None


class NerveState(TypedDict):
    analysis_id: str
    sha256: str
    apk_path: str
    workspace_dir: str
    apk_meta: dict[str, Any]
    plan: dict[str, Any]  # depth: shallow|deep, prioritized_hypotheses, retry_hypotheses
    budget: dict[str, Any]  # max_tokens, tokens_used, max_iterations
    iteration: int
    hypotheses: Annotated[list[HypothesisModel], merge_by_id]
    artifacts: Annotated[list[ArtifactModel], add]
    findings: Annotated[list[FindingModel], merge_by_id]
    messages: Annotated[list[dict[str, Any]], add]
    score: Optional[dict[str, Any]]
    reports: Optional[dict[str, Any]]
