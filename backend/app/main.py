import time
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.db import get_db
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import RequestIDMiddleware

# Initialize structured logging
setup_logging(level="INFO" if settings.ENV != "development" else "DEBUG")

START_TIME = time.time()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Cloud-Based B2B Trade and Supplier Discovery Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# 1. Error Handling (Centralized Standard Error Envelope)
register_error_handlers(app)

# 2. Middlewares (Request ID, Timing, GZip, CORS)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)


@app.get("/api/health", tags=["Health"], summary="Comprehensive System Health Check")
async def health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Health check validating database connectivity, application version, and uptime."""
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"disconnected: {str(exc)}"

    uptime_seconds = round(time.time() - START_TIME, 2)

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": "0.1.0",
        "environment": settings.ENV,
        "database": db_status,
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ai_provider": settings.AI_PROVIDER,
    }


@app.get("/api/ready", tags=["Health"], summary="Readiness Probe")
async def readiness_probe(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Readiness probe for Kubernetes / Docker orchestrators."""
    try:
        await db.execute(text("SELECT 1"))
        return JSONResponse(status_code=status.HTTP_200_OK, content={"ready": True})
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "reason": "Database connection unavailable"},
        )


# Backward-compatible root health probe
@app.get("/health", tags=["Health"])
async def root_health():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.ENV,
        "ai_provider": settings.AI_PROVIDER,
    }


# Mount versioned API routes (/api/v1)
app.include_router(api_router, prefix=settings.API_V1_STR)
