from typing import Any, Dict, List
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_ops import AILog


async def get_ai_usage_stats(session: AsyncSession) -> Dict[str, Any]:
    """Calculate aggregate AI usage metrics grouped by feature."""
    stmt = (
        select(
            AILog.feature_name,
            func.count(AILog.id).label("total_calls"),
            func.sum(AILog.success).label("successful_calls"),
            func.sum(AILog.fallback).label("fallback_calls"),
            func.avg(AILog.latency_ms).label("avg_latency_ms"),
            func.sum(AILog.total_tokens).label("total_tokens"),
            func.sum(AILog.prompt_tokens).label("prompt_tokens"),
            func.sum(AILog.completion_tokens).label("completion_tokens"),
        )
        .group_by(AILog.feature_name)
        .order_by(func.count(AILog.id).desc())
    )

    result = await session.execute(stmt)
    rows = result.all()

    by_feature: List[Dict[str, Any]] = []
    grand_total_calls = 0
    grand_total_tokens = 0
    grand_total_fallbacks = 0

    for r in rows:
        total_calls = r.total_calls or 0
        succ = r.successful_calls or 0
        fb = r.fallback_calls or 0
        tokens = r.total_tokens or 0
        lat = round(float(r.avg_latency_ms or 0.0), 2)

        grand_total_calls += total_calls
        grand_total_tokens += tokens
        grand_total_fallbacks += fb

        by_feature.append({
            "feature_name": r.feature_name,
            "total_calls": total_calls,
            "successful_calls": succ,
            "fallback_calls": fb,
            "success_rate": round((succ / max(1, total_calls)) * 100, 1),
            "fallback_rate": round((fb / max(1, total_calls)) * 100, 1),
            "avg_latency_ms": lat,
            "total_tokens": tokens,
            "prompt_tokens": r.prompt_tokens or 0,
            "completion_tokens": r.completion_tokens or 0,
        })

    # If no calls yet, provide baseline zero telemetry structure
    return {
        "summary": {
            "total_calls": grand_total_calls,
            "total_tokens": grand_total_tokens,
            "total_fallbacks": grand_total_fallbacks,
            "active_features": len(by_feature),
        },
        "features": by_feature,
    }
