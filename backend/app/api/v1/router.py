from fastapi import APIRouter

from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.ai import router as ai_router
from app.api.v1.routes.ai_search import router as ai_search_router
from app.api.v1.routes.ai_admin import router as ai_admin_router
from app.api.v1.routes.matching import router as matching_router
from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.dashboard import router as dashboard_router
from app.api.v1.routes.documents import router as documents_router
from app.api.v1.routes.messages import router as messages_router
from app.api.v1.routes.orders import router as orders_router
from app.api.v1.routes.products import router as products_router
from app.api.v1.routes.quote_comparison import router as quote_comparison_router
from app.api.v1.routes.communication import router as communication_router
from app.api.v1.routes.quotes import router as quotes_router
from app.api.v1.routes.rfqs import router as rfqs_router
from app.api.v1.routes.saved import router as saved_router
from app.api.v1.routes.shipments import router as shipments_router
from app.api.v1.routes.suppliers import router as suppliers_router
from app.api.v1.routes.supplier_portal import router as supplier_portal_router
from app.api.v1.routes.users import router as users_router
from app.core.config import settings
from app.schemas.health import HealthResponse

api_router = APIRouter()


@api_router.get("/health", response_model=HealthResponse, summary="API v1 Health Check")
async def api_health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.ENV,
        database="ready",
        ai_provider=settings.AI_PROVIDER,
    )


# Mount domain routers
api_router.include_router(dashboard_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(products_router)
api_router.include_router(saved_router)
api_router.include_router(suppliers_router)
api_router.include_router(supplier_portal_router)
api_router.include_router(rfqs_router)
api_router.include_router(quotes_router)
api_router.include_router(quote_comparison_router)
api_router.include_router(communication_router)
api_router.include_router(orders_router)
api_router.include_router(shipments_router)
api_router.include_router(documents_router)
api_router.include_router(messages_router)
api_router.include_router(ai_router)
api_router.include_router(ai_search_router)
api_router.include_router(ai_admin_router)
api_router.include_router(matching_router)
api_router.include_router(analytics_router)
api_router.include_router(admin_router)
