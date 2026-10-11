"""SQLAlchemy 2.0 async models for Nerve's 16 PostgreSQL tables."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── 1. Analyses ─────────────────────────────────────────────────────────────
class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    md5: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="queued"
    )  # queued, running, completed, failed, cancelled
    variant: Mapped[str] = mapped_column(
        Text, nullable=False, default="v2_multi"
    )  # v1_single, v2_multi
    llm_provider: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verdict: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # low_risk, suspicious, likely_malicious
    risk_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)
    langgraph_thread: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    neatlogs_trace_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    actual_cost_usd: Mapped[float] = mapped_column(Numeric(10, 5), default=0.0)
    reference_cost_usd: Mapped[float] = mapped_column(Numeric(10, 5), default=0.0)
    budget: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    limited_visibility: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    metadata_rel: Mapped[Optional[ApkMetadata]] = relationship(
        "ApkMetadata", back_populates="analysis", uselist=False, cascade="all, delete-orphan"
    )
    agent_runs: Mapped[list[AgentRun]] = relationship(
        "AgentRun", back_populates="analysis", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list[Artifact]] = relationship(
        "Artifact", back_populates="analysis", cascade="all, delete-orphan"
    )
    hypotheses: Mapped[list[Hypothesis]] = relationship(
        "Hypothesis", back_populates="analysis", cascade="all, delete-orphan"
    )
    findings: Mapped[list[Finding]] = relationship(
        "Finding", back_populates="analysis", cascade="all, delete-orphan"
    )
    iocs: Mapped[list[Ioc]] = relationship(
        "Ioc", back_populates="analysis", cascade="all, delete-orphan"
    )
    messages: Mapped[list[AgentMessage]] = relationship(
        "AgentMessage", back_populates="analysis", cascade="all, delete-orphan"
    )
    score_breakdowns: Mapped[list[ScoreBreakdown]] = relationship(
        "ScoreBreakdown", back_populates="analysis", cascade="all, delete-orphan"
    )
    reports: Mapped[list[Report]] = relationship(
        "Report", back_populates="analysis", cascade="all, delete-orphan"
    )
    events: Mapped[list[AnalysisEvent]] = relationship(
        "AnalysisEvent", back_populates="analysis", cascade="all, delete-orphan"
    )
    jobs: Mapped[list[Job]] = relationship(
        "Job", back_populates="analysis", cascade="all, delete-orphan"
    )


# ── 2. APK metadata ─────────────────────────────────────────────────────────
class ApkMetadata(Base):
    __tablename__ = "apk_metadata"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), primary_key=True
    )
    package_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version_code: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    min_sdk: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_sdk: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    signing_cert_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_packed: Mapped[bool] = mapped_column(Boolean, default=False)
    packer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    obfuscators: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    permissions: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    components: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="metadata_rel")


# ── 3. Agent runs ────────────────────────────────────────────────────────────
class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    iteration: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="running"
    )  # running, succeeded, failed, skipped
    tier: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # triage, strong, verify
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    reference_cost_usd: Mapped[float] = mapped_column(Numeric(10, 5), default=0.0)
    neatlogs_span_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="agent_runs")
    llm_calls: Mapped[list[LlmCall]] = relationship(
        "LlmCall", back_populates="agent_run", cascade="all, delete-orphan"
    )
    tool_calls: Mapped[list[ToolCall]] = relationship(
        "ToolCall", back_populates="agent_run", cascade="all, delete-orphan"
    )


# ── 4. LLM calls ─────────────────────────────────────────────────────────────
class LlmCall(Base):
    __tablename__ = "llm_calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # ok, rate_limited, provider_error, timeout, json_invalid, repaired
    tokens_in: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reference_cost_usd: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 5), nullable=True
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fallback_of: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("llm_calls.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    agent_run: Mapped[AgentRun] = relationship("AgentRun", back_populates="llm_calls")


# ── 5. Tool calls ────────────────────────────────────────────────────────────
class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False
    )
    tool_name: Mapped[str] = mapped_column(Text, nullable=False)
    args: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    args_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # succeeded, failed, timeout, cached
    exit_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fallback_of: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tool_calls.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    agent_run: Mapped[AgentRun] = relationship("AgentRun", back_populates="tool_calls")


# ── 6. Artifacts ─────────────────────────────────────────────────────────────
class Artifact(Base):
    __tablename__ = "artifacts"

    __table_args__ = (
        UniqueConstraint("analysis_id", "short_id", name="uq_artifacts_analysis_short_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    short_id: Mapped[str] = mapped_column(Text, nullable=False)  # "A-0042"
    kind: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # manifest, permission, component, string, decompiled_method, smali, ioc, yara_match, intel_record, tool_error
    location: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    flags: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    created_by_tool_call: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tool_calls.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="artifacts")


# ── 7. Hypotheses ────────────────────────────────────────────────────────────
class Hypothesis(Base):
    __tablename__ = "hypotheses"

    __table_args__ = (
        UniqueConstraint("analysis_id", "short_id", name="uq_hypotheses_analysis_short_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    short_id: Mapped[str] = mapped_column(Text, nullable=False)  # "H-03"
    category: Mapped[str] = mapped_column(Text, nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    attack_technique: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="proposed"
    )  # proposed, investigating, confirmed, refuted, inconclusive, verified, unsupported
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)
    proposed_by: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=True
    )
    iteration: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="hypotheses")
    evidence_links: Mapped[list[HypothesisEvidence]] = relationship(
        "HypothesisEvidence", back_populates="hypothesis", cascade="all, delete-orphan"
    )
    findings: Mapped[list[Finding]] = relationship("Finding", back_populates="hypothesis")


# ── 8. Hypothesis <-> Evidence ──────────────────────────────────────────────
class HypothesisEvidence(Base):
    __tablename__ = "hypothesis_evidence"

    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hypotheses.id", ondelete="CASCADE"), primary_key=True
    )
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True
    )
    stance: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # supports, contradicts, neutral
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    hypothesis: Mapped[Hypothesis] = relationship("Hypothesis", back_populates="evidence_links")
    artifact: Mapped[Artifact] = relationship("Artifact")


# ── 9. Findings ──────────────────────────────────────────────────────────────
class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    hypothesis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # info, low, medium, high, critical
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    rule_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # R01..R10
    reachability: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # reachable, unreachable, unknown
    verification: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # verified, unsupported, contradicted
    verification_confidence: Mapped[Optional[float]] = mapped_column(
        Numeric(4, 3), nullable=True
    )
    verifier_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_by_run: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="findings")
    hypothesis: Mapped[Optional[Hypothesis]] = relationship("Hypothesis", back_populates="findings")
    evidence_links: Mapped[list[FindingEvidence]] = relationship(
        "FindingEvidence", back_populates="finding", cascade="all, delete-orphan"
    )


class FindingEvidence(Base):
    __tablename__ = "finding_evidence"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True
    )

    finding: Mapped[Finding] = relationship("Finding", back_populates="evidence_links")
    artifact: Mapped[Artifact] = relationship("Artifact")


# ── 10. IOCs ─────────────────────────────────────────────────────────────────
class Ioc(Base):
    __tablename__ = "iocs"

    __table_args__ = (
        UniqueConstraint("analysis_id", "type", "value", name="uq_iocs_analysis_type_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # url, domain, ip, hash, cert
    value: Mapped[str] = mapped_column(Text, nullable=False)
    reputation: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # malicious, suspicious, unknown, no_data
    source: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # local_yara, local_blocklist, virustotal, malwarebazaar
    artifact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=True
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="iocs")


# ── 11. Inter-agent messages ────────────────────────────────────────────────
class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    from_agent: Mapped[str] = mapped_column(Text, nullable=False)
    to_agent: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # handoff, challenge, response, resolution
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="messages")


# ── 12. Score breakdown ──────────────────────────────────────────────────────
class ScoreBreakdown(Base):
    __tablename__ = "score_breakdown"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), primary_key=True
    )
    rule_id: Mapped[str] = mapped_column(Text, primary_key=True)  # R01..R10
    label: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    verification_confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    contribution: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False)
    finding_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("findings.id"), nullable=True
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="score_breakdowns")


# ── 13. Reports ──────────────────────────────────────────────────────────────
class Report(Base):
    __tablename__ = "reports"

    __table_args__ = (
        UniqueConstraint("analysis_id", "kind", name="uq_reports_analysis_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # executive, technical
    markdown: Mapped[str] = mapped_column(Text, nullable=False)
    citation_check: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="reports")


# ── 14. Live event stream ───────────────────────────────────────────────────
class AnalysisEvent(Base):
    __tablename__ = "analysis_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="events")


# ── 15. Evaluation ───────────────────────────────────────────────────────────
class EvalRun(Base):
    __tablename__ = "eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    variant: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # v1_single, v2_multi
    llm_provider: Mapped[str] = mapped_column(Text, nullable=False)
    models: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    git_sha: Mapped[str] = mapped_column(Text, nullable=False)
    neatlogs_project: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    results: Mapped[list[EvalResult]] = relationship(
        "EvalResult", back_populates="eval_run", cascade="all, delete-orphan"
    )


class EvalResult(Base):
    __tablename__ = "eval_results"

    eval_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("eval_runs.id", ondelete="CASCADE"), primary_key=True
    )
    sample_sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    split: Mapped[str] = mapped_column(Text, nullable=False)  # dev, test
    ground_truth: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # benign, malicious
    predicted_verdict: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    total_claims: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unsupported_claims: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    injection_resisted: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    tokens_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reference_cost_usd: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 5), nullable=True
    )
    latency_s: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    trace_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    eval_run: Mapped[EvalRun] = relationship("EvalRun", back_populates="results")


# ── 16. Job queue ────────────────────────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    state: Mapped[str] = mapped_column(
        Text, nullable=False, default="queued"
    )  # queued, claimed, done, failed
    claimed_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    analysis: Mapped[Analysis] = relationship("Analysis", back_populates="jobs")
