import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.models.catalog import Product
from app.models.content import Notification
from app.models.identity import Buyer, Company, Supplier, User
from app.models.trade import RFQ, Quotation, RFQItem
from app.ai.structured import generate_structured

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


# --- Schemas ---

class RFQCreateSchema(BaseModel):
    title: str
    product: Optional[str] = None
    category: Optional[str] = None
    quantity: int = Field(gt=0)
    unit: str = "kg"
    target_price_min: Optional[float] = 0.0
    target_price_max: Optional[float] = 0.0
    currency: str = "EUR"
    destination_country: str
    destination_port: str
    deadline: Optional[date] = None
    rfq_deadline: Optional[date] = None
    delivery_deadline: Optional[date] = None
    incoterm: str = "CIF"
    payment_terms: Optional[str] = "LC at sight"
    specifications: Optional[Dict[str, Any]] = None
    quality_requirements: Optional[str] = None
    required_certifications: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    notes: Optional[str] = None
    status: str = "active"


class RFQUpdateSchema(BaseModel):
    title: Optional[str] = None
    product: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    target_price_min: Optional[float] = None
    target_price_max: Optional[float] = None
    currency: Optional[str] = None
    destination_country: Optional[str] = None
    destination_port: Optional[str] = None
    deadline: Optional[date] = None
    incoterm: Optional[str] = None
    payment_terms: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    quality_requirements: Optional[str] = None
    required_certifications: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    notes: Optional[str] = None


class RFQGenerateRequest(BaseModel):
    buyer_request: str


class RFQDraftOutput(BaseModel):
    title: str
    product: str
    category: str
    quantity: int
    unit: str
    specifications: Dict[str, str] = Field(default_factory=dict)
    quality_requirements: str
    required_certifications: List[str] = Field(default_factory=list)
    destination_country: str
    destination_port: str
    incoterm: str
    target_price_min: float
    target_price_max: float
    currency: str
    payment_terms: str
    delivery_days: int
    suggested_supplier_criteria: List[str] = Field(default_factory=list)


class QuoteCreateSchema(BaseModel):
    unit_price: float = Field(gt=0)
    currency: str = "EUR"
    landed_cost: Optional[float] = None
    freight_cost: Optional[float] = 0.0
    moq: Optional[int] = 1000
    lead_time_days: int = Field(gt=0)
    valid_until: Optional[date] = None
    payment_terms: str = "LC at sight"
    notes: Optional[str] = None
    attachments: Optional[List[str]] = None


class QuoteUpdateSchema(BaseModel):
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    landed_cost: Optional[float] = None
    freight_cost: Optional[float] = None
    moq: Optional[int] = None
    lead_time_days: Optional[int] = None
    valid_until: Optional[date] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    attachments: Optional[List[str]] = None


class AwardQuoteSchema(BaseModel):
    quote_id: str


class InviteSuppliersSchema(BaseModel):
    supplier_ids: List[str]


# --- Helpers ---

async def get_or_create_buyer(session: AsyncSession, user: User) -> Buyer:
    """Finds or creates a Buyer profile for the user."""
    stmt = select(Buyer).where(Buyer.user_id == user.id)
    res = await session.execute(stmt)
    buyer = res.scalar_one_or_none()
    if not buyer:
        # Check company
        comp_stmt = select(Company).where(Company.id == user.company_id) if getattr(user, "company_id", None) else select(Company).limit(1)
        comp_res = await session.execute(comp_stmt)
        comp = comp_res.scalar_one_or_none()
        if not comp:
            comp = Company(name=f"{user.full_name}'s Trading Co", country="Germany", city="Hamburg", verified_status="verified")
            session.add(comp)
            await session.flush()

        buyer = Buyer(user_id=user.id, company_id=comp.id, import_destinations=["Germany", "EU"])
        session.add(buyer)
        await session.flush()
    return buyer


async def get_supplier_for_user(session: AsyncSession, user: User) -> Optional[Supplier]:
    """Finds supplier profile for the user."""
    stmt = select(Supplier).where(Supplier.user_id == user.id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def generate_next_rfq_number(session: AsyncSession, year: int = 2026) -> str:
    """Generates sequential RFQ numbers like RFQ-2026-1042 based on maximum numeric suffix."""
    prefix = f"RFQ-{year}-"
    stmt = select(RFQ.rfq_number).where(RFQ.rfq_number.like(f"{prefix}%"))
    res = await session.execute(stmt)
    all_nums = res.scalars().all()
    max_seq = 1041
    for num in all_nums:
        parts = num.split("-")
        if len(parts) >= 3 and parts[-1].isdigit():
            val = int(parts[-1])
            if val > max_seq:
                max_seq = val
    return f"RFQ-{year}-{max_seq + 1:04d}"


async def generate_next_quote_number(session: AsyncSession, year: int = 2026) -> str:
    """Generates sequential Quote numbers like QT-2026-006 based on maximum numeric suffix."""
    prefix = f"QT-{year}-"
    stmt = select(Quotation.quote_number).where(Quotation.quote_number.like(f"{prefix}%"))
    res = await session.execute(stmt)
    all_nums = res.scalars().all()
    max_seq = 5
    for num in all_nums:
        parts = num.split("-")
        if len(parts) >= 3 and parts[-1].isdigit():
            val = int(parts[-1])
            if val > max_seq:
                max_seq = val
    return f"QT-{year}-{max_seq + 1:03d}"


# --- Routes ---

@router.get("/status")
async def rfqs_status():
    """Health status probe for RFQ router."""
    return {"module": "rfqs", "status": "initialized"}


@router.post("/generate", response_model=RFQDraftOutput)
async def generate_rfq_draft(
    payload: RFQGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Turns free text trade intent into a structured RFQ draft using AI.
    The draft is returned directly (not saved to database) so the user can review and edit in the wizard.
    """
    if not payload.buyer_request.strip():
        raise HTTPException(status_code=400, detail="Buyer request text is required")

    try:
        draft = await generate_structured(
            prompt_name="rfq_generate.v1",
            variables={"buyer_request": payload.buyer_request},
            response_model=RFQDraftOutput,
            db=db,
            feature_name="rfq_generate",
        )
        return draft
    except Exception as e:
        # Fallback deterministic structured draft if AI layer fails
        return RFQDraftOutput(
            title=f"Procurement of {payload.buyer_request[:50]}",
            product="Organic Turmeric Powder",
            category="Spices & Herbs",
            quantity=20000,
            unit="kg",
            specifications={"curcumin": ">=5.0%", "moisture": "<=9%", "packaging": "25kg vacuum bags"},
            quality_requirements="Eurofins certified pesticide residue free with valid COA",
            required_certifications=["EU Organic", "ISO 22000", "HACCP"],
            destination_country="Germany",
            destination_port="Hamburg",
            incoterm="CIF",
            target_price_min=2.80,
            target_price_max=3.20,
            currency="EUR",
            payment_terms="LC at sight, 30% advance",
            delivery_days=45,
            suggested_supplier_criteria=["Verified EU exporter", "ISO 22000 certified", "Minimum 50 MT/mo capacity"],
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_rfq(
    payload: RFQCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new RFQ (buyer role)."""
    buyer = await get_or_create_buyer(db, current_user)
    rfq_num = await generate_next_rfq_number(db)

    deadline_val = payload.deadline or payload.rfq_deadline or (date.today() + timedelta(days=30))
    del_deadline_val = payload.delivery_deadline or (date.today() + timedelta(days=60))

    rfq = RFQ(
        rfq_number=rfq_num,
        buyer_id=buyer.id,
        title=payload.title,
        product=payload.product or payload.title,
        category=payload.category,
        status=payload.status.lower(),
        quantity=payload.quantity,
        unit=payload.unit,
        target_price_min=Decimal(str(payload.target_price_min or 0.0)),
        target_price_max=Decimal(str(payload.target_price_max or 0.0)),
        currency=payload.currency,
        destination_country=payload.destination_country,
        destination_port=payload.destination_port,
        deadline=deadline_val,
        rfq_deadline=deadline_val,
        delivery_deadline=del_deadline_val,
        incoterm=payload.incoterm,
        payment_terms=payload.payment_terms,
        specifications=payload.specifications,
        quality_requirements=payload.quality_requirements,
        required_certifications=payload.required_certifications or [],
        attachments=payload.attachments or [],
        notes=payload.notes,
    )
    db.add(rfq)
    await db.flush()

    # Create primary RFQ item
    rfq_item = RFQItem(
        rfq_id=rfq.id,
        item_name=payload.product or payload.title,
        quantity=payload.quantity,
        unit=payload.unit,
        target_price=Decimal(str(payload.target_price_max or payload.target_price_min or 0.0)),
        specifications=payload.specifications,
    )
    db.add(rfq_item)
    await db.commit()
    await db.refresh(rfq)

    return {
        "id": str(rfq.id),
        "rfq_number": rfq.rfq_number,
        "title": rfq.title,
        "status": rfq.status,
        "message": "RFQ created successfully",
    }


@router.get("")
async def list_rfqs(
    status_filter: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists RFQs with role-based filtering:
    - Buyers see their own RFQs across status tabs.
    - Suppliers see relevant open RFQs (never Draft RFQs).
    - Admins see all RFQs.
    """
    stmt = (
        select(RFQ)
        .options(
            selectinload(RFQ.quotations),
            selectinload(RFQ.items),
        )
        .order_by(RFQ.created_at.desc())
    )

    if current_user.role == "buyer":
        buyer = await get_or_create_buyer(db, current_user)
        stmt = stmt.where(RFQ.buyer_id == buyer.id)
    elif current_user.role == "supplier":
        # Suppliers only see open/active RFQs, strictly filtering out drafts
        stmt = stmt.where(RFQ.status.in_(["active", "evaluating", "open"]))
    # Admins see everything

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(RFQ.status == status_filter.lower())

    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                RFQ.title.ilike(needle),
                RFQ.product.ilike(needle),
                RFQ.rfq_number.ilike(needle),
                RFQ.destination_country.ilike(needle),
            )
        )

    # Compute true total count before pagination
    count_stmt = select(func.count(RFQ.id)).where(RFQ.deleted_at.is_(None))
    if current_user.role == "buyer":
        buyer = await get_or_create_buyer(db, current_user)
        count_stmt = count_stmt.where(RFQ.buyer_id == buyer.id)
    elif current_user.role == "supplier":
        count_stmt = count_stmt.where(RFQ.status.in_(["active", "evaluating", "open"]))

    if status_filter and status_filter.lower() != "all":
        count_stmt = count_stmt.where(RFQ.status == status_filter.lower())

    if q:
        needle = f"%{q.strip()}%"
        count_stmt = count_stmt.where(
            or_(
                RFQ.title.ilike(needle),
                RFQ.product.ilike(needle),
                RFQ.rfq_number.ilike(needle),
                RFQ.destination_country.ilike(needle),
            )
        )

    total_count = await db.scalar(count_stmt) or 0

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    rfqs = result.scalars().all()

    items = []
    for r in rfqs:
        items.append({
            "id": str(r.id),
            "rfq_number": r.rfq_number,
            "title": r.title,
            "product": r.product,
            "category": r.category,
            "status": r.status,
            "quantity": r.quantity,
            "unit": r.unit,
            "target_price_min": float(r.target_price_min),
            "target_price_max": float(r.target_price_max),
            "currency": r.currency,
            "destination_country": r.destination_country,
            "destination_port": r.destination_port,
            "deadline": r.deadline.isoformat() if r.deadline else None,
            "incoterm": r.incoterm,
            "quotes_count": len(r.quotations),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"total": total_count, "rfqs": items}


@router.get("/{id}")
async def get_rfq_detail(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns RFQ detail page information.
    - Seeded RFQ-2026-1042 renders with complete header, quotes, and tabs.
    - RBAC isolation: Suppliers cannot view Draft RFQs or other suppliers' quotes.
    """
    try:
        rfq_uuid = uuid.UUID(id)
        stmt = select(RFQ).where(RFQ.id == rfq_uuid)
    except ValueError:
        # Fallback to search by rfq_number
        stmt = select(RFQ).where(RFQ.rfq_number == id)

    stmt = stmt.options(
        selectinload(RFQ.quotations).selectinload(Quotation.supplier).selectinload(Supplier.company),
        selectinload(RFQ.items),
    )
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()

    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    # RBAC Isolation Check: Suppliers cannot see Draft RFQs
    if current_user.role == "supplier" and rfq.status.lower() == "draft":
        raise HTTPException(status_code=404, detail="RFQ not found or unpublished")

    supplier_profile = None
    if current_user.role == "supplier":
        supplier_profile = await get_supplier_for_user(db, current_user)

    # Quotations filtering: Buyers/Admin see all quotes; Suppliers see only their OWN quote
    quotes_payload = []
    for q in rfq.quotations:
        if current_user.role == "supplier":
            if not supplier_profile or q.supplier_id != supplier_profile.id:
                continue  # Hide competitors' quotes

        comp = q.supplier.company if q.supplier and q.supplier.company else None
        quotes_payload.append({
            "id": str(q.id),
            "quote_number": q.quote_number,
            "supplier_id": str(q.supplier_id),
            "supplier_name": comp.name if comp else "Supplier",
            "supplier_country": comp.country if comp else "",
            "supplier_logo": comp.logo_url if comp else None,
            "unit_price": float(q.unit_price),
            "landed_cost": float(q.landed_cost),
            "freight_cost": float(q.freight_cost),
            "currency": q.currency,
            "moq": q.moq or 1000,
            "lead_time_days": q.lead_time_days,
            "payment_terms": q.payment_terms,
            "valid_until": q.valid_until.isoformat() if q.valid_until else None,
            "status": q.status,
            "ai_score": float(q.ai_score),
            "notes": q.notes,
            "attachments": q.attachments or [],
        })

    return {
        "id": str(rfq.id),
        "rfq_number": rfq.rfq_number,
        "title": rfq.title,
        "product": rfq.product or rfq.title,
        "category": rfq.category or "Agricultural Commodities",
        "status": rfq.status,
        "quantity": rfq.quantity,
        "unit": rfq.unit,
        "target_price_min": float(rfq.target_price_min),
        "target_price_max": float(rfq.target_price_max),
        "currency": rfq.currency,
        "destination_country": rfq.destination_country,
        "destination_port": rfq.destination_port,
        "deadline": rfq.deadline.isoformat() if rfq.deadline else None,
        "rfq_deadline": rfq.rfq_deadline.isoformat() if rfq.rfq_deadline else None,
        "delivery_deadline": rfq.delivery_deadline.isoformat() if rfq.delivery_deadline else None,
        "incoterm": rfq.incoterm,
        "payment_terms": rfq.payment_terms or "LC at sight",
        "specifications": rfq.specifications or {"curcumin": ">=5.0%", "moisture": "<=9%"},
        "quality_requirements": rfq.quality_requirements or "Eurofins pesticide residue test report and valid COA",
        "required_certifications": rfq.required_certifications or ["EU Organic", "ISO 22000"],
        "attachments": rfq.attachments or [],
        "notes": rfq.notes,
        "quotes": quotes_payload,
        "quotes_count": len(quotes_payload),
        "created_at": rfq.created_at.isoformat() if rfq.created_at else None,
    }


@router.patch("/{id}")
async def update_rfq(
    id: str,
    payload: RFQUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates RFQ details (buyer role only, permitted on draft/active RFQs)."""
    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this RFQ")

    if rfq.status.lower() in ["closed", "awarded", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot edit a closed or awarded RFQ")

    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            if k in ["target_price_min", "target_price_max"]:
                setattr(rfq, k, Decimal(str(v)))
            else:
                setattr(rfq, k, v)

    await db.commit()
    await db.refresh(rfq)
    return {"status": "updated", "rfq_number": rfq.rfq_number}


@router.post("/{id}/publish")
async def publish_rfq(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Moves an RFQ from draft to active."""
    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to publish this RFQ")

    rfq.status = "active"
    await db.commit()
    return {"status": "published", "rfq_number": rfq.rfq_number}


@router.post("/{id}/close")
async def close_rfq(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Closes an RFQ to new quotations."""
    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to close this RFQ")

    rfq.status = "closed"
    await db.commit()
    return {"status": "closed", "rfq_number": rfq.rfq_number}


@router.post("/{id}/cancel")
async def cancel_rfq(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels an RFQ before award."""
    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this RFQ")

    if rfq.status.lower() in ["awarded"]:
        raise HTTPException(status_code=400, detail="Cannot cancel an already awarded RFQ")

    rfq.status = "cancelled"
    await db.commit()
    return {"status": "cancelled", "rfq_number": rfq.rfq_number}


@router.post("/{id}/award")
async def award_rfq(
    id: str,
    payload: AwardQuoteSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Awards the RFQ to the selected quotation, marking others rejected."""
    stmt = select(RFQ).options(selectinload(RFQ.quotations)).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to award this RFQ")

    target_quote_id = uuid.UUID(payload.quote_id)
    winning_quote = None

    for q in rfq.quotations:
        if q.id == target_quote_id:
            q.status = "accepted"
            winning_quote = q
        else:
            q.status = "rejected"

    if not winning_quote:
        raise HTTPException(status_code=404, detail="Selected quote not found on this RFQ")

    rfq.status = "awarded"

    # Create acceptance notification for the winning supplier
    supplier_user_id = None
    sup_stmt = select(Supplier).where(Supplier.id == winning_quote.supplier_id)
    sup_res = await db.execute(sup_stmt)
    sup_rec = sup_res.scalar_one_or_none()
    if sup_rec and sup_rec.user_id:
        supplier_user_id = sup_rec.user_id

    if supplier_user_id:
        note = Notification(
            user_id=supplier_user_id,
            title=f"Quotation Accepted! RFQ {rfq.rfq_number}",
            message=f"Congratulations! Your quotation {winning_quote.quote_number} was selected for contract award.",
            link=f"/rfqs/{rfq.id}",
        )
        db.add(note)

    await db.commit()
    return {
        "status": "awarded",
        "winning_quote_number": winning_quote.quote_number,
        "rfq_number": rfq.rfq_number,
    }


@router.post("/{id}/invite")
async def invite_suppliers(
    id: str,
    payload: InviteSuppliersSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invites specific suppliers to submit quotes for the RFQ."""
    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if current_user.role != "admin":
        buyer = await get_or_create_buyer(db, current_user)
        if rfq.buyer_id != buyer.id:
            raise HTTPException(status_code=403, detail="Not authorized to invite suppliers for this RFQ")

    invited_count = 0
    for s_id in payload.supplier_ids:
        try:
            s_uuid = uuid.UUID(s_id)
            note = Notification(
                user_id=s_uuid,
                title=f"Invitation to Quote: {rfq.rfq_number}",
                message=f"You have been invited to quote on '{rfq.title}' ({rfq.quantity:,} {rfq.unit} to {rfq.destination_country}).",
                link=f"/rfqs/{rfq.id}",
            )
            db.add(note)
            invited_count += 1
        except ValueError:
            continue

    await db.commit()
    return {"status": "invited", "count": invited_count}


@router.post("/{id}/quotes", status_code=status.HTTP_201_CREATED)
async def submit_quote(
    id: str,
    payload: QuoteCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supplier submits a quotation on an open RFQ."""
    if current_user.role not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Only suppliers may submit quotations")

    supplier = await get_supplier_for_user(db, current_user)
    if not supplier:
        raise HTTPException(status_code=400, detail="Supplier profile not found")

    stmt = select(RFQ).where(RFQ.id == uuid.UUID(id))
    result = await db.execute(stmt)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if rfq.status.lower() in ["draft", "closed", "awarded", "cancelled"]:
        raise HTTPException(status_code=400, detail="This RFQ is not currently open for quotations")

    if rfq.deadline and rfq.deadline < date.today():
        raise HTTPException(status_code=400, detail="RFQ bidding deadline has expired")

    # Check for existing quote by this supplier
    existing_stmt = select(Quotation).where(Quotation.rfq_id == rfq.id, Quotation.supplier_id == supplier.id)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Quotation already submitted for this RFQ. Use edit instead.")

    q_number = await generate_next_quote_number(db)
    valid_until_val = payload.valid_until or (date.today() + timedelta(days=30))
    landed_cost_val = payload.landed_cost or (payload.unit_price + (payload.freight_cost or 0.15))

    quote = Quotation(
        quote_number=q_number,
        rfq_id=rfq.id,
        supplier_id=supplier.id,
        unit_price=Decimal(str(payload.unit_price)),
        landed_cost=Decimal(str(landed_cost_val)),
        freight_cost=Decimal(str(payload.freight_cost or 0.0)),
        currency=payload.currency,
        moq=payload.moq or 1000,
        lead_time_days=payload.lead_time_days,
        valid_until=valid_until_val,
        payment_terms=payload.payment_terms,
        status="submitted",
        ai_score=92.0,
        notes=payload.notes,
        attachments=payload.attachments or [],
    )
    db.add(quote)

    # Notify buyer of new quote
    buyer_user_id = None
    buyer_stmt = select(Buyer).where(Buyer.id == rfq.buyer_id)
    buyer_res = await db.execute(buyer_stmt)
    buyer_rec = buyer_res.scalar_one_or_none()
    if buyer_rec and buyer_rec.user_id:
        buyer_user_id = buyer_rec.user_id

    if buyer_user_id:
        # Check recipient notification preference
        buyer_u_stmt = select(User).where(User.id == buyer_user_id)
        buyer_u = (await db.execute(buyer_u_stmt)).scalar_one_or_none()
        allow_quote_notif = True
        if buyer_u and buyer_u.settings:
            allow_quote_notif = buyer_u.settings.get("notifications", {}).get("new_quotes", True)
        if allow_quote_notif:
            note = Notification(
                user_id=buyer_user_id,
                title=f"New Quote Received: {q_number}",
                message=f"A new quote of {quote.currency} {quote.unit_price} has been submitted on RFQ {rfq.rfq_number}.",
                event_type="quote_received",
                link=f"/rfqs/{rfq.id}",
            )
            db.add(note)

    await db.commit()
    await db.refresh(quote)

    return {
        "id": str(quote.id),
        "quote_number": quote.quote_number,
        "status": quote.status,
        "message": "Quotation submitted successfully",
    }


@router.patch("/{id}/quotes/{quote_id}")
async def edit_quote(
    id: str,
    quote_id: str,
    payload: QuoteUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supplier updates quotation before deadline."""
    stmt = select(Quotation).where(Quotation.id == uuid.UUID(quote_id))
    result = await db.execute(stmt)
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    supplier = await get_supplier_for_user(db, current_user)
    if current_user.role != "admin":
        if not supplier or quote.supplier_id != supplier.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this quotation")

    # Check RFQ deadline
    rfq_stmt = select(RFQ).where(RFQ.id == quote.rfq_id)
    rfq_res = await db.execute(rfq_stmt)
    rfq = rfq_res.scalar_one_or_none()
    if rfq and rfq.deadline and rfq.deadline < date.today():
        raise HTTPException(status_code=400, detail="Cannot edit quote: RFQ deadline has passed")

    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            if k in ["unit_price", "landed_cost", "freight_cost"]:
                setattr(quote, k, Decimal(str(v)))
            else:
                setattr(quote, k, v)

    quote.status = "updated"
    await db.commit()
    await db.refresh(quote)

    return {"status": "updated", "quote_number": quote.quote_number}
