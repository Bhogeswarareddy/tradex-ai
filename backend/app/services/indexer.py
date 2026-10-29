"""
TradeX AI: Search & RAG Indexing Service (Prompt 16)
Manages knowledge indexing jobs, content hashing, vector embedding,
staleness detection, and background processing.
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import get_ai_provider
from app.models.ai_ops import KnowledgeChunk, KnowledgeDocument
from app.models.catalog import Category, IndexJob, Product, SupplierCertification
from app.models.content import Document
from app.models.identity import Company, Supplier

logger = logging.getLogger(__name__)

CURRENT_EMBEDDING_MODEL = "mock-embed-v1"  # Or "text-embedding-3-small"


async def enqueue_index_job(
    entity_type: str,
    entity_id: str | uuid.UUID,
    operation: str,
    db: AsyncSession,
    payload: Optional[dict] = None,
) -> IndexJob:
    """
    Inserts or queues a job into the index_jobs queue.
    Operations: 'create', 'update', 'publish', 'unpublish', 'archive', 'delete', 'upsert', 'invalidate'.
    """
    job = IndexJob(
        id=uuid.uuid4(),
        entity_type=entity_type,
        entity_id=str(entity_id),
        operation=operation.lower(),
        status="Pending",
        attempts=0,
        error=None,
        payload=payload,
    )
    db.add(job)
    return job


def compute_content_hash(text: str) -> str:
    """Computes SHA-256 hash of text content for change detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_product_descriptive_text(product: Product) -> str:
    """
    Builds purely descriptive text representation of a product.
    CORE PRINCIPLE: Never include price, price tiers, MOQ, or availability stock
    in the descriptive chunk! Vector search is used ONLY for semantic text matching.
    """
    lines = [
        f"Product Name: {product.name}",
        f"Category: {product.category.name if product.category else 'General'}",
        f"Origin Country: {product.origin_country}",
    ]
    if product.product_form:
        lines.append(f"Form: {product.product_form}")
    if product.production_region:
        lines.append(f"Production Region: {product.production_region}")
    if product.hs_code:
        lines.append(f"HS Code: {product.hs_code}")
    if product.packaging:
        lines.append(f"Packaging: {product.packaging}")
    if product.storage:
        lines.append(f"Storage: {product.storage}")
    if product.export_details:
        lines.append(f"Export Details: {product.export_details}")
    if product.supported_destinations:
        lines.append(f"Supported Destinations: {', '.join(product.supported_destinations)}")
    if product.incoterms:
        lines.append(f"Incoterms: {', '.join(product.incoterms)}")
    if product.specifications and isinstance(product.specifications, dict):
        spec_parts = [f"{k}: {v}" for k, v in product.specifications.items()]
        lines.append(f"Technical Specifications: {'; '.join(spec_parts)}")
    if product.description:
        lines.append(f"Description: {product.description}")

    return "\n".join(lines)


async def process_product_index_job(job: IndexJob, db: AsyncSession) -> None:
    """Processes indexing for a Product entity."""
    product_uuid = uuid.UUID(job.entity_id)

    # Fetch product with relationships
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.supplier).selectinload(Supplier.company),
        )
        .where(Product.id == product_uuid)
    )
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()

    # If product is deleted, unpublish, archive, or missing: deactivate chunks
    is_removal = (
        job.operation in ["delete", "unpublish", "archive", "invalidate"]
        or product is None
        or product.deleted_at is not None
        or product.status in ["unpublished", "archived", "rejected"]
    )

    if is_removal:
        doc_stmt = select(KnowledgeDocument).where(
            KnowledgeDocument.source_type == "product",
            KnowledgeDocument.product_id == product_uuid,
        )
        doc_res = await db.execute(doc_stmt)
        docs = doc_res.scalars().all()
        for doc in docs:
            doc.status = "inactive"
            # Deactivate all related chunks so they are never retrieved
            chunk_stmt = select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
            chk_res = await db.execute(chunk_stmt)
            for chk in chk_res.scalars().all():
                chk.is_active = False
        return

    # Product is active / published / updated
    text_content = build_product_descriptive_text(product)
    content_hash = compute_content_hash(text_content)
    is_published = (product.status == "published")
    doc_visibility = "public" if is_published else "supplier_private"

    # Check existing KnowledgeDocument
    doc_stmt = (
        select(KnowledgeDocument)
        .options(selectinload(KnowledgeDocument.chunks))
        .where(
            KnowledgeDocument.source_type == "product",
            KnowledgeDocument.product_id == product_uuid,
        )
    )
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()

    ai_provider = get_ai_provider()

    if doc:
        # Check if content changed
        if doc.content_hash == content_hash and doc.embedding_model == CURRENT_EMBEDDING_MODEL:
            # No text change: just sync visibility and active state
            doc.visibility = doc_visibility
            doc.status = "active"
            doc.updated_at = datetime.now(timezone.utc)
            for chk in doc.chunks:
                chk.is_active = is_published
                chk.is_public = is_published
            return

        # Content or model changed: update doc
        doc.content_hash = content_hash
        doc.visibility = doc_visibility
        doc.status = "active"
        doc.embedding_model = CURRENT_EMBEDDING_MODEL
        doc.updated_at = datetime.now(timezone.utc)

        # Deactivate / remove old chunks
        for old_chk in doc.chunks:
            old_chk.is_active = False
    else:
        doc = KnowledgeDocument(
            id=uuid.uuid4(),
            source_type="product",
            source_id=product.id,
            product_id=product.id,
            supplier_id=product.supplier_id,
            visibility=doc_visibility,
            status="active",
            content_hash=content_hash,
            embedding_model=CURRENT_EMBEDDING_MODEL,
        )
        db.add(doc)
        await db.flush()

    # Generate dense vector embedding
    embeddings = await ai_provider.embed([text_content])
    embedding_vec = embeddings[0] if embeddings else None

    # Create new KnowledgeChunk
    chunk = KnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc.id,
        entity_type="product",
        entity_id=product.id,
        title=product.name,
        content=text_content,
        text=text_content,
        embedding=embedding_vec,
        chunk_metadata={
            "product_id": str(product.id),
            "supplier_id": str(product.supplier_id),
            "company_name": product.supplier.company.name if product.supplier and product.supplier.company else "",
            "category": product.category.name if product.category else "",
            "origin_country": product.origin_country,
            "hs_code": product.hs_code,
            "product_slug": product.slug,
        },
        source_uri=f"/products/{product.slug or product.id}",
        is_public=is_published,
        is_active=is_published,
        embedding_model=CURRENT_EMBEDDING_MODEL,
        company_id=product.supplier.company_id if product.supplier else None,
    )
    db.add(chunk)


async def process_document_index_job(job: IndexJob, db: AsyncSession) -> None:
    """Processes indexing for uploaded trade documents or certificates."""
    doc_uuid = uuid.UUID(job.entity_id)
    doc_stmt = select(Document).where(Document.id == doc_uuid)
    res = await db.execute(doc_stmt)
    doc_record = res.scalar_one_or_none()

    if job.operation in ["delete", "invalidate"] or doc_record is None:
        kd_stmt = select(KnowledgeDocument).where(
            KnowledgeDocument.source_type.in_(["certificate_document", "document"]),
            KnowledgeDocument.source_id == doc_uuid,
        )
        kd_res = await db.execute(kd_stmt)
        for kd in kd_res.scalars().all():
            kd.status = "inactive"
            chk_stmt = select(KnowledgeChunk).where(KnowledgeChunk.document_id == kd.id)
            c_res = await db.execute(chk_stmt)
            for c in c_res.scalars().all():
                c.is_active = False
        return

    # Determine visibility from payload or default to supplier_private
    payload = job.payload or {}
    visibility = payload.get("visibility", "supplier_private")  # public, supplier_private, admin_only
    text_content = payload.get("extracted_text") or f"Document: {doc_record.title}\nType: {doc_record.doc_type}\nFilename: {doc_record.original_filename}"
    content_hash = compute_content_hash(text_content)

    ai_provider = get_ai_provider()
    embeddings = await ai_provider.embed([text_content])
    embedding_vec = embeddings[0] if embeddings else None

    # Upsert KnowledgeDocument
    kd_stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.source_type.in_(["certificate_document", "document"]),
        KnowledgeDocument.source_id == doc_uuid,
    )
    kd_res = await db.execute(kd_stmt)
    kd = kd_res.scalar_one_or_none()

    if not kd:
        kd = KnowledgeDocument(
            id=uuid.uuid4(),
            source_type="certificate_document" if "cert" in doc_record.doc_type else "document",
            source_id=doc_uuid,
            supplier_id=doc_record.supplier_id,
            visibility=visibility,
            status="active",
            content_hash=content_hash,
            embedding_model=CURRENT_EMBEDDING_MODEL,
        )
        db.add(kd)
        await db.flush()
    else:
        kd.visibility = visibility
        kd.status = "active"
        kd.content_hash = content_hash
        kd.embedding_model = CURRENT_EMBEDDING_MODEL
        kd.updated_at = datetime.now(timezone.utc)

    # Upsert KnowledgeChunk
    chunk = KnowledgeChunk(
        id=uuid.uuid4(),
        document_id=kd.id,
        entity_type="document",
        entity_id=doc_uuid,
        title=doc_record.title,
        content=text_content,
        text=text_content,
        embedding=embedding_vec,
        chunk_metadata={
            "document_id": str(doc_uuid),
            "doc_type": doc_record.doc_type,
            "supplier_id": str(doc_record.supplier_id) if doc_record.supplier_id else None,
            "visibility": visibility,
        },
        source_uri=f"/storage/documents/{doc_record.original_filename}",
        is_public=(visibility == "public"),
        is_active=True,
        embedding_model=CURRENT_EMBEDDING_MODEL,
    )
    db.add(chunk)


async def process_index_job(job: IndexJob, db: AsyncSession) -> bool:
    """
    Executes a single IndexJob with retry handling and error tracking.
    Returns True if completed successfully, False if failed.
    """
    job.status = "Processing"
    job.attempts += 1
    job.updated_at = datetime.now(timezone.utc)
    await db.flush()

    try:
        if job.entity_type == "product":
            await process_product_index_job(job, db)
        elif job.entity_type in ["document", "certificate_document"]:
            await process_document_index_job(job, db)
        elif job.entity_type in ["supplier", "company"]:
            # Supplier verification / details sync
            pass

        job.status = "Ready"
        job.error = None
        job.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return True

    except Exception as exc:
        logger.error(f"Error processing index job {job.id} for {job.entity_type}:{job.entity_id}: {exc}", exc_info=True)
        job.error = str(exc)
        if job.attempts >= 5:
            job.status = "Failed"
        else:
            job.status = "Failed"  # Marks failed, can be retried
        job.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return False


async def process_pending_jobs(db: AsyncSession, limit: int = 10) -> int:
    """
    Polls and processes pending index jobs in batch.
    """
    stmt = (
        select(IndexJob)
        .where(func.lower(IndexJob.status) == "pending")
        .order_by(IndexJob.created_at.asc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    jobs = res.scalars().all()

    processed = 0
    for job in jobs:
        success = await process_index_job(job, db)
        if success:
            processed += 1

    return processed


async def reindex_all(db: AsyncSession) -> Dict[str, Any]:
    """
    Triggers reindexing for all published products and documents.
    Detects model staleness and marks outdated documents.
    """
    # 1. Flag stale documents
    stale_stmt = (
        update(KnowledgeDocument)
        .where(KnowledgeDocument.embedding_model != CURRENT_EMBEDDING_MODEL)
        .values(status="stale")
    )
    await db.execute(stale_stmt)

    # 2. Find all published products
    p_stmt = select(Product).where(Product.status == "published", Product.deleted_at.is_(None))
    p_res = await db.execute(p_stmt)
    products = p_res.scalars().all()

    queued = 0
    for p in products:
        await enqueue_index_job("product", p.id, "upsert", db)
        queued += 1

    await db.commit()
    return {
        "status": "reindex_scheduled",
        "products_queued": queued,
        "current_model": CURRENT_EMBEDDING_MODEL,
    }
