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
from app.models.content import Document
from app.models.identity import Company, Supplier, User
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
    action: str  # approve, reject
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

    if payload.action not in ["approve", "reject"]:
        raise BadRequestError("Action must be 'approve' or 'reject'")

    company.verified_status = "verified" if payload.action == "approve" else "rejected"

    # Also update any linked documents to verified if approved
    supp_res = await db.execute(select(Supplier).where(Supplier.company_id == company.id))
    suppliers = supp_res.scalars().all()
    for s in suppliers:
        if payload.action == "approve":
            s.trust_score = 4.8
        await db.execute(
            update(Document)
            .where(Document.supplier_id == s.id)
            .values(status="verified" if payload.action == "approve" else "rejected")
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
        "message": f"Supplier verification {payload.action}d successfully",
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

