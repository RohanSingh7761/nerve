"""Analyses management and live SSE event streaming API (§15)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import (
    Analysis,
    AnalysisEvent,
    ApkMetadata,
    Job,
    Report,
    ScoreBreakdown,
)
from app.db.session import get_db

logger = logging.getLogger("nerve.api.analyses")
router = APIRouter(prefix="/analyses", tags=["Analyses"])


@router.post("")
async def create_analysis(
    file: UploadFile = File(...),
    variant: str = Form("v2_multi"),
    db: AsyncSession = Depends(get_db),
):
    """Upload an Android APK for multi-agent triage."""
    settings = get_settings()

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    sha256 = hashlib.sha256(content).hexdigest()
    md5 = hashlib.md5(content).hexdigest()
    size_bytes = len(content)

    # Cache check (§6.1): return existing analysis if identical SHA-256 and variant
    stmt = (
        select(Analysis)
        .where(Analysis.sha256 == sha256, Analysis.variant == variant, Analysis.status == "completed")
        .order_by(desc(Analysis.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    cached = result.scalar_one_or_none()
    if cached:
        logger.info("Cache hit for SHA-256: %s", sha256)
        return {
            "analysis_id": str(cached.id),
            "cached": True,
            "status": cached.status,
            "verdict": cached.verdict,
        }

    # Store file safely as <sha256>.sample (non-executable)
    sample_filename = f"{sha256}.sample"
    storage_path = settings.samples_path / sample_filename
    with open(storage_path, "wb") as f:
        f.write(content)

    analysis_id = uuid.uuid4()
    analysis = Analysis(
        id=analysis_id,
        sha256=sha256,
        md5=md5,
        filename=file.filename or "uploaded.apk",
        size_bytes=size_bytes,
        storage_path=str(storage_path),
        status="queued",
        variant=variant,
        llm_provider=settings.llm_provider,
    )
    db.add(analysis)

    # Queue analysis job
    job = Job(analysis_id=analysis_id, state="queued")
    db.add(job)

    await db.commit()
    return {
        "analysis_id": str(analysis_id),
        "cached": False,
        "status": "queued",
        "sha256": sha256,
    }


@router.post("/{analysis_id}/cancel")
async def cancel_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Cancel an active or queued APK triage analysis."""
    analysis = await db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status in {"completed", "failed", "cancelled"}:
        return {"status": analysis.status, "message": f"Analysis already {analysis.status}"}

    analysis.status = "cancelled"

    # Cancel associated queued/claimed jobs
    stmt = select(Job).where(Job.analysis_id == analysis_id, Job.state.in_(["queued", "claimed"]))
    res = await db.execute(stmt)
    jobs = res.scalars().all()
    for j in jobs:
        j.state = "failed"

    # Add cancelled event
    event = AnalysisEvent(
        analysis_id=analysis_id,
        type="analysis_cancelled",
        payload={"message": "Analysis cancelled by user"},
    )
    db.add(event)
    await db.commit()

    return {"status": "cancelled", "analysis_id": str(analysis_id)}


@router.get("")
async def list_analyses(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List recent APK triage analyses."""
    stmt = select(Analysis).order_by(desc(Analysis.created_at)).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "sha256": a.sha256,
            "filename": a.filename,
            "status": a.status,
            "variant": a.variant,
            "verdict": a.verdict,
            "risk_score": float(a.risk_score) if a.risk_score is not None else None,
            "confidence": float(a.confidence) if a.confidence is not None else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in records
    ]


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full status, metadata, verdict, and cost metrics for an analysis."""
    analysis = await db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    meta_stmt = select(ApkMetadata).where(ApkMetadata.analysis_id == analysis_id)
    meta_res = await db.execute(meta_stmt)
    meta = meta_res.scalar_one_or_none()

    return {
        "id": str(analysis.id),
        "sha256": analysis.sha256,
        "md5": analysis.md5,
        "filename": analysis.filename,
        "size_bytes": analysis.size_bytes,
        "status": analysis.status,
        "variant": analysis.variant,
        "verdict": analysis.verdict,
        "risk_score": float(analysis.risk_score) if analysis.risk_score is not None else None,
        "confidence": float(analysis.confidence) if analysis.confidence is not None else None,
        "limited_visibility": analysis.limited_visibility,
        "llm_provider": analysis.llm_provider,
        "total_tokens_in": analysis.total_tokens_in,
        "total_tokens_out": analysis.total_tokens_out,
        "actual_cost_usd": float(analysis.actual_cost_usd),
        "reference_cost_usd": float(analysis.reference_cost_usd),
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "started_at": analysis.started_at.isoformat() if analysis.started_at else None,
        "finished_at": analysis.finished_at.isoformat() if analysis.finished_at else None,
        "error": analysis.error,
        "metadata": {
            "package_name": meta.package_name if meta else None,
            "version_name": meta.version_name if meta else None,
            "is_packed": meta.is_packed if meta else False,
            "packer": meta.packer if meta else None,
            "permissions_count": len(meta.permissions) if meta and meta.permissions else 0,
        } if meta else None,
    }


@router.get("/{analysis_id}/events")
async def get_analysis_events_stream(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Server-Sent Events (SSE) stream of analysis progress and multi-agent events."""

    async def event_generator() -> AsyncGenerator[dict, None]:
        last_event_id = 0
        terminal_statuses = {"completed", "failed", "cancelled"}

        while True:
            # Query new events
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(AnalysisEvent)
                    .where(AnalysisEvent.analysis_id == analysis_id, AnalysisEvent.id > last_event_id)
                    .order_by(AnalysisEvent.id.asc())
                )
                res = await session.execute(stmt)
                events = res.scalars().all()

                for ev in events:
                    last_event_id = ev.id
                    yield {
                        "event": ev.type,
                        "data": json.dumps({
                            "id": ev.id,
                            "type": ev.type,
                            "ts": ev.ts.isoformat(),
                            "payload": ev.payload,
                        }),
                    }

                curr_analysis = await session.get(Analysis, analysis_id)
                if curr_analysis and curr_analysis.status in terminal_statuses:
                    # Final heartbeat event
                    yield {
                        "event": "done",
                        "data": json.dumps({"status": curr_analysis.status}),
                    }
                    break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@router.get("/{analysis_id}/score")
async def get_score_breakdown(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve explainable noisy-OR score breakdown by rule contribution."""
    analysis = await db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    stmt = select(ScoreBreakdown).where(ScoreBreakdown.analysis_id == analysis_id)
    res = await db.execute(stmt)
    records = res.scalars().all()

    return {
        "verdict": analysis.verdict,
        "risk_score": float(analysis.risk_score) if analysis.risk_score is not None else 0.0,
        "confidence": float(analysis.confidence) if analysis.confidence is not None else 0.5,
        "limited_visibility": analysis.limited_visibility,
        "breakdown": [
            {
                "rule_id": b.rule_id,
                "label": b.label,
                "weight": float(b.weight),
                "verification_confidence": float(b.verification_confidence),
                "contribution": float(b.contribution),
            }
            for b in records
        ],
    }


@router.get("/{analysis_id}/reports/{kind}")
async def get_report(
    analysis_id: uuid.UUID,
    kind: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve executive or technical report markdown."""
    stmt = select(Report).where(Report.analysis_id == analysis_id, Report.kind == kind)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report of kind '{kind}' not found")

    return {
        "kind": report.kind,
        "markdown": report.markdown,
        "citation_check": report.citation_check,
    }


@router.get("/{analysis_id}/graph")
async def get_agent_graph_state(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return nodes and edges representing the live agent network for React Flow."""
    analysis = await db.get(Analysis, analysis_id)
    status = analysis.status if analysis else "unknown"

    nodes = [
        {"id": "intake", "data": {"label": "Intake (Deterministic)"}, "position": {"x": 50, "y": 150}},
        {"id": "orchestrator", "data": {"label": "Orchestrator Agent"}, "position": {"x": 250, "y": 150}},
        {"id": "static", "data": {"label": "Static Analysis Agent"}, "position": {"x": 450, "y": 80}},
        {"id": "investigate", "data": {"label": "Reverse Engineering"}, "position": {"x": 650, "y": 80}},
        {"id": "intel", "data": {"label": "Threat Intel Agent"}, "position": {"x": 650, "y": 220}},
        {"id": "verifier", "data": {"label": "Verifier Agent"}, "position": {"x": 850, "y": 150}},
        {"id": "score", "data": {"label": "Risk Scoring"}, "position": {"x": 1050, "y": 150}},
        {"id": "report", "data": {"label": "Report Agent"}, "position": {"x": 1250, "y": 150}},
    ]

    edges = [
        {"id": "e1", "source": "intake", "target": "orchestrator", "animated": status == "running"},
        {"id": "e2", "source": "orchestrator", "target": "static"},
        {"id": "e3", "source": "static", "target": "investigate"},
        {"id": "e4", "source": "static", "target": "intel"},
        {"id": "e5", "source": "investigate", "target": "verifier"},
        {"id": "e6", "source": "intel", "target": "verifier"},
        {"id": "e7", "source": "verifier", "target": "score"},
        {"id": "e8", "source": "score", "target": "report"},
    ]

    return {"nodes": nodes, "edges": edges, "status": status}
