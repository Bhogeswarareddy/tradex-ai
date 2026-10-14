import time
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from contextlib import asynccontextmanager
import logging

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.db import get_db
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.core.metrics import (
    ACTIVE_WS_CONNECTIONS,
    HTTP_ERRORS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_TOTAL,
    get_metrics_response,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

# Initialize structured logging
setup_logging(level="INFO" if settings.ENV != "development" else "DEBUG")

START_TIME = time.time()


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        start = time.time()
        method = request.method
        endpoint = request.url.path
        try:
            response = await call_next(request)
            duration = time.time() - start
            status_code = str(response.status_code)
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
            if response.status_code >= 400:
                error_type = f"{response.status_code // 100}xx"
                HTTP_ERRORS_TOTAL.labels(endpoint=endpoint, error_type=error_type).inc()
            return response
        except Exception as exc:
            duration = time.time() - start
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code="500").inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
            HTTP_ERRORS_TOTAL.labels(endpoint=endpoint, error_type="5xx").inc()
            raise exc


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start Celery-free APScheduler background jobs
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.warning(f"Could not start scheduler: {e}")
    yield
    # Shutdown: Cleanly stop background jobs
    try:
        from app.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Cloud-Based B2B Trade and Supplier Discovery Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# 1. Error Handling (Centralized Standard Error Envelope)
register_error_handlers(app)

# 2. Middlewares (Prometheus Metrics, Security Headers, Request ID, Timing, GZip, CORS)
app.add_middleware(PrometheusMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
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


# Prometheus Metrics Scrape Endpoint
@app.get("/metrics", tags=["Monitoring"], include_in_schema=False)
async def metrics_endpoint():
    """Prometheus exposition format metrics for scrapers."""
    return get_metrics_response()


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

# Also mount /ai-mode at root for direct endpoint calls
from app.api.v1.routes.ai_mode import router as ai_mode_router
app.include_router(ai_mode_router)


# WebSocket /ws Real-Time Handshake (Prompt 15)
from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from app.services.websocket_manager import ws_manager
import json


@app.websocket("/ws")
@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    user_id = "anonymous"
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            sub = payload.get("sub")
            if sub:
                user_id = str(sub)
        except JWTError:
            pass

    await ws_manager.connect(websocket, user_id)
    ACTIVE_WS_CONNECTIONS.inc()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg_json = json.loads(data)
                if msg_json.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ACTIVE_WS_CONNECTIONS.dec()
        ws_manager.disconnect(websocket, user_id)
    except Exception:
        ACTIVE_WS_CONNECTIONS.dec()
        ws_manager.disconnect(websocket, user_id)
