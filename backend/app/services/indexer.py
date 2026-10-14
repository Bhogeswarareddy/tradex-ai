"""
TradeX AI: Search & RAG Indexing Queue Service (Prompt 15 / Prompt 16 Hook)
"""
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import IndexJob


async def enqueue_index_job(
    entity_type: str,
    entity_id: str | uuid.UUID,
    operation: str,
    db: AsyncSession,
    payload: Optional[dict] = None,
) -> IndexJob:
    """
    Inserts a job into the index_jobs queue for background or live embedding / search indexing.
    Operations: 'create', 'update', 'publish', 'unpublish', 'archive', 'delete'.
    """
    job = IndexJob(
        id=uuid.uuid4(),
        entity_type=entity_type,
        entity_id=str(entity_id),
        operation=operation,
        status="pending",
        payload=payload,
    )
    db.add(job)
    return job
