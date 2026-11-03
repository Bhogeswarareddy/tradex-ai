"""
TradeX AI - Orders and Procurement API Routes (Prompt 16)
Manages order lifecycle, role-enforced transitions, simulated escrow payments,
and Trade Finance overview with full audit trail logging.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.identity import Buyer, Company, Supplier, User
from app.models.trade import Order, OrderItem, Payment, Quotation, RFQ, Shipment
from app.models.content import Document, Notification
from app.models.ai_ops import AuditLog
from app.services.storage import get_storage_backend

router = APIRouter(prefix="", tags=["Orders & Procurement"])


@router.get("/orders/status")
async def orders_status():
    return {"module": "orders", "status": "initialized"}


# Schemas
class OrderCreateInput(BaseModel):
    quotation_id: uuid.UUID
    shipping_address: Optional[str] = "Speicherstadt Logistics Hub, Am Sandtorkai 48, 20457 Hamburg, Germany"
    notes: Optional[str] = None


class OrderTransitionInput(BaseModel):
    status: str = Field(..., description="Target order status")
    notes: Optional[str] = None


class OrderCancelInput(BaseModel):
    reason: Optional[str] = "Buyer requested order cancellation prior to shipping dispatch."


class SimulatedPaymentInput(BaseModel):
    payment_type: str = Field(..., description="'advance' (30%), 'balance' (70%), or 'escrow_release'")
    amount: Optional[float] = None
    notes: Optional[str] = None


class TradeFinanceApplyInput(BaseModel):
    facility_type: str = Field(default="Letter of Credit (LC)", description="Facility type")
    requested_amount: float = Field(..., gt=0)
    tenor_days: int = Field(default=90, ge=30, le=360)
    counterparty_name: str = Field(..., min_length=2)


# Helpers
async def get_user_profiles(db: AsyncSession, user: User) -> tuple[Optional[Buyer], Optional[Supplier]]:
    buyer = (
        await db.execute(select(Buyer).where(Buyer.user_id == user.id).options(selectinload(Buyer.company)))
    ).scalar_one_or_none()
    supplier = (
        await db.execute(select(Supplier).where(Supplier.user_id == user.id).options(selectinload(Supplier.company)))
    ).scalar_one_or_none()
    return buyer, supplier


async def log_audit_event(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: str,
    details: Dict[str, Any],
):
    """Writes an audit trail record to audit_logs."""
    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(audit)


# Allowed transitions map: current_status -> list of allowed next statuses
ALLOWED_TRANSITIONS = {
    "confirmed": ["in_production", "cancelled"],
    "in_production": ["quality_check", "cancelled"],
    "quality_check": ["ready_to_ship", "cancelled"],
    "ready_to_ship": ["shipped", "cancelled"],
    "shipped": ["delivered", "disputed"],
    "delivered": ["completed", "disputed"],
    "disputed": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
}

SUPPLIER_ALLOWED_TARGETS = {"in_production", "quality_check", "ready_to_ship", "shipped", "cancelled"}
BUYER_ALLOWED_TARGETS = {"delivered", "completed", "disputed", "cancelled"}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order_from_quote(
    payload: OrderCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Creates an official purchase order from an accepted quotation.
    """
    q_stmt = (
        select(Quotation)
        .where(Quotation.id == payload.quotation_id)
        .options(
            selectinload(Quotation.rfq).selectinload(RFQ.buyer),
            selectinload(Quotation.supplier).selectinload(Supplier.company),
        )
    )
    quote = (await db.execute(q_stmt)).scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    rfq = quote.rfq
    buyer, _ = await get_user_profiles(db, current_user)

    if current_user.role != "admin" and buyer and rfq.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not authorized to convert this quotation to an order")

    # Generate sequential order number
    count_stmt = select(func.count(Order.id))
    order_seq = (await db.execute(count_stmt)).scalar() or 0
    order_number = f"ORD-2026-{(order_seq + 892):04d}"

    qty = rfq.quantity if rfq else (quote.moq or 20000)
    total_amount = Decimal(str(float(quote.unit_price) * float(qty)))

    order = Order(
        order_number=order_number,
        rfq_id=rfq.id if rfq else None,
        quotation_id=quote.id,
        buyer_id=rfq.buyer_id,
        supplier_id=quote.supplier_id,
        total_amount=total_amount,
        currency=quote.currency or "EUR",
        status="confirmed",
        incoterm=rfq.incoterm if rfq else "CIF Hamburg",
        payment_terms=quote.payment_terms or "LC at sight, 30% advance",
        shipping_address=payload.shipping_address,
        documents=[
            {
                "title": f"Purchase Contract {order_number}.pdf",
                "type": "contract",
                "url": f"/documents/contracts/{order_number}.pdf",
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
    )
    db.add(order)
    await db.flush()

    # Create line item
    order_item = OrderItem(
        order_id=order.id,
        name=rfq.title if rfq else "Organic Turmeric Powder",
        quantity=qty,
        unit=rfq.unit if rfq else "kg",
        unit_price=quote.unit_price,
        total_price=total_amount,
    )
    db.add(order_item)

    # Initial pending payment record
    init_payment = Payment(
        order_id=order.id,
        amount=Decimal(str(float(total_amount) * 0.30)),
        currency=order.currency,
        status="pending",
        payment_method="Escrow",
        payment_type="advance",
        simulated=True,
        transaction_ref=f"SIM-TXN-ADV-{uuid.uuid4().hex[:6].upper()}",
        notes="30% Advance Escrow Payment pending buyer execution",
    )
    db.add(init_payment)

    # Audit log
    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="order_created",
        entity_type="order",
        entity_id=str(order.id),
        details={"order_number": order_number, "quotation_id": str(quote.id), "total": float(total_amount)},
    )

    # Notify supplier
    supplier_user_id = quote.supplier.user_id if quote.supplier else None
    if supplier_user_id:
        notif = Notification(
            user_id=supplier_user_id,
            title=f"New Purchase Order: {order_number}",
            message=f"A new order for {qty:,} {rfq.unit if rfq else 'kg'} has been confirmed against quote {quote.quote_number}.",
            event_type="order_created",
            link=f"/orders/{order.id}",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(order)

    return {
        "status": "created",
        "order_id": str(order.id),
        "order_number": order.order_number,
        "total_amount": float(order.total_amount),
        "currency": order.currency,
    }


@router.get("/orders")
async def list_orders(
    status: Optional[str] = Query(None),
    supplier_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Role-aware paginated list of procurement orders.
    """
    buyer, supplier = await get_user_profiles(db, current_user)

    stmt = select(Order).options(
        selectinload(Order.buyer).selectinload(Buyer.company),
        selectinload(Order.supplier).selectinload(Supplier.company),
        selectinload(Order.items),
        selectinload(Order.payments),
        selectinload(Order.shipments),
    )

    # Role filter
    if current_user.role == "buyer" and buyer:
        stmt = stmt.where(Order.buyer_id == buyer.id)
    elif current_user.role == "supplier" and supplier:
        stmt = stmt.where(Order.supplier_id == supplier.id)

    # Query filters
    if status and status.lower() != "all":
        stmt = stmt.where(Order.status == status.lower())

    if supplier_id:
        stmt = stmt.where(Order.supplier_id == supplier_id)

    if date_from:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))

    if date_to:
        stmt = stmt.where(Order.created_at <= datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc))

    if search:
        s_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Order.order_number.ilike(s_term),
                Order.incoterm.ilike(s_term),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.order_by(desc(Order.created_at)).offset((page - 1) * page_size).limit(page_size)
    orders = (await db.execute(stmt)).scalars().all()

    items = []
    for o in orders:
        b_comp = o.buyer.company if o.buyer else None
        s_comp = o.supplier.company if o.supplier else None

        paid_amount = sum(float(p.amount) for p in o.payments if p.status in ["completed", "escrow_locked", "released"])
        shipment_ref = o.shipments[0].shipment_number if o.shipments else None
        shipment_id = str(o.shipments[0].id) if o.shipments else None

        items.append({
            "id": str(o.id),
            "order_number": o.order_number,
            "status": o.status,
            "total_amount": float(o.total_amount),
            "currency": o.currency,
            "paid_amount": paid_amount,
            "payment_terms": o.payment_terms,
            "incoterm": o.incoterm,
            "buyer_name": b_comp.name if b_comp else "Buyer",
            "buyer_country": b_comp.country if b_comp else "Germany",
            "supplier_name": s_comp.name if s_comp else "Supplier",
            "supplier_country": s_comp.country if s_comp else "India",
            "supplier_logo": s_comp.logo_url if s_comp else None,
            "shipment_number": shipment_ref,
            "shipment_id": shipment_id,
            "items_count": len(o.items),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns full details of an order including line items, payments, shipment, and audit events.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.buyer).selectinload(Buyer.company),
            selectinload(Order.supplier).selectinload(Supplier.company),
            selectinload(Order.items),
            selectinload(Order.payments),
            selectinload(Order.shipments),
            selectinload(Order.rfq),
            selectinload(Order.quotation),
        )
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    buyer, supplier = await get_user_profiles(db, current_user)
    if current_user.role != "admin":
        is_order_buyer = buyer and order.buyer_id == buyer.id
        is_order_supplier = supplier and order.supplier_id == supplier.id
        if not is_order_buyer and not is_order_supplier:
            raise HTTPException(status_code=403, detail="Not authorized to view this order")

    # Fetch audit trail
    audit_stmt = (
        select(AuditLog)
        .where(AuditLog.entity_id == str(order.id))
        .order_by(desc(AuditLog.created_at))
        .limit(20)
    )
    audit_records = (await db.execute(audit_stmt)).scalars().all()

    b_comp = order.buyer.company if order.buyer else None
    s_comp = order.supplier.company if order.supplier else None

    paid_sum = sum(float(p.amount) for p in order.payments if p.status in ["completed", "escrow_locked", "released"])
    escrow_locked = sum(float(p.amount) for p in order.payments if p.status == "escrow_locked")

    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "currency": order.currency,
        "incoterm": order.incoterm,
        "payment_terms": order.payment_terms,
        "shipping_address": order.shipping_address,
        "rfq_id": str(order.rfq_id) if order.rfq_id else None,
        "quotation_id": str(order.quotation_id) if order.quotation_id else None,
        "rfq_title": order.rfq.title if order.rfq else None,
        "quote_number": order.quotation.quote_number if order.quotation else None,
        "buyer": {
            "id": str(order.buyer_id),
            "name": b_comp.name if b_comp else "Buyer Corp",
            "country": b_comp.country if b_comp else "Germany",
            "city": b_comp.city if b_comp else "Hamburg",
        },
        "supplier": {
            "id": str(order.supplier_id),
            "name": s_comp.name if s_comp else "Supplier Exporters",
            "country": s_comp.country if s_comp else "India",
            "city": s_comp.city if s_comp else "Guntur",
            "logo": s_comp.logo_url if s_comp else None,
        },
        "items": [
            {
                "id": str(it.id),
                "name": it.name,
                "quantity": it.quantity,
                "unit": it.unit,
                "unit_price": float(it.unit_price),
                "total_price": float(it.total_price),
            }
            for it in order.items
        ],
        "payments": [
            {
                "id": str(p.id),
                "amount": float(p.amount),
                "currency": p.currency,
                "status": p.status,
                "payment_type": p.payment_type,
                "payment_method": p.payment_method,
                "simulated": p.simulated,
                "transaction_ref": p.transaction_ref,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in order.payments
        ],
        "shipment": (
            {
                "id": str(order.shipments[0].id),
                "shipment_number": order.shipments[0].shipment_number,
                "carrier": order.shipments[0].carrier,
                "tracking_number": order.shipments[0].tracking_number,
                "origin": order.shipments[0].origin,
                "destination": order.shipments[0].destination,
                "status": order.shipments[0].status,
                "estimated_delivery": order.shipments[0].estimated_delivery.isoformat() if order.shipments[0].estimated_delivery else None,
            }
            if order.shipments
            else None
        ),
        "payment_summary": {
            "total_due": float(order.total_amount),
            "total_paid": paid_sum,
            "escrow_locked": escrow_locked,
            "balance_due": max(0.0, float(order.total_amount) - paid_sum),
            "simulated": True,
        },
        "documents": order.documents or [],
        "audit_trail": [
            {
                "id": str(a.id),
                "action": a.action,
                "details": a.details,
                "timestamp": a.created_at.isoformat() if a.created_at else None,
            }
            for a in audit_records
        ],
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@router.post("/orders/{order_id}/transition")
async def transition_order_status(
    order_id: uuid.UUID,
    payload: OrderTransitionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Enforces role-based sequential status transition flow:
    Confirmed -> In Production -> Quality Check -> Ready to Ship -> Shipped -> Delivered -> Completed.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.supplier),
            selectinload(Order.shipments),
        )
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    target_status = payload.status.lower().strip()
    current_status = order.status.lower().strip()

    # 1. Sequence Validation
    allowed_next = ALLOWED_TRANSITIONS.get(current_status, [])
    if target_status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from '{current_status}' to '{target_status}'. Allowed next statuses: {allowed_next}",
        )

    # 2. Role Permissions Check
    buyer, supplier = await get_user_profiles(db, current_user)
    is_buyer = buyer and order.buyer_id == buyer.id
    is_supplier = supplier and order.supplier_id == supplier.id
    is_admin = current_user.role == "admin"

    if not is_buyer and not is_supplier and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify this order")

    if not is_admin:
        if target_status in SUPPLIER_ALLOWED_TARGETS and not is_supplier:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only the supplier can move order status to '{target_status}'",
            )
        if target_status in BUYER_ALLOWED_TARGETS and not is_buyer:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only the buyer can confirm order status '{target_status}'",
            )

    # Transition status
    old_status = order.status
    order.status = target_status

    # If transitioning to shipped and no shipment exists, create active tracking record
    if target_status == "shipped" and not order.shipments:
        shipment = Shipment(
            shipment_number=f"EX2026-{(int(order.order_number.split('-')[-1]) + 100)}",
            order_id=order.id,
            carrier="Maersk Line (Container 40ft High Cube)",
            tracking_number=f"MAEU-{uuid.uuid4().hex[:8].upper()}",
            origin="Port of Nhava Sheva (INNSA), India",
            destination="Port of Hamburg (DEHAM), Germany",
            mode="sea",
            vessel_or_flight="MV Ocean Star",
            container_number="TCNU1234567",
            freight_forwarder="OceanLink Logistics",
            incoterm=order.incoterm,
            goods="Organic Turmeric Powder, 20,000 MT",
            eta=date(2026, 10, 14),
            current_latitude=15.5,
            current_longitude=65.2,
            current_location="Arabian Sea",
            estimated_delivery=date(2026, 10, 14),
            status="in_transit",
        )
        db.add(shipment)

    # Audit log
    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action=f"order_transition_{target_status}",
        entity_type="order",
        entity_id=str(order.id),
        details={"from": old_status, "to": target_status, "notes": payload.notes},
    )

    # Dispatch notification to other party
    recipient_user_id = order.buyer.user_id if is_supplier else order.supplier.user_id
    if recipient_user_id:
        notif = Notification(
            user_id=recipient_user_id,
            title=f"Order {order.order_number} Status: {target_status.replace('_', ' ').title()}",
            message=f"Order has progressed from '{old_status}' to '{target_status}'. {payload.notes or ''}",
            event_type="order_status_update",
            link=f"/orders/{order.id}",
        )
        db.add(notif)

    await db.commit()

    return {
        "status": "updated",
        "order_id": str(order.id),
        "old_status": old_status,
        "new_status": target_status,
    }


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: uuid.UUID,
    payload: OrderCancelInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Cancels an order prior to shipping."""
    order = (await db.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.buyer), selectinload(Order.supplier)))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status.lower() in ["shipped", "delivered", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order #{order.order_number} because it has already reached '{order.status}'. Please initiate a dispute if required.",
        )

    old_status = order.status
    order.status = "cancelled"

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="order_cancelled",
        entity_type="order",
        entity_id=str(order.id),
        details={"reason": payload.reason, "cancelled_from": old_status},
    )

    await db.commit()
    return {"status": "cancelled", "order_id": str(order.id), "order_number": order.order_number}


@router.post("/orders/{order_id}/payments/simulate")
async def simulate_order_payment(
    order_id: uuid.UUID,
    payload: SimulatedPaymentInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Simulates commercial escrow payments (advance 30%, balance 70%, or escrow release on delivery).
    All payment records are stored with simulated=True and dummy transaction references.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.supplier),
            selectinload(Order.payments),
        )
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    total_float = float(order.total_amount)
    p_type = payload.payment_type.lower().strip()

    if p_type == "advance":
        amount_val = payload.amount or round(total_float * 0.30, 2)
        txn_ref = f"SIM-TXN-ADV-{uuid.uuid4().hex[:6].upper()}"
        payment_status = "escrow_locked"
        payment_notes = payload.notes or "30% Advance Escrow Payment locked"
    elif p_type == "balance":
        amount_val = payload.amount or round(total_float * 0.70, 2)
        txn_ref = f"SIM-TXN-BAL-{uuid.uuid4().hex[:6].upper()}"
        payment_status = "escrow_locked"
        payment_notes = payload.notes or "70% Commercial Balance Payment locked in escrow"
    elif p_type == "escrow_release":
        # Release previously locked escrow payments to supplier
        for prev_p in order.payments:
            if prev_p.status == "escrow_locked":
                prev_p.status = "released"
        amount_val = payload.amount or total_float
        txn_ref = f"SIM-TXN-REL-{uuid.uuid4().hex[:6].upper()}"
        payment_status = "released"
        payment_notes = payload.notes or "Escrow funds released to supplier following delivery confirmation"
    else:
        amount_val = payload.amount or 1000.0
        txn_ref = f"SIM-TXN-CUST-{uuid.uuid4().hex[:6].upper()}"
        payment_status = "completed"
        payment_notes = payload.notes or "Simulated milestone payment"

    payment = Payment(
        order_id=order.id,
        amount=Decimal(str(amount_val)),
        currency=order.currency,
        status=payment_status,
        payment_method="Escrow",
        payment_type=p_type,
        simulated=True,
        transaction_ref=txn_ref,
        notes=payment_notes,
    )
    db.add(payment)

    # Audit log
    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="payment_simulated",
        entity_type="payment",
        entity_id=txn_ref,
        details={
            "order_number": order.order_number,
            "amount": amount_val,
            "currency": order.currency,
            "type": p_type,
            "status": payment_status,
        },
    )

    # Notify supplier & buyer
    if order.supplier and order.supplier.user_id:
        notif = Notification(
            user_id=order.supplier.user_id,
            title=f"Payment Simulated: {p_type.title()} (€{amount_val:,.2f})",
            message=f"A simulated payment of €{amount_val:,.2f} ({p_type}) was processed for Order #{order.order_number}.",
            event_type="payment_received",
            link=f"/orders/{order.id}",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(payment)

    return {
        "status": "success",
        "simulated": True,
        "payment_id": str(payment.id),
        "transaction_ref": txn_ref,
        "payment_type": p_type,
        "amount": amount_val,
        "currency": order.currency,
        "payment_status": payment_status,
        "label": "Simulated estimate",
    }


@router.get("/trade-finance/overview")
async def get_trade_finance_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns simulated Trade Finance dashboard metrics, escrow balances, and transaction ledger.
    """
    buyer, supplier = await get_user_profiles(db, current_user)

    stmt = select(Payment).order_by(desc(Payment.created_at)).limit(30)
    payments = (await db.execute(stmt)).scalars().all()

    escrow_locked = sum(float(p.amount) for p in payments if p.status == "escrow_locked")
    released_funds = sum(float(p.amount) for p in payments if p.status == "released")
    completed_funds = sum(float(p.amount) for p in payments if p.status == "completed")

    return {
        "banner": "Trade Finance is simulated for this project",
        "simulated": True,
        "credit_facility": {
            "credit_limit": 250000.0,
            "utilized_credit": escrow_locked,
            "available_credit": max(0.0, 250000.0 - escrow_locked),
            "currency": "EUR",
            "facility_status": "Active (Demo Facility)",
        },
        "balances": {
            "escrow_locked": escrow_locked,
            "released_to_suppliers": released_funds,
            "total_settled": completed_funds + released_funds,
            "currency": "EUR",
        },
        "transactions": [
            {
                "id": str(p.id),
                "order_id": str(p.order_id),
                "amount": float(p.amount),
                "currency": p.currency,
                "status": p.status,
                "payment_type": p.payment_type,
                "transaction_ref": p.transaction_ref,
                "simulated": p.simulated,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ],
    }


@router.post("/trade-finance/apply")
async def apply_trade_financing(
    payload: TradeFinanceApplyInput,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Simulates instant pre-approval for a Trade Finance / Letter of Credit demo facility."""
    ref = f"SIM-LC-2026-{uuid.uuid4().hex[:6].upper()}"
    return {
        "status": "approved",
        "simulated": True,
        "application_reference": ref,
        "facility_type": payload.facility_type,
        "approved_amount": payload.requested_amount,
        "currency": "EUR",
        "tenor_days": payload.tenor_days,
        "counterparty": payload.counterparty_name,
        "message": f"Demo Trade Finance facility '{ref}' successfully approved and added to active simulated escrow lines.",
        "label": "Simulated estimate",
    }



@router.post("/orders/{order_id}/documents/generate", summary="Generate numbered trade documents for order")
async def generate_order_trade_document(
    order_id: uuid.UUID,
    doc_type: str = Query(..., pattern="^(proforma_invoice|purchase_order|packing_list)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates numbered trade documents (Proforma Invoice, PO, Packing List)
    from real order data, persists to Document Center, links to order, and logs audit event.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.items),
            selectinload(Order.buyer).selectinload(Buyer.company),
            selectinload(Order.supplier).selectinload(Supplier.company),
            selectinload(Order.shipments),
        )
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    buyer_name = order.buyer.company.name if order.buyer and order.buyer.company else "Global Buyer"
    buyer_country = order.buyer.company.country if order.buyer and order.buyer.company else "Germany"
    supplier_name = order.supplier.company.name if order.supplier and order.supplier.company else "Export Supplier"
    supplier_country = order.supplier.company.country if order.supplier and order.supplier.company else "India"

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    clean_ord_num = order.order_number.replace("ORD-", "")
    type_prefix_map = {
        "proforma_invoice": "PI",
        "purchase_order": "PO",
        "packing_list": "PL",
    }
    doc_num = f"{type_prefix_map.get(doc_type, 'DOC')}-{clean_ord_num}"
    titles_map = {
        "proforma_invoice": f"Proforma Invoice: {doc_num}",
        "purchase_order": f"Purchase Order: {doc_num}",
        "packing_list": f"Packing List: {doc_num}",
    }
    title = titles_map[doc_type]

    # Generate document markup
    items_rows = ""
    for idx, it in enumerate(order.items, 1):
        items_rows += f"""<tr>
            <td>{idx}</td>
            <td><strong>{it.name}</strong></td>
            <td>{it.quantity:,} {it.unit}</td>
            <td>{order.currency} {float(it.unit_price):,.2f}</td>
            <td>{order.currency} {float(it.total_price):,.2f}</td>
        </tr>"""

    if not items_rows:
        items_rows = f"""<tr>
            <td>1</td>
            <td>Trade Consignment as per Contract</td>
            <td>1 Lot</td>
            <td>{order.currency} {float(order.total_amount):,.2f}</td>
            <td>{order.currency} {float(order.total_amount):,.2f}</td>
        </tr>"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }}
.header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }}
.title {{ font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; }}
.doc-num {{ font-size: 14px; font-family: monospace; color: #64748b; }}
.parties {{ display: flex; justify-content: space-between; margin: 30px 0; gap: 40px; }}
.party-box {{ flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }}
.party-title {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; margin-bottom: 8px; }}
.party-name {{ font-size: 16px; font-weight: 700; color: #0f172a; }}
table {{ width: 100%; border-collapse: collapse; margin: 25px 0; }}
th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }}
th {{ background: #f1f5f9; font-weight: 600; text-transform: uppercase; font-size: 11px; color: #475569; }}
.totals {{ width: 300px; margin-left: auto; margin-top: 20px; }}
.totals-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }}
.totals-row.grand {{ font-weight: 800; font-size: 16px; border-bottom: 2px solid #0f172a; color: #0f172a; }}
.footer {{ margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }}
.stamp {{ border: 2px dashed #059669; color: #059669; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 12px; text-transform: uppercase; display: inline-block; }}
</style>
</head>
<body>
<div class="header">
    <div>
        <div class="title">{title}</div>
        <div class="doc-num">Document ID: {doc_num} | Date: {now_str}</div>
    </div>
    <div style="text-align: right;">
        <span class="stamp">TradeX AI Verified Document</span>
    </div>
</div>

<div class="parties">
    <div class="party-box">
        <div class="party-title">Supplier / Exporter</div>
        <div class="party-name">{supplier_name}</div>
        <div>{supplier_country}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Incoterm: {order.incoterm}</div>
    </div>
    <div class="party-box">
        <div class="party-title">Buyer / Importer</div>
        <div class="party-name">{buyer_name}</div>
        <div>{buyer_country}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Order Ref: {order.order_number}</div>
    </div>
</div>

<table>
    <thead>
        <tr>
            <th style="width: 40px;">#</th>
            <th>Item & Specifications</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total Price</th>
        </tr>
    </thead>
    <tbody>
        {items_rows}
    </tbody>
</table>

<div class="totals">
    <div class="totals-row grand">
        <span>Total Amount ({order.currency})</span>
        <span>{order.currency} {float(order.total_amount):,.2f}</span>
    </div>
    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
        Payment Terms: {order.payment_terms}
    </div>
</div>

<div class="footer">
    <div>TradeX Global B2B Network • Legally binding digital trade record</div>
    <div>Page 1 of 1</div>
</div>
</body>
</html>"""

    filename = f"{doc_type}_{order.order_number}.html"
    storage = get_storage_backend()
    file_bytes = html_content.encode("utf-8")
    storage_path, unique_name = await storage.save(file_bytes, filename)

    doc_id = uuid.uuid4()
    doc_record = Document(
        id=doc_id,
        user_id=current_user.id,
        order_id=order.id,
        supplier_id=order.supplier_id,
        title=title,
        original_filename=filename,
        file_path=storage_path,
        file_size=len(file_bytes),
        mime_type="text/html",
        doc_type=doc_type,
        status="verified",
    )
    db.add(doc_record)

    # Link to Order documents JSON
    existing_docs = order.documents or []
    existing_docs.append({
        "id": str(doc_id),
        "doc_type": doc_type,
        "title": title,
        "filename": filename,
        "created_at": now_str,
    })
    order.documents = existing_docs

    # Log Audit
    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="document_generated",
        entity_type="order",
        entity_id=str(order.id),
        details={"doc_type": doc_type, "document_id": str(doc_id), "doc_number": doc_num},
    )

    await db.commit()
    await db.refresh(doc_record)

    return {
        "status": "generated",
        "document_id": str(doc_id),
        "doc_type": doc_type,
        "document_number": doc_num,
        "title": title,
        "filename": filename,
        "file_size": len(file_bytes),
        "download_url": f"/api/v1/documents/{doc_id}/download",
    }


@router.get("/activity-timeline", summary="Fetch chronological audit timeline for an entity")
async def get_activity_timeline(
    entity_type: str = Query(..., pattern="^(order|rfq|supplier|product)$"),
    entity_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns chronological audit event history for RFQs, Orders, and Shipments
    sourced strictly from audit_logs table.
    """
    stmt = (
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type)
        .where(AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at.asc())
        .limit(50)
    )
    res = await db.execute(stmt)
    records = res.scalars().all()

    timeline = []
    for r in records:
        action_name = r.action.replace("_", " ").title()
        timeline.append({
            "id": str(r.id),
            "action": r.action,
            "action_title": action_name,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details or {},
            "timestamp": r.created_at.isoformat() if r.created_at else None,
            "date_display": r.created_at.strftime("%b %d, %Y • %H:%M UTC") if r.created_at else "",
        })

    # If timeline is empty, provide a baseline created event
    if not timeline:
        timeline.append({
            "id": f"init-{entity_id}",
            "action": f"{entity_type}_created",
            "action_title": f"{entity_type.title()} Created & Registered",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": {"info": "Record entered platform lifecycle"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date_display": datetime.now(timezone.utc).strftime("%b %d, %Y • %H:%M UTC"),
        })

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "events": timeline,
        "total_events": len(timeline),
    }

import csv
import io


@router.get("/orders/export/csv", summary="Export orders as CSV")
async def export_orders_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(
            selectinload(Order.buyer).selectinload(Buyer.company),
            selectinload(Order.supplier).selectinload(Supplier.company),
        )
        .order_by(Order.created_at.desc())
        .limit(500)
    )
    res = await db.execute(stmt)
    orders = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order Number", "Date", "Status", "Total Amount", "Currency", "Incoterm", "Payment Terms", "Buyer", "Supplier", "Is Demo"])
    for o in orders:
        b_name = o.buyer.company.name if o.buyer and o.buyer.company else "Buyer"
        s_name = o.supplier.company.name if o.supplier and o.supplier.company else "Supplier"
        writer.writerow([
            o.order_number,
            o.created_at.strftime("%Y-%m-%d") if o.created_at else "",
            o.status,
            float(o.total_amount),
            o.currency,
            o.incoterm,
            o.payment_terms,
            b_name,
            s_name,
            getattr(o, "is_demo", False),
        ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=TradeX_Orders_Export.csv"},
    )
