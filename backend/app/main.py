from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.schemas.health import HealthResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Cloud-Based B2B Trade and Supplier Discovery Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if isinstance(settings.ALLOWED_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def root_health() -> HealthResponse:
    """Root health probe for container orchestrators and load balancers."""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.ENVIRONMENT,
        database="ready",
        ai_provider=settings.AI_PROVIDER,
    )


# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_STR)
