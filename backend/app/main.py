"""FastAPI application entry point for Nerve (§6, §15)."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import get_settings
from app.db.models import Base
from app.db.session import engine
from app.worker import poll_jobs_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nerve.main")

_worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    settings = get_settings()
    from app.obs import init_neatlogs
    init_neatlogs()

    # Ensure samples and artifacts directories exist
    settings.samples_path.mkdir(parents=True, exist_ok=True)
    settings.artifacts_path.mkdir(parents=True, exist_ok=True)

    # Automatically create missing DB tables using async SQLAlchemy metadata
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.warning(
            "Could not connect to database on startup (%s). "
            "Please ensure local PostgreSQL is running.",
            e,
        )

    # Launch embedded worker if configured
    global _worker_task
    if settings.embedded_worker:
        logger.info("Starting embedded background analysis worker...")
        _worker_task = asyncio.create_task(poll_jobs_loop())

    yield

    # Teardown
    if _worker_task:
        logger.info("Stopping embedded worker...")
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass

    await engine.dispose()
    logger.info("Nerve backend shutdown completed.")


app = FastAPI(
    title="Nerve — Agentic Android Malware Triage",
    description="Agentic Android malware triage that statically analyzes APKs and proves every claim with verifiable evidence.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes under /api
app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "service": "Nerve Backend API",
        "version": "0.1.0",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
