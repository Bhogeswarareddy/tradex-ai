from fastapi import APIRouter
from app.core.config import settings
from app.schemas.health import HealthResponse

api_router = APIRouter()


@api_router.get("/health", response_model=HealthResponse, summary="API Health Check")
async def api_health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.ENVIRONMENT,
        database="ready",
        ai_provider=settings.AI_PROVIDER,
    )
