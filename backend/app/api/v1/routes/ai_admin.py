from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.usage import get_ai_usage_stats
from app.api.deps import get_current_user_optional, require_role
from app.core.database import get_db
from app.models.identity import User

router = APIRouter(prefix="/admin/ai", tags=["Admin AI Telemetry"])


@router.get("/usage")
async def get_admin_ai_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    """
    Returns AI usage telemetry and token counts grouped per feature.
    """
    return await get_ai_usage_stats(db)
