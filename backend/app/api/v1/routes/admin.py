import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.core.db import get_db
from app.core.errors import BadRequestError, NotFoundError
from app.models.ai_ops import AuditLog, SystemSetting
from app.models.catalog import IndexJob, Product
from app.services.indexer import CURRENT_EMBEDDING_MODEL, process_index_job, reindex_all
from app.models.content import Document
from app.models.identity import Buyer, Company, Supplier, User
from app.models.trade import Order, RFQ

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserUpdateRoleStatusRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None


class VerificationActionRequest(BaseModel):
    action: str  # approve, reject, request_info
    notes: Optional[str] = None


class SystemSettingRequest(BaseModel):
    key: str
    value: Dict[str, Any]
    description: Optional[str] = None


@router.get("/status")
async def admin_status():
    return {"module": "admin", "status": "initialized"}


# ---------------------------------------------------------------------------
# 1. Overview Dashboard Metrics
# ---------------------------------------------------------------------------

@router.get("/overview")
async def get_admin_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    orders_count = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    trade_vol = (await db.execute(select(func.sum(Order.total_amount)))).scalar() or 0.0
    pending_verif = (
        await db.execute(
            select(func.count(Company.id)).where(Company.verified_status == "pending")
        )
    ).scalar() or 0

    return {
        "total_users": users_count,
        "total_orders": orders_count,
        "cumulative_trade_value_eur": float(trade_vol),
        "pending_supplier_verifications": pending_verif,
        "system_status": "operational",
        "last_health_check": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# 2. User Directory & Role/Status Management
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_admin_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = select(User).options(
        selectinload(User.buyers),
        selectinload(User.suppliers),
    )
    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))

    q = q.order_by(desc(User.created_at)).limit(limit).offset(offset)
    res = await db.execute(q)
    users = res.scalars().all()

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "email_verified": u.email_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user_status_or_role(
    user_id: uuid.UUID,
    payload: UserUpdateRoleStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise NotFoundError("User not found")

    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.role is not None:
        if payload.role not in ["buyer", "supplier", "admin"]:
            raise BadRequestError("Invalid role. Must be 'buyer', 'supplier', or 'admin'")
        target.role = payload.role

    # Append audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_USER",
        entity_type="user",
        entity_id=str(target.id),
        details={"is_active": target.is_active, "role": target.role},
    )
    db.add(audit)
    await db.commit()

    return {
        "id": str(target.id),
        "email": target.email,
        "role": target.role,
        "is_active": target.is_active,
        "message": "User updated successfully",
    }


# ---------------------------------------------------------------------------
# 3. Supplier Verification Queue (Side-by-Side Docs & Moderation)
# ---------------------------------------------------------------------------

@router.get("/verification-queue")
async def get_verification_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = (
        select(Company)
        .where(Company.verified_status.in_(["pending", "unverified"]))
        .options(selectinload(Company.suppliers).selectinload(Supplier.user))
        .order_by(desc(Company.created_at))
    )
    res = await db.execute(stmt)
    companies = res.scalars().all()

    queue_items = []
    for comp in companies:
        supp = comp.suppliers[0] if comp.suppliers else None
        supp_id = supp.id if supp else None
        # Fetch linked documents
        docs = []
        if supp_id:
            docs_res = await db.execute(
                select(Document).where(Document.supplier_id == supp_id)
            )
            docs = docs_res.scalars().all()

        queue_items.append({
            "company_id": str(comp.id),
            "company_name": comp.name,
            "country": comp.country,
            "city": comp.city,
            "years_in_business": comp.years_in_business,
            "verified_status": comp.verified_status,
            "supplier_id": str(supp_id) if supp_id else None,
            "contact_email": supp.user.email if (supp and supp.user) else None,
            "documents": [
                {
                    "id": str(d.id),
                    "title": d.title,
                    "doc_type": d.doc_type,
                    "status": d.status,
                    "file_path": d.file_path,
                }
                for d in docs
            ],
        })

    return queue_items


@router.post("/verification/{company_id}/decision")
async def decide_verification(
    company_id: uuid.UUID,
    payload: VerificationActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(Company).where(Company.id == company_id)
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise NotFoundError("Company not found")

    if payload.action not in ["approve", "reject", "request_info"]:
        raise BadRequestError("Action must be 'approve', 'reject', or 'request_info'")

    if payload.action == "approve":
        company.verified_status = "verified"
    elif payload.action == "reject":
        company.verified_status = "rejected"
    else:
        company.verified_status = "pending_info"

    # Also update any linked documents to verified if approved
    supp_res = await db.execute(select(Supplier).where(Supplier.company_id == company.id))
    suppliers = supp_res.scalars().all()
    for s in suppliers:
        if payload.action == "approve":
            s.trust_score = 4.8
        doc_status = "verified" if payload.action == "approve" else ("rejected" if payload.action == "reject" else "needs_review")
        await db.execute(
            update(Document)
            .where(Document.supplier_id == s.id)
            .values(status=doc_status)
        )

    # Append audit trail
    audit = AuditLog(
        user_id=current_user.id,
        action=f"VERIFICATION_{payload.action.upper()}",
        entity_type="company",
        entity_id=str(company.id),
        details={"status": company.verified_status, "notes": payload.notes},
    )
    db.add(audit)
    await db.commit()

    return {
        "company_id": str(company.id),
        "status": company.verified_status,
        "message": f"Supplier verification action '{payload.action}' completed successfully",
    }


# ---------------------------------------------------------------------------
# 4. Audit Log Viewer with CSV Export
# ---------------------------------------------------------------------------

@router.get("/audit-logs")
async def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = select(AuditLog)
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)

    q = q.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
    res = await db.execute(q)
    logs = res.scalars().all()

    return [
        {
            "id": str(l.id),
            "user_id": str(l.user_id) if l.user_id else None,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/audit-logs/export")
async def export_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(500)
    res = await db.execute(q)
    logs = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "User ID", "Action", "Entity Type", "Entity ID", "Timestamp"])
    for l in logs:
        writer.writerow([
            str(l.id),
            str(l.user_id or "System"),
            l.action,
            l.entity_type,
            l.entity_id or "",
            l.created_at.isoformat() if l.created_at else "",
        ])

    return StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="admin_audit_logs.csv"'},
    )


# ---------------------------------------------------------------------------
# 5. System Settings Configuration
# ---------------------------------------------------------------------------

@router.get("/settings")
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    res = await db.execute(select(SystemSetting))
    settings = res.scalars().all()
    return [
        {"key": s.key, "value": s.value, "description": s.description}
        for s in settings
    ]


@router.post("/settings")
async def update_system_setting(
    payload: SystemSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(SystemSetting).where(SystemSetting.key == payload.key)
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()

    if not setting:
        setting = SystemSetting(
            key=payload.key,
            value=payload.value,
            description=payload.description,
        )
        db.add(setting)
    else:
        setting.value = payload.value
        if payload.description:
            setting.description = payload.description

    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_SETTING",
        entity_type="system_setting",
        entity_id=payload.key,
        details=payload.value,
    )
    db.add(audit)
    await db.commit()

    return {"key": setting.key, "value": setting.value, "status": "saved"}


# ---------------------------------------------------------------------------
# 6. Product & RFQ Moderation
# ---------------------------------------------------------------------------

class ModerationActionRequest(BaseModel):
    action: str  # approve, flag, suspend, close
    reason: Optional[str] = None


@router.get("/moderation/products")
async def list_products_for_moderation(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.supplier).selectinload(Supplier.company))
        .order_by(desc(Product.created_at))
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    products = res.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "origin_country": p.origin_country,
            "is_active": p.is_active,
            "supplier_name": p.supplier.company.name if p.supplier and p.supplier.company else "Unknown",
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]


@router.post("/moderation/products/{product_id}/action")
async def moderate_product(
    product_id: uuid.UUID,
    payload: ModerationActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    if payload.action not in ["approve", "flag", "suspend"]:
        raise BadRequestError("Action must be 'approve', 'flag', or 'suspend'")

    if payload.action == "suspend":
        product.is_active = False
    elif payload.action == "approve":
        product.is_active = True

    audit = AuditLog(
        user_id=current_user.id,
        action=f"MODERATE_PRODUCT_{payload.action.upper()}",
        entity_type="product",
        entity_id=str(product.id),
        details={"action": payload.action, "reason": payload.reason, "is_active": product.is_active},
    )
    db.add(audit)
    await db.commit()

    return {"product_id": str(product.id), "status": payload.action, "is_active": product.is_active}


# --- Prompt 15: Product Approval Workflow Endpoints ---

class AdminProductRejectRequest(BaseModel):
    reason: str
    admin_notes: Optional[str] = None


@router.get("/products")
async def list_admin_products(
    status: Optional[str] = Query(None, description="Filter products by status, e.g. pending_review"),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = (
        select(Product)
        .options(
            selectinload(Product.supplier).selectinload(Supplier.company),
            selectinload(Product.category),
            selectinload(Product.price_tiers),
        )
        .order_by(desc(Product.created_at))
        .limit(limit)
        .offset(offset)
    )
    if status:
        query = query.where(Product.status == status)

    res = await db.execute(query)
    products = res.scalars().all()

    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "category_name": p.category.name if p.category else "General",
            "supplier_id": str(p.supplier_id),
            "supplier_name": p.supplier.company.name if p.supplier and p.supplier.company else "Unknown",
            "origin_country": p.origin_country,
            "moq": p.moq,
            "unit": p.unit,
            "status": p.status,
            "is_active": p.is_active,
            "rejection_reason": p.rejection_reason,
            "admin_notes": p.admin_notes,
            "price_confirmed_at": p.price_confirmed_at.isoformat() if p.price_confirmed_at else None,
            "inventory_confirmed_at": p.inventory_confirmed_at.isoformat() if p.inventory_confirmed_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "price_tiers": [
                {
                    "min_qty": pt.min_qty,
                    "max_qty": pt.max_qty,
                    "unit_price": float(pt.unit_price),
                    "currency": pt.currency,
                }
                for pt in p.price_tiers
            ],
        }
        for p in products
    ]


@router.post("/products/{id}/approve")
async def approve_admin_product(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(Product).where(Product.id == id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    product.status = "published"
    product.is_active = True
    product.rejection_reason = None
    product.updated_at = datetime.now(timezone.utc)

    # Audited
    audit = AuditLog(
        user_id=current_user.id,
        action="PRODUCT_APPROVED",
        entity_type="product",
        entity_id=str(product.id),
        details={"status": "published", "is_active": True},
    )
    db.add(audit)

    # Search / RAG index hook
    from app.services.indexer import enqueue_index_job
    await enqueue_index_job("product", product.id, "publish", db)

    await db.commit()
    await db.refresh(product)
    return {
        "id": str(product.id),
        "status": product.status,
        "is_active": product.is_active,
        "message": "Product approved and published successfully",
    }


@router.post("/products/{id}/reject")
async def reject_admin_product(
    id: uuid.UUID,
    payload: AdminProductRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not payload.reason or not payload.reason.strip():
        raise BadRequestError("Rejection reason is required")

    stmt = select(Product).where(Product.id == id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    product.status = "rejected"
    product.is_active = False
    product.rejection_reason = payload.reason.strip()
    if payload.admin_notes:
        product.admin_notes = payload.admin_notes.strip()
    product.updated_at = datetime.now(timezone.utc)

    # Audited
    audit = AuditLog(
        user_id=current_user.id,
        action="PRODUCT_REJECTED",
        entity_type="product",
        entity_id=str(product.id),
        details={"status": "rejected", "reason": payload.reason, "admin_notes": payload.admin_notes},
    )
    db.add(audit)

    # Search / RAG index hook
    from app.services.indexer import enqueue_index_job
    await enqueue_index_job("product", product.id, "unpublish", db)

    await db.commit()
    await db.refresh(product)
    return {
        "id": str(product.id),
        "status": product.status,
        "rejection_reason": product.rejection_reason,
        "is_active": product.is_active,
        "message": "Product rejected successfully",
    }


@router.get("/moderation/rfqs")
async def list_rfqs_for_moderation(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = (
        select(RFQ)
        .options(selectinload(RFQ.buyer).selectinload(Buyer.company))
        .order_by(desc(RFQ.created_at))
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    rfqs = res.scalars().all()
    return [
        {
            "id": str(r.id),
            "rfq_number": r.rfq_number,
            "title": r.title,
            "status": r.status,
            "quantity": r.quantity,
            "unit": r.unit,
            "buyer_name": r.buyer.company.name if r.buyer and r.buyer.company else "Unknown",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rfqs
    ]


@router.post("/moderation/rfqs/{rfq_id}/action")
async def moderate_rfq(
    rfq_id: uuid.UUID,
    payload: ModerationActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(RFQ).where(RFQ.id == rfq_id)
    res = await db.execute(stmt)
    rfq = res.scalar_one_or_none()
    if not rfq:
        raise NotFoundError("RFQ not found")

    if payload.action not in ["approve", "flag", "close"]:
        raise BadRequestError("Action must be 'approve', 'flag', or 'close'")

    if payload.action == "close":
        rfq.status = "closed"
    elif payload.action == "approve":
        rfq.status = "active"
    elif payload.action == "flag":
        rfq.status = "flagged"

    audit = AuditLog(
        user_id=current_user.id,
        action=f"MODERATE_RFQ_{payload.action.upper()}",
        entity_type="rfq",
        entity_id=str(rfq.id),
        details={"action": payload.action, "reason": payload.reason, "status": rfq.status},
    )
    db.add(audit)
    await db.commit()

    return {"rfq_id": str(rfq.id), "status": rfq.status}


# ---------------------------------------------------------------------------
# 7. Document Review Queue
# ---------------------------------------------------------------------------

class DocumentDecisionRequest(BaseModel):
    action: str  # verify, reject
    notes: Optional[str] = None


@router.get("/documents/review-queue")
async def get_document_review_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = (
        select(Document)
        .where(Document.status.in_(["uploaded", "needs_review", "processing"]))
        .options(selectinload(Document.user))
        .order_by(desc(Document.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    docs = res.scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "original_filename": d.original_filename,
            "doc_type": d.doc_type,
            "status": d.status,
            "file_path": d.file_path,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "uploaded_by": d.user.email if d.user else "Unknown",
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.post("/documents/{doc_id}/decision")
async def decide_document_review(
    doc_id: uuid.UUID,
    payload: DocumentDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(Document).where(Document.id == doc_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")

    if payload.action not in ["verify", "reject"]:
        raise BadRequestError("Action must be 'verify' or 'reject'")

    doc.status = "verified" if payload.action == "verify" else "rejected"

    audit = AuditLog(
        user_id=current_user.id,
        action=f"DOCUMENT_{payload.action.upper()}",
        entity_type="document",
        entity_id=str(doc.id),
        details={"status": doc.status, "notes": payload.notes},
    )
    db.add(audit)
    await db.commit()

    return {"document_id": str(doc.id), "status": doc.status, "message": f"Document marked as {doc.status}"}


# ---------------------------------------------------------------------------
# 8. Reported Accounts and Issues
# ---------------------------------------------------------------------------

class ReportActionRequest(BaseModel):
    action: str  # dismiss, suspend_target
    notes: Optional[str] = None


@router.get("/reports")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = (
        select(AuditLog)
        .where(AuditLog.entity_type.in_(["report", "reported_account", "issue"]))
        .order_by(desc(AuditLog.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    reports = res.scalars().all()
    return [
        {
            "id": str(r.id),
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]


@router.post("/reports/{report_id}/action")
async def take_report_action(
    report_id: uuid.UUID,
    payload: ReportActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(AuditLog).where(AuditLog.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise NotFoundError("Report not found")

    if payload.action not in ["dismiss", "suspend_target"]:
        raise BadRequestError("Action must be 'dismiss' or 'suspend_target'")

    if payload.action == "suspend_target" and report.entity_id:
        try:
            target_user_id = uuid.UUID(report.entity_id)
            u_stmt = select(User).where(User.id == target_user_id)
            target_user = (await db.execute(u_stmt)).scalar_one_or_none()
            if target_user:
                target_user.is_active = False
        except ValueError:
            pass

    audit = AuditLog(
        user_id=current_user.id,
        action=f"REPORT_{payload.action.upper()}",
        entity_type="report_action",
        entity_id=str(report.id),
        details={"action": payload.action, "notes": payload.notes},
    )
    db.add(audit)
    await db.commit()

    return {"report_id": str(report.id), "action": payload.action, "status": "resolved"}


# ---------------------------------------------------------------------------
# 9. Matching-Score Weights Configuration
# ---------------------------------------------------------------------------

class MatchingWeightsRequest(BaseModel):
    price: Optional[float] = None
    lead_time: Optional[float] = None
    rating: Optional[float] = None
    compliance: Optional[float] = None
    capacity: Optional[float] = None
    weights: Optional[Dict[str, float]] = None


@router.get("/matching/weights")
async def get_matching_weights_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    stmt = select(SystemSetting).where(SystemSetting.key == "matching_weights")
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()
    default_weights = {
        "price": 0.35,
        "lead_time": 0.25,
        "rating": 0.20,
        "compliance": 0.10,
        "capacity": 0.10,
    }
    return setting.value if setting else default_weights


@router.put("/matching/weights")
async def update_matching_weights_config(
    payload: MatchingWeightsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if payload.weights:
        weights_dict = payload.weights
    else:
        weights_dict = {
            "price": payload.price if payload.price is not None else 0.35,
            "lead_time": payload.lead_time if payload.lead_time is not None else 0.25,
            "rating": payload.rating if payload.rating is not None else 0.20,
            "compliance": payload.compliance if payload.compliance is not None else 0.10,
            "capacity": payload.capacity if payload.capacity is not None else 0.10,
        }

    total = sum(weights_dict.values())
    if abs(total - 1.0) > 0.01:
        raise BadRequestError(f"Matching weights must sum to 1.0 (currently {round(total, 2)})")

    stmt = select(SystemSetting).where(SystemSetting.key == "matching_weights")
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()

    if not setting:
        setting = SystemSetting(
            key="matching_weights",
            value=weights_dict,
            description="Algorithmic weights for B2B supplier matching ranking",
        )
        db.add(setting)
    else:
        setting.value = weights_dict

    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_MATCHING_WEIGHTS",
        entity_type="system_setting",
        entity_id="matching_weights",
        details=weights_dict,
    )
    db.add(audit)
    await db.commit()

    return {"weights": setting.value, "status": "updated"}


# ---------------------------------------------------------------------------
# 11. Admin MFA Setup & Verification
# ---------------------------------------------------------------------------

class MfaVerifyRequest(BaseModel):
    totp_code: str


@router.post("/mfa/setup")
async def setup_admin_mfa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import pyotp
    secret = pyotp.random_base32()
    current_user.mfa_secret = secret
    db.add(current_user)
    await db.commit()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="TradeX Admin Portal",
    )

    # Generate 5 recovery codes
    import secrets
    recovery_codes = [secrets.token_hex(4).upper() for _ in range(5)]

    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "recovery_codes": recovery_codes,
        "message": "Scan provisioning URI or enter secret in Authenticator app, then verify code",
    }


@router.post("/mfa/verify")
async def verify_admin_mfa(
    payload: MfaVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import pyotp
    if not current_user.mfa_secret:
        raise BadRequestError("MFA setup not initialized. Call /api/v1/admin/mfa/setup first.")

    totp = pyotp.TOTP(current_user.mfa_secret)
    if not totp.verify(payload.totp_code, valid_window=1):
        raise BadRequestError("Invalid TOTP verification code")

    current_user.mfa_enabled = True
    audit = AuditLog(
        user_id=current_user.id,
        action="ENABLE_MFA",
        entity_type="user",
        entity_id=str(current_user.id),
        details={"status": "mfa_enabled"},
    )
    db.add(audit)
    db.add(current_user)
    await db.commit()

    return {"status": "mfa_enabled", "message": "MFA has been successfully verified and activated."}


# ---------------------------------------------------------------------------
# 12. Knowledge Indexing & Search Administration (Prompt 16)
# ---------------------------------------------------------------------------

@router.get("/indexing/jobs")
async def list_indexing_jobs(
    status: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Lists indexing jobs with optional filtering by status and entity_type."""
    query = select(IndexJob)
    count_query = select(func.count(IndexJob.id))

    if status:
        query = query.where(func.lower(IndexJob.status) == status.lower())
        count_query = count_query.where(func.lower(IndexJob.status) == status.lower())
    if entity_type:
        query = query.where(func.lower(IndexJob.entity_type) == entity_type.lower())
        count_query = count_query.where(func.lower(IndexJob.entity_type) == entity_type.lower())

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(IndexJob.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    jobs = res.scalars().all()

    # Aggregate status counts
    stats_query = select(IndexJob.status, func.count(IndexJob.id)).group_by(IndexJob.status)
    stats_res = await db.execute(stats_query)
    stats_dict = {row[0]: row[1] for row in stats_res.all()}

    return {
        "items": [
            {
                "id": str(j.id),
                "entity_type": j.entity_type,
                "entity_id": j.entity_id,
                "operation": j.operation,
                "status": j.status,
                "attempts": j.attempts,
                "error": j.error,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "stats": {
            "pending": stats_dict.get("Pending", 0) + stats_dict.get("pending", 0),
            "processing": stats_dict.get("Processing", 0) + stats_dict.get("processing", 0),
            "ready": stats_dict.get("Ready", 0) + stats_dict.get("ready", 0),
            "failed": stats_dict.get("Failed", 0) + stats_dict.get("failed", 0),
        },
    }


@router.post("/indexing/jobs/{id}/retry")
async def retry_indexing_job(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Resets attempts and error for a failed job and marks it Pending for immediate execution."""
    try:
        job_uuid = uuid.UUID(id)
    except ValueError:
        raise NotFoundError("Index job not found")

    res = await db.execute(select(IndexJob).where(IndexJob.id == job_uuid))
    job = res.scalar_one_or_none()
    if not job:
        raise NotFoundError("Index job not found")

    job.status = "Pending"
    job.attempts = 0
    job.error = None
    job.updated_at = datetime.now(timezone.utc)
    db.add(job)
    await db.commit()

    # Process immediately
    await process_index_job(job, db)

    return {
        "id": str(job.id),
        "status": job.status,
        "attempts": job.attempts,
        "error": job.error,
        "message": f"Job reset and executed with status: {job.status}",
    }


@router.post("/indexing/reindex")
async def trigger_reindexing(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Reindexes published products and flags documents with stale embedding models."""
    result = await reindex_all(db)
    return result

