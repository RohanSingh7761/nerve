"""Postgres-backed asynchronous analysis worker using SKIP LOCKED job queue (§13, §14)."""

from __future__ import annotations

import asyncio
import logging
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.models import (
    Analysis,
    AnalysisEvent,
    ApkMetadata,
    Artifact,
    Finding,
    FindingEvidence,
    Hypothesis,
    HypothesisEvidence,
    Job,
    Report,
    ScoreBreakdown,
)
from app.db.session import AsyncSessionLocal
from app.graph.build import graph

logger = logging.getLogger("nerve.worker")


async def emit_analysis_event(analysis_id: uuid.UUID, event_type: str, payload: dict) -> None:
    """Publish an event to the analysis_events table for live UI / SSE streaming."""
    try:
        async with AsyncSessionLocal() as session:
            ev = AnalysisEvent(
                analysis_id=analysis_id,
                type=event_type,
                payload=payload,
            )
            session.add(ev)
            await session.commit()
    except Exception as e:
        logger.debug("Failed to emit event %s: %s", event_type, e)


async def process_analysis_job(job_id: int, analysis_id: uuid.UUID) -> None:
    """Execute the multi-agent graph on the analysis job and persist all outputs."""
    settings = get_settings()
    worker_id = f"worker-{uuid.uuid4().hex[:6]}"

    async with AsyncSessionLocal() as session:
        analysis = await session.get(Analysis, analysis_id)
        if not analysis:
            logger.error("Analysis %s not found for job %d", analysis_id, job_id)
            return

        analysis.status = "running"
        analysis.started_at = datetime.now(timezone.utc)
        await session.commit()

    await emit_analysis_event(analysis_id, "analysis_started", {"status": "running"})

    # Setup per-analysis workspace
    workspace_dir = settings.artifacts_path / str(analysis_id)
    workspace_dir.mkdir(parents=True, exist_ok=True)

    try:
        initial_state = {
            "analysis_id": str(analysis_id),
            "sha256": analysis.sha256,
            "apk_path": analysis.storage_path,
            "workspace_dir": str(workspace_dir),
            "apk_meta": {},
            "plan": {"depth": "deep", "prioritized_hypotheses": []},
            "budget": {
                "max_tokens": settings.nerve_max_tokens,
                "tokens_used": 0,
                "max_iterations": settings.nerve_max_iterations,
            },
            "iteration": 0,
            "hypotheses": [],
            "artifacts": [],
            "findings": [],
            "messages": [],
            "score": None,
            "reports": None,
        }

        # Check if cancelled before starting
        async with AsyncSessionLocal() as session:
            chk = await session.get(Analysis, analysis_id)
            if chk and chk.status == "cancelled":
                logger.info("Analysis %s was cancelled before start", analysis_id)
                return

        # Run the multi-agent LangGraph workflow with Neatlogs tracing
        logger.info("Executing LangGraph for analysis %s", analysis_id)
        try:
            import neatlogs
            with neatlogs.trace(name=f"triage-{analysis.sha256[:8]}", kind="WORKFLOW"):
                final_state = await graph.ainvoke(
                    initial_state,
                    config={"configurable": {"thread_id": str(analysis_id)}},
                )
            neatlogs.flush()
        except ImportError:
            final_state = await graph.ainvoke(
                initial_state,
                config={"configurable": {"thread_id": str(analysis_id)}},
            )

        # Check if cancelled mid-run
        async with AsyncSessionLocal() as session:
            chk = await session.get(Analysis, analysis_id)
            if chk and chk.status == "cancelled":
                logger.info("Analysis %s cancelled during run; discarding partial state", analysis_id)
                return

        # Extract and persist all results
        meta_data = final_state.get("apk_meta", {})
        score_data = final_state.get("score", {})
        reports_data = final_state.get("reports", {})
        artifacts_data = final_state.get("artifacts", [])
        hypotheses_data = final_state.get("hypotheses", [])
        findings_data = final_state.get("findings", [])

        async with AsyncSessionLocal() as session:
            # 1. Update Analysis row
            curr_analysis = await session.get(Analysis, analysis_id)
            if curr_analysis:
                curr_analysis.status = "completed"
                curr_analysis.verdict = score_data.get("verdict", "low_risk")
                curr_analysis.risk_score = score_data.get("risk_score", 0.0)
                curr_analysis.confidence = score_data.get("confidence", 0.5)
                curr_analysis.limited_visibility = score_data.get("limited_visibility", False)
                curr_analysis.finished_at = datetime.now(timezone.utc)
                curr_analysis.llm_provider = settings.llm_provider

            # 2. Persist APK Metadata
            apk_meta_record = ApkMetadata(
                analysis_id=analysis_id,
                package_name=meta_data.get("package_name"),
                version_name=meta_data.get("version_name"),
                version_code=meta_data.get("version_code"),
                min_sdk=meta_data.get("min_sdk"),
                target_sdk=meta_data.get("target_sdk"),
                signing_cert_sha256=meta_data.get("signing_cert_sha256"),
                is_packed=meta_data.get("is_packed", False),
                packer=meta_data.get("packer"),
                obfuscators=meta_data.get("obfuscators", []),
                permissions=meta_data.get("permissions", []),
                components=meta_data.get("components", {}),
            )
            session.add(apk_meta_record)

            # 3. Persist Artifacts
            art_db_map = {}
            for a in artifacts_data:
                db_art = Artifact(
                    analysis_id=analysis_id,
                    short_id=a.id,
                    kind=a.kind,
                    location=a.location,
                    content=a.content,
                    content_sha256=a.content_sha256,
                    flags=a.flags,
                )
                session.add(db_art)
                art_db_map[a.id] = db_art

            # 4. Persist Hypotheses
            hyp_db_map = {}
            for h in hypotheses_data:
                db_hyp = Hypothesis(
                    analysis_id=analysis_id,
                    short_id=h.id,
                    category=h.category,
                    statement=h.statement,
                    attack_technique=h.attack_technique,
                    status=h.status,
                    confidence=h.confidence,
                    proposed_by=h.proposed_by,
                    iteration=h.iteration,
                )
                session.add(db_hyp)
                hyp_db_map[h.id] = db_hyp

            # 5. Persist Findings
            for f in findings_data:
                db_finding = Finding(
                    analysis_id=analysis_id,
                    title=f.title,
                    severity=f.severity,
                    claim=f.claim,
                    rule_id=f.rule_id,
                    reachability=f.reachability,
                    verification=f.verification,
                    verification_confidence=f.verification_confidence,
                    verifier_notes=f.verifier_notes,
                )
                session.add(db_finding)

            # 6. Persist Score Breakdown
            for b in score_data.get("breakdown", []):
                db_breakdown = ScoreBreakdown(
                    analysis_id=analysis_id,
                    rule_id=b["rule_id"],
                    label=b["label"],
                    weight=b["weight"],
                    verification_confidence=b["verification_confidence"],
                    contribution=b["contribution"],
                )
                session.add(db_breakdown)

            # 7. Persist Reports
            if reports_data:
                session.add(
                    Report(
                        analysis_id=analysis_id,
                        kind="executive",
                        markdown=reports_data.get("executive", ""),
                        citation_check=reports_data.get("citation_metrics"),
                    )
                )
                session.add(
                    Report(
                        analysis_id=analysis_id,
                        kind="technical",
                        markdown=reports_data.get("technical", ""),
                        citation_check=reports_data.get("citation_metrics"),
                    )
                )

            # Mark job done
            curr_job = await session.get(Job, job_id)
            if curr_job:
                curr_job.state = "done"

            await session.commit()

        await emit_analysis_event(
            analysis_id,
            "analysis_completed",
            {
                "verdict": score_data.get("verdict"),
                "risk_score": score_data.get("risk_score"),
                "confidence": score_data.get("confidence"),
            },
        )
        logger.info("Analysis %s completed successfully", analysis_id)

    except Exception as exc:
        err_msg = f"{exc}\n{traceback.format_exc()}"
        logger.error("Error processing analysis %s: %s", analysis_id, err_msg)
        async with AsyncSessionLocal() as session:
            curr_analysis = await session.get(Analysis, analysis_id)
            if curr_analysis:
                curr_analysis.status = "failed"
                curr_analysis.error = str(exc)
            curr_job = await session.get(Job, job_id)
            if curr_job:
                curr_job.state = "failed"
            await session.commit()

        await emit_analysis_event(
            analysis_id, "analysis_failed", {"error": str(exc)}
        )


async def poll_jobs_loop() -> None:
    """Continuously poll for queued jobs using SKIP LOCKED and process them."""
    worker_id = f"worker-{uuid.uuid4().hex[:6]}"
    logger.info("Starting background worker %s", worker_id)

    # Clean up any stale/orphaned jobs left over from previous process termination
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Job)
                .where(Job.state == "claimed")
                .values(state="failed")
            )
            await session.execute(
                update(Analysis)
                .where(Analysis.status.in_(["running", "queued"]))
                .values(status="failed", error="Interrupted by server restart")
            )
            await session.commit()
    except Exception as e:
        logger.debug("Stale jobs cleanup warning: %s", e)

    while True:
        try:
            async with AsyncSessionLocal() as session:
                # SELECT * FROM jobs WHERE state = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
                stmt = (
                    select(Job)
                    .where(Job.state == "queued")
                    .order_by(Job.id.asc())
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if job:
                    job.state = "claimed"
                    job.claimed_by = worker_id
                    job.claimed_at = datetime.now(timezone.utc)
                    await session.commit()

                    job_id = job.id
                    analysis_id = job.analysis_id
                else:
                    job_id = None
                    analysis_id = None

            if job_id and analysis_id:
                await process_analysis_job(job_id, analysis_id)
            else:
                await asyncio.sleep(1.0)

        except asyncio.CancelledError:
            logger.info("Worker loop cancelled")
            break
        except Exception as e:
            logger.warning("Worker loop error: %s", e)
            await asyncio.sleep(2.0)
