"""Evidence and artifact query API routes (§15)."""

from __future__ import annotations

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Artifact, Finding, Hypothesis, Ioc
from app.db.session import get_db

router = APIRouter(tags=["Evidence & Leads"])


@router.get("/analyses/{analysis_id}/hypotheses")
async def get_hypotheses(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all hypotheses formulated for an analysis."""
    stmt = (
        select(Hypothesis)
        .where(Hypothesis.analysis_id == analysis_id)
        .order_by(Hypothesis.short_id.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": h.short_id,
            "category": h.category,
            "statement": h.statement,
            "attack_technique": h.attack_technique,
            "status": h.status,
            "confidence": float(h.confidence) if h.confidence is not None else 0.5,
            "proposed_by": h.proposed_by,
            "iteration": h.iteration,
        }
        for h in records
    ]


@router.get("/analyses/{analysis_id}/findings")
async def get_findings(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all candidate and verified findings with verification badges."""
    stmt = (
        select(Finding)
        .where(Finding.analysis_id == analysis_id)
        .order_by(Finding.created_at.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    findings_out = []
    for f in records:
        findings_out.append(
            {
                "id": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "claim": f.claim,
                "rule_id": f.rule_id,
                "reachability": f.reachability,
                "verification": f.verification,
                "verification_confidence": (
                    float(f.verification_confidence)
                    if f.verification_confidence is not None
                    else None
                ),
                "verifier_notes": f.verifier_notes,
            }
        )
    return findings_out


@router.get("/analyses/{analysis_id}/iocs")
async def get_iocs(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve extracted IOCs with reputation details."""
    stmt = select(Ioc).where(Ioc.analysis_id == analysis_id)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "type": i.type,
            "value": i.value,
            "reputation": i.reputation,
            "source": i.source,
        }
        for i in records
    ]


@router.get("/artifacts/{short_id}")
async def get_artifact(
    short_id: str,
    analysis_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Evidence Drawer: fetch full content and hash of a citable artifact."""
    stmt = select(Artifact).where(
        Artifact.analysis_id == analysis_id,
        Artifact.short_id == short_id,
    )
    result = await db.execute(stmt)
    art = result.scalar_one_or_none()

    if not art:
        # Also try matching short_id with or without prefix
        alt_id = f"A-{short_id}" if not short_id.startswith("A-") else short_id.replace("A-", "")
        stmt_alt = select(Artifact).where(
            Artifact.analysis_id == analysis_id,
            Artifact.short_id == alt_id,
        )
        result_alt = await db.execute(stmt_alt)
        art = result_alt.scalar_one_or_none()

    if not art:
        raise HTTPException(status_code=404, detail=f"Artifact {short_id} not found")

    return {
        "id": art.short_id,
        "kind": art.kind,
        "location": art.location,
        "content": art.content,
        "content_sha256": art.content_sha256,
        "flags": art.flags,
    }
