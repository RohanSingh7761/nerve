"""Nerve API router registration."""

from fastapi import APIRouter
from app.api.analyses import router as analyses_router
from app.api.config_routes import router as config_router
from app.api.eval import router as eval_router
from app.api.evidence import router as evidence_router

api_router = APIRouter(prefix="/api")
api_router.include_router(analyses_router)
api_router.include_router(config_router)
api_router.include_router(evidence_router)
api_router.include_router(eval_router)

__all__ = ["api_router"]
