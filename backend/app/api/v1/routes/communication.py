"""
TradeX AI - Communication, Structured Negotiation, and Notifications API (Prompt 15)
Buyer-supplier chat threads, counter-offers, AI negotiation deal assistance,
and real-time notification dispatch.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.models.identity import Buyer, Company, Supplier, User
from app.models.trade import Order, Quotation, RFQ
from app.models.content import Message, Notification, SavedItem, Thread
from app.models.catalog import Category, Product, SupplierCategory
from app.api.deps import get_current_user
from app.services.websocket_manager import ws_manager
from app.ai.structured import generate_structured

router = APIRouter(prefix="", tags=["Communication & Negotiation"])


# Pydantic Schemas
class SendMessageInput(BaseModel):
    body: str = Field(..., min_length=1)
    message_type: str = Field(default="text", description="'text' or 'offer'")
    offer_data: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None


class CreateThreadInput(BaseModel):
    recipient_id: uuid.UUID
    subject: str = Field(default="Trade Inquiry", min_length=1, max_length=255)
    initial_message: str = Field(..., min_length=1)
    context_type: str = Field(default="product")
    context_id: Optional[str] = None
    product_id: Optional[uuid.UUID] = None
    attachments: Optional[List[str]] = None


class AllowedRecipientItem(BaseModel):
    recipient_user_id: str
    participant_id: str
    company_id: Optional[str] = None
    name: str
    company_name: str
    logo_url: Optional[str] = None
    role: str
    country: str
    verified: bool = False
    categories: List[str] = Field(default_factory=list)
    relationship_reason: str
    context_type: str = "product"
    context_id: Optional[str] = None


class CounterOfferInput(BaseModel):
    price: float = Field(..., gt=0)
    quantity: Optional[int] = None
    lead_time_days: Optional[int] = None
    note: Optional[str] = None


class AINegotiationAssistOutput(BaseModel):
    recommended_counter_price: float
    suggested_incoterm: str
    compromise_terms: str
    reasoning: str
    draft_message_to_counterparty: str


class ThreadListItem(BaseModel):
    id: str
    title: Optional[str]
    rfq_id: Optional[str]
    quotation_id: Optional[str]
    counterparty_name: str
    counterparty_role: str
    counterparty_country: str
    counterparty_logo: Optional[str]
    last_message: Optional[str]
    last_message_at: Optional[str]
    unread_count: int


# Helpers
async def get_user_profiles(db: AsyncSession, user: User) -> tuple[Optional[Buyer], Optional[Supplier]]:
    buyer = (
        await db.execute(select(Buyer).where(Buyer.user_id == user.id).options(selectinload(Buyer.company)))
    ).scalar_one_or_none()
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id).options(selectinload(Supplier.company)))
    ).scalar_one_or_none()
    return buyer, supplier


async def verify_thread_participant(db: AsyncSession, thread_id: uuid.UUID, user: User) -> Thread:
    thread = (
        await db.execute(
            select(Thread)
            .where(Thread.id == thread_id)
            .options(
                selectinload(Thread.buyer).selectinload(Buyer.company),
                selectinload(Thread.supplier).selectinload(Supplier.company),
            )
        )
    ).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation thread not found")

    if user.role == "admin":
        return thread

    buyer, supplier = await get_user_profiles(db, user)
    is_buyer = buyer and thread.buyer_id == buyer.id
    is_supplier = supplier and thread.supplier_id == supplier.id

    if not is_buyer and not is_supplier:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")

    return thread


async def check_supplier_buyer_relationship(
    db: AsyncSession, supplier_id: uuid.UUID, buyer_id: uuid.UUID
) -> tuple[bool, str]:
    """
    Checks if a legitimate business relationship exists between supplier and buyer:
    1. Existing thread
    2. Quotation submitted by supplier on buyer's RFQ
    3. Purchase order between them
    4. Buyer saved one of supplier's products
    5. Active RFQ posted by buyer
    """
    # 1. Existing Thread
    th_stmt = select(Thread.id).where(
        Thread.supplier_id == supplier_id,
        Thread.buyer_id == buyer_id,
    ).limit(1)
    if (await db.execute(th_stmt)).scalar_one_or_none():
        return True, "Existing conversation thread"

    # 2. Quotation on buyer RFQ
    q_stmt = (
        select(Quotation.id)
        .join(RFQ, Quotation.rfq_id == RFQ.id)
        .where(Quotation.supplier_id == supplier_id, RFQ.buyer_id == buyer_id)
        .limit(1)
    )
    if (await db.execute(q_stmt)).scalar_one_or_none():
        return True, "Submitted quotation on buyer RFQ"

    # 3. Order
    ord_stmt = select(Order.id).where(
        Order.supplier_id == supplier_id,
        Order.buyer_id == buyer_id,
    ).limit(1)
    if (await db.execute(ord_stmt)).scalar_one_or_none():
        return True, "Active trade order / contract"

    # 4. Buyer saved supplier's product
    saved_stmt = (
        select(SavedItem.id)
        .join(Buyer, SavedItem.user_id == Buyer.user_id)
        .join(Product, SavedItem.item_id == Product.id)
        .where(Buyer.id == buyer_id, Product.supplier_id == supplier_id)
        .limit(1)
    )
    if (await db.execute(saved_stmt)).scalar_one_or_none():
        return True, "Buyer saved your product"

    # 5. Buyer open RFQ
    rfq_stmt = select(RFQ.id).where(
        RFQ.buyer_id == buyer_id,
        RFQ.status.in_(["open", "published", "active", "submitted"])
    ).limit(1)
    if (await db.execute(rfq_stmt)).scalar_one_or_none():
        return True, "Open RFQ Opportunity"

    return False, "No verified trade relationship"


# --- Threads & Messaging Endpoints ---

@router.get("/recipients", response_model=List[AllowedRecipientItem])
async def list_allowed_recipients(
    q: Optional[str] = Query(None, description="Search term for company, contact, product, category, country"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AllowedRecipientItem]:
    """Lists verified allowed counterparties that the current user is permitted to message.
    For Buyers: returns active published/verified suppliers with published products, searchable by company, contact, product, category, or country.
    For Suppliers: returns only buyers with existing business relationship (Prompt 26 anti-spam).
    Privacy rule: NEVER returns emails or phone numbers.
    """
    buyer, supplier = await get_user_profiles(db, current_user)
    recipients = []

    if current_user.role == "supplier" and supplier:
        # Supplier side: Retain relationship requirement from Prompt 26
        seen_buyers = set()

        # 1. Buyers with existing threads
        threads = (
            await db.execute(
                select(Thread)
                .where(Thread.supplier_id == supplier.id)
                .options(selectinload(Thread.buyer).selectinload(Buyer.company), selectinload(Thread.buyer).selectinload(Buyer.user))
            )
        ).scalars().all()
        for th in threads:
            if th.buyer and th.buyer.id not in seen_buyers:
                seen_buyers.add(th.buyer.id)
                comp = th.buyer.company
                user_obj = th.buyer.user
                recipients.append(
                    AllowedRecipientItem(
                        recipient_user_id=str(user_obj.id if user_obj else th.buyer.user_id),
                        participant_id=str(th.buyer.id),
                        company_id=str(comp.id) if comp else None,
                        name=user_obj.full_name if user_obj and user_obj.full_name else "Buyer Representative",
                        company_name=comp.name if comp else "Trading Co",
                        logo_url=comp.logo_url if comp else None,
                        role="buyer",
                        country=comp.country if comp else "Global",
                        verified=comp.verified_status in ["verified", "published"] if comp else False,
                        relationship_reason=f"Inquiry / thread: {th.title or 'Active inquiry'}",
                        context_type="inquiry",
                        context_id=str(th.id),
                    )
                )

        # 2. Buyers with open RFQs
        rfqs = (
            await db.execute(
                select(RFQ)
                .where(RFQ.status.in_(["open", "published", "active"]))
                .options(selectinload(RFQ.buyer).selectinload(Buyer.company), selectinload(RFQ.buyer).selectinload(Buyer.user))
                .limit(20)
            )
        ).scalars().all()
        for rfq in rfqs:
            if rfq.buyer and rfq.buyer.id not in seen_buyers:
                seen_buyers.add(rfq.buyer.id)
                comp = rfq.buyer.company
                user_obj = rfq.buyer.user
                recipients.append(
                    AllowedRecipientItem(
                        recipient_user_id=str(user_obj.id if user_obj else rfq.buyer.user_id),
                        participant_id=str(rfq.buyer.id),
                        company_id=str(comp.id) if comp else None,
                        name=user_obj.full_name if user_obj and user_obj.full_name else "Procurement Officer",
                        company_name=comp.name if comp else "Import Corp",
                        logo_url=comp.logo_url if comp else None,
                        role="buyer",
                        country=comp.country if comp else "Global",
                        verified=comp.verified_status in ["verified", "published"] if comp else False,
                        relationship_reason=f"Open RFQ: {rfq.title} ({rfq.rfq_number})",
                        context_type="rfq",
                        context_id=str(rfq.id),
                    )
                )

        # 3. Buyers with orders
        orders = (
            await db.execute(
                select(Order)
                .where(Order.supplier_id == supplier.id)
                .options(selectinload(Order.buyer).selectinload(Buyer.company), selectinload(Order.buyer).selectinload(Buyer.user))
                .limit(20)
            )
        ).scalars().all()
        for ord_obj in orders:
            if ord_obj.buyer and ord_obj.buyer.id not in seen_buyers:
                seen_buyers.add(ord_obj.buyer.id)
                comp = ord_obj.buyer.company
                user_obj = ord_obj.buyer.user
                recipients.append(
                    AllowedRecipientItem(
                        recipient_user_id=str(user_obj.id if user_obj else ord_obj.buyer.user_id),
                        participant_id=str(ord_obj.buyer.id),
                        company_id=str(comp.id) if comp else None,
                        name=user_obj.full_name if user_obj and user_obj.full_name else "Buyer Contact",
                        company_name=comp.name if comp else "Commercial Buyer",
                        logo_url=comp.logo_url if comp else None,
                        role="buyer",
                        country=comp.country if comp else "Global",
                        verified=comp.verified_status in ["verified", "published"] if comp else False,
                        relationship_reason=f"Order #{ord_obj.order_number}",
                        context_type="order",
                        context_id=str(ord_obj.id),
                    )
                )

        # 4. Buyers who saved supplier's products (Buyer Leads)
        saved_items = (
            await db.execute(
                select(SavedItem, Buyer, Product)
                .join(Buyer, SavedItem.user_id == Buyer.user_id)
                .join(Product, SavedItem.item_id == Product.id)
                .where(Product.supplier_id == supplier.id)
                .options(selectinload(Buyer.company), selectinload(Buyer.user))
                .limit(20)
            )
        ).all()
        for s_item, b_item, p_item in saved_items:
            if b_item and b_item.id not in seen_buyers:
                seen_buyers.add(b_item.id)
                comp = b_item.company
                user_obj = b_item.user
                recipients.append(
                    AllowedRecipientItem(
                        recipient_user_id=str(user_obj.id if user_obj else b_item.user_id),
                        participant_id=str(b_item.id),
                        company_id=str(comp.id) if comp else None,
                        name=user_obj.full_name if user_obj and user_obj.full_name else "Prospective Buyer",
                        company_name=comp.name if comp else "Trade Partner",
                        logo_url=comp.logo_url if comp else None,
                        role="buyer",
                        country=comp.country if comp else "Global",
                        verified=comp.verified_status in ["verified", "published"] if comp else False,
                        relationship_reason=f"Lead: Saved your product '{p_item.name}'",
                        context_type="product",
                        context_id=str(p_item.id),
                    )
                )

        if q and q.strip():
            term = q.strip().lower()
            recipients = [
                r for r in recipients
                if term in r.name.lower() or term in r.company_name.lower() or term in r.country.lower() or term in r.relationship_reason.lower()
            ]

    else:
        # User is Buyer (or Admin): Prompt 33 recipient search
        # Must return any active supplier company that is Published or Verified and has at least one published product
        has_prod = exists().where(
            Product.supplier_id == Supplier.id,
            Product.status == "published",
            Product.is_active.is_(True),
        )
        conditions = [
            User.is_active.is_(True),
            Company.verified_status.in_(["verified", "published", "active"]),
            has_prod,
        ]

        if q and q.strip():
            term = f"%{q.strip()}%"
            prod_match = exists().where(
                Product.supplier_id == Supplier.id,
                Product.status == "published",
                Product.is_active.is_(True),
                Product.name.ilike(term),
            )
            cat_match = exists().where(
                Product.supplier_id == Supplier.id,
                Product.status == "published",
                Product.category.has(Category.name.ilike(term)),
            )
            sup_cat_match = exists().where(
                SupplierCategory.supplier_id == Supplier.id,
                SupplierCategory.category.has(Category.name.ilike(term)),
            )
            conditions.append(
                or_(
                    Company.name.ilike(term),
                    User.full_name.ilike(term),
                    Company.country.ilike(term),
                    prod_match,
                    cat_match,
                    sup_cat_match,
                )
            )

        stmt = (
            select(Supplier)
            .join(Supplier.user)
            .join(Supplier.company)
            .where(*conditions)
            .options(
                selectinload(Supplier.company),
                selectinload(Supplier.user),
                selectinload(Supplier.supplier_categories).selectinload(SupplierCategory.category),
                selectinload(Supplier.products).selectinload(Product.category),
            )
            .order_by(
                case((Company.verified_status == "verified", 1), else_=2),
                Company.name.asc(),
            )
            .limit(50)
        )
        suppliers = (await db.execute(stmt)).scalars().all()

        for sup in suppliers:
            comp = sup.company
            user_obj = sup.user

            cats = []
            for sc in (sup.supplier_categories or []):
                if sc.category and sc.category.name not in cats:
                    cats.append(sc.category.name)
            if not cats and sup.products:
                for p in sup.products:
                    if p.category and p.category.name not in cats:
                        cats.append(p.category.name)
                    if len(cats) >= 5:
                        break

            is_verified = (comp.verified_status in ["verified", "published"]) if comp else False
            recipients.append(
                AllowedRecipientItem(
                    recipient_user_id=str(user_obj.id if user_obj else sup.user_id),
                    participant_id=str(sup.id),
                    company_id=str(comp.id) if comp else None,
                    name=user_obj.full_name if user_obj and user_obj.full_name else "Sales Representative",
                    company_name=comp.name if comp else "Export Supplier",
                    logo_url=comp.logo_url if comp else None,
                    role="supplier",
                    country=comp.country if comp else "Global",
                    verified=is_verified,
                    categories=cats[:5],
                    relationship_reason="Verified Export Supplier" if is_verified else "Published Supplier",
                    context_type="product",
                )
            )

    return recipients


@router.post("/threads", status_code=status.HTTP_201_CREATED)
async def create_new_thread(
    payload: CreateThreadInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Starts or reuses a conversation thread.
    - Resolves recipient by Supplier/Buyer ID, User ID, or Company ID.
    - Idempotent: Reuses existing thread for (buyer, supplier, product) if one already exists.
    - Enforces rate limit for buyers: max 15 new threads per hour (HTTP 429).
    - Preserves Prompt 26 anti-spam validation for suppliers (HTTP 403).
    - If recipient is not eligible or contact not found, returns HTTP 404.
    """
    buyer, supplier = await get_user_profiles(db, current_user)

    target_buyer_id = None
    target_supplier_id = None
    recipient_user_id = None

    if current_user.role == "supplier" or (supplier and not buyer):
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier profile required to initiate supplier thread")
        target_supplier_id = supplier.id

        # Resolve target buyer from payload.recipient_id (either buyer.id, buyer.user_id, or buyer.company_id)
        b_stmt = (
            select(Buyer)
            .where(
                (Buyer.id == payload.recipient_id)
                | (Buyer.user_id == payload.recipient_id)
                | (Buyer.company_id == payload.recipient_id)
            )
            .options(selectinload(Buyer.user))
        )
        target_buyer = (await db.execute(b_stmt)).scalars().first()
        if not target_buyer:
            raise HTTPException(status_code=404, detail="No eligible buyer contact found")

        # Anti-spam verification check
        has_rel, reason = await check_supplier_buyer_relationship(db, supplier.id, target_buyer.id)
        if not has_rel:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Supplier cannot message a buyer without an existing inquiry, RFQ, quote, or order relationship."
            )

        target_buyer_id = target_buyer.id
        recipient_user_id = target_buyer.user_id

    else:
        # Current user is Buyer
        if not buyer:
            b_stmt = select(Buyer).where(Buyer.user_id == current_user.id)
            buyer = (await db.execute(b_stmt)).scalar_one_or_none()
            if not buyer:
                # Auto-create buyer company and profile for smooth buyer onboarding
                new_comp = Company(
                    name=f"{current_user.full_name or 'Commercial Buyer'}'s Enterprise",
                    country="Global",
                    verified_status="unverified",
                )
                db.add(new_comp)
                await db.flush()
                buyer = Buyer(user_id=current_user.id, company_id=new_comp.id)
                db.add(buyer)
                await db.flush()
        target_buyer_id = buyer.id

        # Resolve target supplier: accepts Supplier.id, Supplier.user_id, or Supplier.company_id
        s_stmt = (
            select(Supplier)
            .where(
                (Supplier.id == payload.recipient_id)
                | (Supplier.user_id == payload.recipient_id)
                | (Supplier.company_id == payload.recipient_id)
            )
            .options(selectinload(Supplier.user), selectinload(Supplier.company))
        )
        target_supplier = (await db.execute(s_stmt)).scalars().first()
        if not target_supplier or not target_supplier.user or not target_supplier.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No eligible supplier contact found for this company"
            )

        target_supplier_id = target_supplier.id
        recipient_user_id = target_supplier.user_id

    # Resolve product_id and rfq_id
    rfq_id_val = None
    if payload.context_type == "rfq" and payload.context_id:
        try:
            rfq_id_val = uuid.UUID(payload.context_id)
        except ValueError:
            pass

    prod_id_val = payload.product_id
    if not prod_id_val and payload.context_type == "product" and payload.context_id:
        try:
            prod_id_val = uuid.UUID(payload.context_id)
        except ValueError:
            pass

    if prod_id_val:
        # Verify product exists so foreign key is never violated
        p_exists = (await db.execute(select(Product.id).where(Product.id == prod_id_val))).scalar_one_or_none()
        if not p_exists:
            prod_id_val = None

    # Check for existing thread (Idempotent reuse per buyer, supplier, and product)
    th_query = select(Thread).where(
        Thread.buyer_id == target_buyer_id,
        Thread.supplier_id == target_supplier_id,
    )
    if prod_id_val:
        th_query = th_query.where(Thread.product_id == prod_id_val)
    elif rfq_id_val:
        th_query = th_query.where(Thread.rfq_id == rfq_id_val)
    else:
        th_query = th_query.where(
            Thread.product_id.is_(None),
            Thread.rfq_id.is_(None),
            Thread.title == payload.subject,
        )

    existing_thread = (await db.execute(th_query.order_by(Thread.created_at.desc()))).scalars().first()

    if existing_thread:
        # Reuse existing conversation thread
        msg_id = ""
        if payload.initial_message:
            new_msg = Message(
                thread_id=existing_thread.id,
                sender_id=current_user.id,
                body=payload.initial_message,
                message_type="text",
                attachments=payload.attachments or [],
                is_read=False,
            )
            db.add(new_msg)
            await db.commit()
            await db.refresh(new_msg)
            msg_id = str(new_msg.id)

            if recipient_user_id:
                recip_u = (await db.execute(select(User).where(User.id == recipient_user_id))).scalar_one_or_none()
                allow_msg = True
                if recip_u and recip_u.settings:
                    allow_msg = recip_u.settings.get("notifications", {}).get("messages", True)
                if allow_msg:
                    notif = Notification(
                        user_id=recipient_user_id,
                        title=f"New message: {existing_thread.title or payload.subject}",
                        message=payload.initial_message[:120],
                        event_type="message",
                        is_read=False,
                        link=f"/messages?threadId={existing_thread.id}",
                    )
                    db.add(notif)
                    await db.commit()

        return {
            "status": "success",
            "thread_id": str(existing_thread.id),
            "message_id": msg_id,
            "title": existing_thread.title or payload.subject,
            "is_existing": True,
        }

    # New Thread: Enforce Rate Limit for Buyers (Max 15 new threads per hour)
    if current_user.role != "supplier":
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        count_stmt = select(func.count(Thread.id)).where(
            Thread.buyer_id == target_buyer_id,
            Thread.created_at >= one_hour_ago,
        )
        recent_count = (await db.execute(count_stmt)).scalar() or 0
        if recent_count >= 15:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded: Maximum 15 new trade conversations per hour. Please wait before creating more threads."
            )

    # Create thread
    thread = Thread(
        title=payload.subject,
        buyer_id=target_buyer_id,
        supplier_id=target_supplier_id,
        rfq_id=rfq_id_val,
        product_id=prod_id_val,
    )
    db.add(thread)
    await db.flush()

    # Create first message
    first_msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=payload.initial_message,
        message_type="text",
        attachments=payload.attachments or [],
        is_read=False,
    )
    db.add(first_msg)

    # Dispatch notification respecting recipient user settings
    if recipient_user_id:
        recip_u = (await db.execute(select(User).where(User.id == recipient_user_id))).scalar_one_or_none()
        allow_msg = True
        if recip_u and recip_u.settings:
            allow_msg = recip_u.settings.get("notifications", {}).get("messages", True)
        if allow_msg:
            notif = Notification(
                user_id=recipient_user_id,
                title=f"New message: {payload.subject}",
                message=payload.initial_message[:120],
                event_type="message",
                is_read=False,
                link=f"/messages?threadId={thread.id}",
            )
            db.add(notif)

    await db.commit()
    await db.refresh(thread)
    await db.refresh(first_msg)

    return {
        "status": "created",
        "thread_id": str(thread.id),
        "message_id": str(first_msg.id),
        "title": thread.title,
        "is_existing": False,
    }

@router.get("/threads", response_model=List[ThreadListItem])
async def list_user_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ThreadListItem]:
    """Lists threads accessible by the authenticated user with unread counts."""
    buyer, supplier = await get_user_profiles(db, current_user)

    conditions = []
    if current_user.role == "admin":
        # Admin can view all threads
        pass
    else:
        if buyer:
            conditions.append(Thread.buyer_id == buyer.id)
        if supplier:
            conditions.append(Thread.supplier_id == supplier.id)

    stmt = select(Thread).options(
        selectinload(Thread.buyer).selectinload(Buyer.company),
        selectinload(Thread.supplier).selectinload(Supplier.company),
    )
    if conditions:
        from sqlalchemy import or_
        stmt = stmt.where(or_(*conditions))

    threads = (await db.execute(stmt)).scalars().all()
    results = []

    for t in threads:
        # Determine counterparty based on current user role
        is_current_buyer = buyer and t.buyer_id == buyer.id
        if is_current_buyer:
            cp_comp = t.supplier.company if t.supplier else None
            cp_name = cp_comp.name if cp_comp else "Supplier"
            cp_role = "supplier"
            cp_country = cp_comp.country if cp_comp else "Export Region"
            cp_logo = cp_comp.logo_url if cp_comp else None
        else:
            cp_comp = t.buyer.company if t.buyer else None
            cp_name = cp_comp.name if cp_comp else "Buyer"
            cp_role = "buyer"
            cp_country = cp_comp.country if cp_comp else "Import Region"
            cp_logo = cp_comp.logo_url if cp_comp else None

        # Fetch last message
        last_msg_stmt = (
            select(Message)
            .where(Message.thread_id == t.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg = (await db.execute(last_msg_stmt)).scalar_one_or_none()

        # Unread count (messages sent by others and is_read is False)
        unread_stmt = (
            select(func.count(Message.id))
            .where(
                Message.thread_id == t.id,
                Message.sender_id != current_user.id,
                Message.is_read.is_(False),
            )
        )
        unread_count = (await db.execute(unread_stmt)).scalar() or 0

        results.append(
            ThreadListItem(
                id=str(t.id),
                title=t.title or "Trade Negotiation",
                rfq_id=str(t.rfq_id) if t.rfq_id else None,
                quotation_id=str(t.quotation_id) if t.quotation_id else None,
                counterparty_name=cp_name,
                counterparty_role=cp_role,
                counterparty_country=cp_country,
                counterparty_logo=cp_logo,
                last_message=last_msg.body if last_msg else None,
                last_message_at=last_msg.created_at.isoformat() if last_msg else None,
                unread_count=int(unread_count),
            )
        )

    return results


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Retrieves paginated messages for a verified conversation thread."""
    thread = await verify_thread_participant(db, thread_id, current_user)

    stmt = (
        select(Message)
        .where(Message.thread_id == thread_id)
        .options(selectinload(Message.sender))
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    messages = (await db.execute(stmt)).scalars().all()

    items = []
    for m in messages:
        sender_user = m.sender
        items.append({
            "id": str(m.id),
            "thread_id": str(m.thread_id),
            "sender_id": str(m.sender_id),
            "sender_name": sender_user.email.split("@")[0] if sender_user else "Trader",
            "is_me": m.sender_id == current_user.id,
            "body": m.body,
            "message_type": m.message_type,
            "offer_data": m.offer_data,
            "attachments": m.attachments or [],
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "thread_id": str(thread.id),
        "title": thread.title,
        "rfq_id": str(thread.rfq_id) if thread.rfq_id else None,
        "quotation_id": str(thread.quotation_id) if thread.quotation_id else None,
        "total_messages": len(items),
        "messages": items,
    }


@router.post("/threads/{thread_id}/messages")
async def post_thread_message(
    thread_id: uuid.UUID,
    payload: SendMessageInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Posts a message to a thread and broadcasts live via WebSocket."""
    thread = await verify_thread_participant(db, thread_id, current_user)

    # If this message is an offer, mark earlier pending offers in the thread as superseded
    if payload.message_type == "offer":
        prev_stmt = (
            select(Message)
            .where(
                Message.thread_id == thread.id,
                Message.message_type == "offer",
            )
        )
        prev_offers = (await db.execute(prev_stmt)).scalars().all()
        for po in prev_offers:
            if po.offer_data and po.offer_data.get("status") in ["pending", "countered"]:
                po_data = dict(po.offer_data)
                po_data["status"] = "superseded"
                po.offer_data = po_data

    msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=payload.body,
        message_type=payload.message_type,
        offer_data=payload.offer_data,
        attachments=payload.attachments,
        is_read=False,
    )
    db.add(msg)

    # Determine recipient user and send notification
    buyer_user_id = str(thread.buyer.user_id) if thread.buyer else ""
    supplier_user_id = str(thread.supplier.user_id) if thread.supplier else ""
    recip_uid_str = buyer_user_id if str(current_user.id) == supplier_user_id else supplier_user_id
    if recip_uid_str:
        try:
            recip_uid = uuid.UUID(recip_uid_str)
            recip_u = (await db.execute(select(User).where(User.id == recip_uid))).scalar_one_or_none()
            allow_msg = True
            if recip_u and recip_u.settings:
                allow_msg = recip_u.settings.get("notifications", {}).get("messages", True)
            if allow_msg:
                notif = Notification(
                    user_id=recip_uid,
                    title=f"New message from {current_user.full_name or 'Trader'}",
                    message=payload.body[:120],
                    event_type="message",
                    is_read=False,
                    link=f"/messages?threadId={thread.id}",
                )
                db.add(notif)
        except Exception:
            pass

    await db.commit()
    await db.refresh(msg)

    # Broadcast to participant users via WebSocket
    buyer_user_id = str(thread.buyer.user_id) if thread.buyer else ""
    supplier_user_id = str(thread.supplier.user_id) if thread.supplier else ""
    target_users = [u for u in [buyer_user_id, supplier_user_id] if u and u != str(current_user.id)]

    ws_payload = {
        "type": "new_message",
        "thread_id": str(thread.id),
        "message": {
            "id": str(msg.id),
            "sender_id": str(msg.sender_id),
            "body": msg.body,
            "message_type": msg.message_type,
            "offer_data": msg.offer_data,
            "created_at": msg.created_at.isoformat(),
        },
    }
    await ws_manager.broadcast_to_users(ws_payload, target_users)

    return {
        "status": "sent",
        "message_id": str(msg.id),
        "created_at": msg.created_at.isoformat(),
    }


@router.post("/threads/{thread_id}/read")
async def mark_thread_read(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Marks all unread messages in the thread received by current user as read."""
    await verify_thread_participant(db, thread_id, current_user)

    stmt = (
        update(Message)
        .where(
            Message.thread_id == thread_id,
            Message.sender_id != current_user.id,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()

    return {"status": "ok", "thread_id": str(thread_id)}


# --- Structured Counter-Offer Negotiation Endpoints ---

@router.post("/quotes/{quote_id}/counter")
async def create_counter_offer(
    quote_id: uuid.UUID,
    payload: CounterOfferInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Submits a structured commercial counter-offer against a quotation.
    Creates or retrieves the negotiation thread, writes an 'offer' message,
    and dispatches notifications.
    """
    quote_stmt = (
        select(Quotation)
        .where(Quotation.id == quote_id)
        .options(
            selectinload(Quotation.rfq).selectinload(RFQ.buyer),
            selectinload(Quotation.supplier),
        )
    )
    quote = (await db.execute(quote_stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    rfq = quote.rfq

    # Determine or get-or-create thread
    thread_stmt = select(Thread).where(
        Thread.rfq_id == rfq.id,
        Thread.supplier_id == quote.supplier_id,
    )
    thread = (await db.execute(thread_stmt)).scalar_one_or_none()

    if not thread:
        thread = Thread(
            title=f"Negotiation on {quote.quote_number} ({rfq.title})",
            rfq_id=rfq.id,
            quotation_id=quote.id,
            buyer_id=rfq.buyer_id,
            supplier_id=quote.supplier_id,
        )
        db.add(thread)
        await db.flush()

    # Mark any earlier open/pending counter-offers in this thread as 'superseded'
    prev_offers_stmt = (
        select(Message)
        .where(Message.thread_id == thread.id, Message.message_type == "offer")
    )
    prev_offers = (await db.execute(prev_offers_stmt)).scalars().all()
    for po in prev_offers:
        if po.offer_data and po.offer_data.get("status") in ["pending", "countered"]:
            po_data = dict(po.offer_data)
            po_data["status"] = "superseded"
            po.offer_data = po_data

    lead_days = payload.lead_time_days or quote.lead_time_days
    qty = payload.quantity or (rfq.quantity if rfq else 20000)

    offer_data = {
        "price": payload.price,
        "quantity": qty,
        "unit": rfq.unit if rfq else "kg",
        "lead_time_days": lead_days,
        "currency": quote.currency or "EUR",
        "status": "pending",
        "notes": payload.note or "Proposed counter-offer terms",
    }

    body_text = (
        f"Counter-offer: Proposed rate of €{payload.price:.2f}/kg "
        f"for {qty:,} {rfq.unit if rfq else 'kg'} with {lead_days} days lead time."
    )
    if payload.note:
        body_text += f"\nNote: {payload.note}"

    msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=body_text,
        message_type="offer",
        offer_data=offer_data,
        is_read=False,
    )
    db.add(msg)

    # Determine counterparty user ID for notification
    is_buyer_sender = (rfq.buyer and rfq.buyer.user_id == current_user.id)
    recipient_user_id = quote.supplier.user_id if is_buyer_sender else rfq.buyer.user_id

    notif = Notification(
        user_id=recipient_user_id,
        title="New Counter-Offer Received",
        message=f"A counter-offer of €{payload.price:.2f}/kg has been submitted on quote {quote.quote_number}.",
        event_type="counter_offer",
        is_read=False,
        link=f"/rfq/{rfq.id}",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(msg)

    # Real-time WebSocket push
    await ws_manager.send_personal_message(
        {
            "type": "counter_offer",
            "thread_id": str(thread.id),
            "message_id": str(msg.id),
            "offer": offer_data,
        },
        str(recipient_user_id),
    )

    return {
        "status": "offer_created",
        "thread_id": str(thread.id),
        "message_id": str(msg.id),
        "offer": offer_data,
    }


@router.post("/negotiations/{message_id}/accept")
async def accept_counter_offer(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Accepts a pending counter-offer:
    1. Updates message offer_data status to 'accepted'.
    2. Updates underlying quotation's unit_price, moq/quantity, lead_time_days.
    3. Emits acceptance notification.
    """
    msg_stmt = (
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.thread).selectinload(Thread.buyer),
            selectinload(Message.thread).selectinload(Thread.supplier),
        )
    )
    msg = (await db.execute(msg_stmt)).scalar_one_or_none()
    if not msg or msg.message_type != "offer" or not msg.offer_data:
        raise HTTPException(status_code=404, detail="Counter-offer not found")

    thread = msg.thread
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Verify recipient is accepting (not the creator)
    if msg.sender_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot accept your own counter-offer")

    # Update offer data
    curr_data = dict(msg.offer_data)
    curr_data["status"] = "accepted"
    msg.offer_data = curr_data

    # Mark ALL other offers in this thread as declined / superseded
    other_offers_stmt = (
        select(Message)
        .where(
            Message.thread_id == thread.id,
            Message.message_type == "offer",
            Message.id != msg.id,
        )
    )
    other_offers = (await db.execute(other_offers_stmt)).scalars().all()
    for oo in other_offers:
        if oo.offer_data:
            oo_data = dict(oo.offer_data)
            if oo_data.get("status") != "accepted":
                oo_data["status"] = "superseded"
                oo.offer_data = oo_data

    # Update quotation if linked
    if thread.quotation_id:
        q_stmt = select(Quotation).where(Quotation.id == thread.quotation_id)
        quote = (await db.execute(q_stmt)).scalar_one_or_none()
        if quote:
            agreed_price = curr_data.get("price")
            if agreed_price:
                quote.unit_price = Decimal(str(agreed_price))
            agreed_lead = curr_data.get("lead_time_days")
            if agreed_lead:
                quote.lead_time_days = agreed_lead

    # Create system confirmation message
    sys_msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=f"Deal Agreed! Counter-offer of €{curr_data.get('price'):.2f}/kg has been accepted.",
        message_type="system",
        is_read=False,
    )
    db.add(sys_msg)

    # Create notification for offer creator
    notif = Notification(
        user_id=msg.sender_id,
        title="Counter-Offer Accepted!",
        message=f"Your counter-offer of €{curr_data.get('price'):.2f}/kg has been accepted.",
        event_type="counter_offer",
        is_read=False,
        link=f"/rfq/{thread.rfq_id}" if thread.rfq_id else "/messages",
    )
    db.add(notif)
    await db.commit()

    # WebSocket notification
    await ws_manager.send_personal_message(
        {"type": "offer_accepted", "thread_id": str(thread.id), "message_id": str(msg.id)},
        str(msg.sender_id),
    )

    return {
        "status": "accepted",
        "offer_price": curr_data.get("price"),
        "lead_time_days": curr_data.get("lead_time_days"),
    }


@router.post("/negotiations/{message_id}/reject")
async def reject_counter_offer(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Rejects a pending counter-offer."""
    msg = (await db.execute(select(Message).where(Message.id == message_id))).scalar_one_or_none()
    if not msg or msg.message_type != "offer" or not msg.offer_data:
        raise HTTPException(status_code=404, detail="Counter-offer not found")

    curr_data = dict(msg.offer_data)
    curr_data["status"] = "rejected"
    msg.offer_data = curr_data

    await db.commit()
    return {"status": "rejected", "message_id": str(msg.id)}


@router.post("/ai/negotiation/assist", response_model=AINegotiationAssistOutput)
async def ai_negotiation_assist(
    thread_id: Optional[uuid.UUID] = None,
    target_price: Optional[float] = 3.00,
    current_quote_price: Optional[float] = 3.10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AINegotiationAssistOutput:
    """
    Renders negotiation_assist.v1 prompt to synthesize historical negotiation chat
    and suggest an optimal counter-offer price, compromise terms, and draft reply.
    """
    chat_summary = f"Buyer target budget: €{target_price:.2f}/kg. Supplier quote: €{current_quote_price:.2f}/kg."

    if thread_id:
        msgs_stmt = (
            select(Message)
            .where(Message.thread_id == thread_id)
            .order_by(Message.created_at.asc())
            .limit(10)
        )
        msgs = (await db.execute(msgs_stmt)).scalars().all()
        if msgs:
            chat_summary += "\nRecent Conversation:\n" + "\n".join(
                [f"- {m.body}" for m in msgs]
            )

    result = await generate_structured(
        prompt_name="negotiation_assist.v1",
        variables={"chat_history": chat_summary},
        pydantic_model=AINegotiationAssistOutput,
        session=db,
        feature_name="negotiation_assist",
    )
    return result


# --- Notifications Endpoints ---

@router.get("/notifications")
async def get_user_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
) -> Dict[str, Any]:
    """Retrieves notifications for the current user respecting their notification preferences."""
    # Check user settings
    user_settings = getattr(current_user, "settings", None) or {}
    notif_prefs = user_settings.get("notifications", {})

    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(limit * 2)
    )
    raw_notifications = (await db.execute(stmt)).scalars().all()

    # Map event_types to notification preference keys
    event_pref_map = {
        "message": "messages",
        "counter_offer": "messages",
        "rfq_matched": "rfq_updates",
        "rfq_update": "rfq_updates",
        "quote_received": "new_quotes",
        "quote_updated": "new_quotes",
        "order_created": "orders",
        "order_status_change": "orders",
        "shipment_update": "shipments",
        "document_verified": "document_verification",
    }

    filtered_notifications = []
    for n in raw_notifications:
        pref_key = event_pref_map.get(n.event_type)
        if not pref_key:
            title_lower = (n.title or "").lower()
            if "quote" in title_lower or "quotation" in title_lower:
                pref_key = "new_quotes"
            elif "rfq" in title_lower:
                pref_key = "rfq_updates"
            elif "order" in title_lower:
                pref_key = "orders"
            elif "shipment" in title_lower:
                pref_key = "shipments"
            elif "message" in title_lower:
                pref_key = "messages"
        if pref_key and notif_prefs.get(pref_key) is False:
            continue
        filtered_notifications.append(n)
        if len(filtered_notifications) >= limit:
            break

    unread_count = sum(1 for n in filtered_notifications if not n.is_read)

    return {
        "total_unread": int(unread_count),
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "event_type": n.event_type,
                "is_read": n.is_read,
                "link": n.link,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in filtered_notifications
        ],
    }


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Marks all notifications for current user as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.patch("/notifications/{notification_id}/read")
async def mark_single_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Marks a single notification as read."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok", "id": str(notification_id)}
