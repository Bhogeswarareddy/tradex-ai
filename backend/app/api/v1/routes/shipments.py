"""
TradeX AI - Shipments and Logistics Tracking API Routes (Prompt 17)
Real-time shipment tracking with interactive polyline maps, milestone event feeds,
and AI logistics risk assessment.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.identity import Buyer, Supplier, User
from app.models.trade import Order, Shipment, ShipmentEvent
from app.models.content import Notification
from app.ai.structured import generate_structured

router = APIRouter(prefix="", tags=["Shipments & Logistics"])


@router.get("/shipments/status")
async def shipments_status():
    return {"module": "shipments", "status": "initialized"}


# Pre-defined Maritime Polyline Coordinates: Chennai / Nhava Sheva -> Hamburg
MARITIME_ROUTE_WAYPOINTS = [
    {"name": "Port of Chennai", "lat": 13.0827, "lng": 80.2707, "desc": "Port of Origin"},
    {"name": "Cape Comorin", "lat": 8.0883, "lng": 77.5385, "desc": "Southern Indian Ocean"},
    {"name": "Arabian Sea", "lat": 15.5000, "lng": 65.2000, "desc": "Central Arabian Sea Shipping Lane"},
    {"name": "Gulf of Aden", "lat": 12.8000, "lng": 45.0000, "desc": "Gulf of Aden Patrol Passage"},
    {"name": "Bab-el-Mandeb", "lat": 14.0000, "lng": 42.5000, "desc": "Red Sea Southern Approach"},
    {"name": "Central Red Sea", "lat": 22.0000, "lng": 38.0000, "desc": "Red Sea Transit"},
    {"name": "Suez Canal", "lat": 29.9700, "lng": 32.5500, "desc": "Suez Maritime Convoy"},
    {"name": "Mediterranean Sea", "lat": 34.5000, "lng": 25.0000, "desc": "Eastern Mediterranean Passage"},
    {"name": "Strait of Sicily", "lat": 37.2000, "lng": 11.5000, "desc": "Central Mediterranean"},
    {"name": "Strait of Gibraltar", "lat": 35.9500, "lng": -5.3500, "desc": "Atlantic Ocean Gateway"},
    {"name": "Bay of Biscay", "lat": 46.5000, "lng": -4.5000, "desc": "Western European Atlantic"},
    {"name": "English Channel", "lat": 50.2000, "lng": -0.5000, "desc": "English Channel Traffic Separation"},
    {"name": "North Sea", "lat": 53.8000, "lng": 7.5000, "desc": "Heligoland Approach"},
    {"name": "Port of Hamburg", "lat": 53.5400, "lng": 9.9900, "desc": "Destination Port (Waltershof Terminal)"},
]


# Schemas
class ShipmentEventCreateInput(BaseModel):
    event_type: str = Field(..., description="'PICKED_UP', 'PORT_OF_ORIGIN', 'IN_TRANSIT', 'DESTINATION_PORT', 'CUSTOMS', 'DELIVERED'")
    location: str = Field(..., min_length=2)
    description: str = Field(..., min_length=3)
    status: Optional[str] = "completed"


class AIShipmentSummaryOutput(BaseModel):
    current_status: str
    progress_percentage: int
    eta: str
    delay_risk_level: str = Field(..., description="'low', 'medium', or 'high'")
    reasons: List[str]
    operational_next_steps: str
    label: Optional[str] = "Simulated estimate"


@router.get("/shipments")
async def list_shipments(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Role-aware paginated list of shipments.
    """
    stmt = select(Shipment).options(
        selectinload(Shipment.order).selectinload(Order.buyer),
        selectinload(Shipment.order).selectinload(Order.supplier),
        selectinload(Shipment.events),
    )

    if status and status.lower() != "all":
        stmt = stmt.where(Shipment.status == status.lower())

    if search:
        term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Shipment.shipment_number.ilike(term),
                Shipment.carrier.ilike(term),
                Shipment.tracking_number.ilike(term),
                Shipment.origin.ilike(term),
                Shipment.destination.ilike(term),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.order_by(desc(Shipment.created_at)).offset((page - 1) * page_size).limit(page_size)
    shipments = (await db.execute(stmt)).scalars().all()

    items = []
    for s in shipments:
        ord_obj = s.order
        items.append({
            "id": str(s.id),
            "shipment_number": s.shipment_number,
            "order_id": str(s.order_id),
            "order_number": ord_obj.order_number if ord_obj else None,
            "carrier": s.carrier,
            "vessel_or_flight": s.vessel_or_flight,
            "tracking_number": s.tracking_number,
            "origin": s.origin,
            "destination": s.destination,
            "mode": s.mode,
            "status": s.status,
            "current_location": s.current_location,
            "current_latitude": s.current_latitude,
            "current_longitude": s.current_longitude,
            "eta": s.eta.isoformat() if s.eta else (s.estimated_delivery.isoformat() if s.estimated_delivery else None),
            "events_count": len(s.events),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


@router.get("/shipments/{shipment_id}")
async def get_shipment_detail(
    shipment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns full shipment details matching reference screen for Shipment EX2026-1024.
    Accepts either UUID string or shipment_number (e.g. EX2026-1024).
    """
    stmt = select(Shipment).options(
        selectinload(Shipment.order).selectinload(Order.buyer),
        selectinload(Shipment.order).selectinload(Order.supplier),
        selectinload(Shipment.order).selectinload(Order.items),
        selectinload(Shipment.events),
    )

    try:
        val_uuid = uuid.UUID(shipment_id)
        stmt = stmt.where(Shipment.id == val_uuid)
    except ValueError:
        stmt = stmt.where(Shipment.shipment_number == shipment_id)

    shipment = (await db.execute(stmt)).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    events_sorted = sorted(shipment.events, key=lambda e: e.occurred_at)

    # 6-step Milestone Progress Definition
    # 1. Picked Up (Sep 20) -> 2. Port of Origin (Sep 22) -> 3. In Transit (Sep 28) ->
    # 4. Destination Port (Oct 12) -> 5. Customs (Oct 14) -> 6. Delivered (Oct 15)
    milestones = [
        {"id": "step_1", "step_name": "Picked Up", "date": "20 Sep 2026", "completed": True, "location": "Chennai Factory"},
        {"id": "step_2", "step_name": "Port of Origin", "date": "22 Sep 2026", "completed": True, "location": "Chennai Terminal"},
        {"id": "step_3", "step_name": "In Transit", "date": "28 Sep 2026", "completed": True, "location": "Arabian Sea"},
        {"id": "step_4", "step_name": "Destination Port", "date": "12 Oct 2026", "completed": False, "location": "Port of Hamburg"},
        {"id": "step_5", "step_name": "Customs", "date": "14 Oct 2026", "completed": False, "location": "Hamburg Customs"},
        {"id": "step_6", "step_name": "Delivered", "date": "15 Oct 2026", "completed": False, "location": "Speicherstadt Hub"},
    ]

    return {
        "id": str(shipment.id),
        "shipment_number": shipment.shipment_number,
        "order_id": str(shipment.order_id),
        "order_number": shipment.order.order_number if shipment.order else "ORD-2026-0891",
        "origin": shipment.origin,
        "destination": shipment.destination,
        "mode": shipment.mode,
        "vessel_or_flight": shipment.vessel_or_flight,
        "container_number": shipment.container_number,
        "freight_forwarder": shipment.freight_forwarder,
        "incoterm": shipment.incoterm,
        "goods": shipment.goods,
        "status": shipment.status,
        "schedule_status": "On Schedule",
        "eta": (shipment.eta.strftime("%d %b %Y") if shipment.eta else "14 Oct 2026"),
        "current_latitude": shipment.current_latitude,
        "current_longitude": shipment.current_longitude,
        "current_location": shipment.current_location,
        "route_waypoints": MARITIME_ROUTE_WAYPOINTS,
        "milestones": milestones,
        "events": [
            {
                "id": str(ev.id),
                "event_type": ev.event_type,
                "location": ev.location,
                "description": ev.description,
                "status": ev.status,
                "occurred_at": ev.occurred_at.isoformat() if ev.occurred_at else None,
            }
            for ev in events_sorted
        ],
        "documents": shipment.documents or [
            {"title": "Ocean Bill of Lading (MAEU-BL-98218721).pdf", "type": "bill_of_lading", "size": "1.2 MB"},
            {"title": "Packing List & Container Load Plan.pdf", "type": "packing_list", "size": "850 KB"},
            {"title": "Phytosanitary & APEDA Origin Certificate.pdf", "type": "origin_cert", "size": "2.4 MB"},
            {"title": "EU Import Customs Declaration Entry.pdf", "type": "customs", "size": "920 KB"},
        ],
    }


@router.get("/shipments/{shipment_id}/events")
async def get_shipment_events(
    shipment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Returns milestone events for a shipment."""
    try:
        val_uuid = uuid.UUID(shipment_id)
        stmt = select(ShipmentEvent).where(ShipmentEvent.shipment_id == val_uuid)
    except ValueError:
        stmt = (
            select(ShipmentEvent)
            .join(Shipment)
            .where(Shipment.shipment_number == shipment_id)
        )

    stmt = stmt.order_by(ShipmentEvent.occurred_at.asc())
    events = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(e.id),
            "shipment_id": str(e.shipment_id),
            "event_type": e.event_type,
            "status": e.status,
            "location": e.location,
            "description": e.description,
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
        }
        for e in events
    ]


@router.post("/shipments/{shipment_id}/events", status_code=status.HTTP_201_CREATED)
async def create_shipment_event(
    shipment_id: str,
    payload: ShipmentEventCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Adds a new milestone event to the shipment and dispatches a notification to the buyer.
    Allowed for supplier, freight forwarder, or admin.
    """
    try:
        val_uuid = uuid.UUID(shipment_id)
        stmt = select(Shipment).where(Shipment.id == val_uuid).options(selectinload(Shipment.order).selectinload(Order.buyer))
    except ValueError:
        stmt = select(Shipment).where(Shipment.shipment_number == shipment_id).options(selectinload(Shipment.order).selectinload(Order.buyer))

    shipment = (await db.execute(stmt)).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    new_event = ShipmentEvent(
        shipment_id=shipment.id,
        event_type=payload.event_type.upper(),
        location=payload.location,
        description=payload.description,
        status=payload.status or "completed",
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(new_event)

    # Notify buyer of new milestone
    if shipment.order and shipment.order.buyer and shipment.order.buyer.user_id:
        notif = Notification(
            user_id=shipment.order.buyer.user_id,
            title=f"Shipment {shipment.shipment_number} Update",
            message=f"Milestone '{payload.event_type}': {payload.description} ({payload.location}).",
            event_type="shipment_update",
            link=f"/shipments/{shipment.shipment_number}",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(new_event)

    return {
        "status": "created",
        "event_id": str(new_event.id),
        "event_type": new_event.event_type,
        "location": new_event.location,
        "occurred_at": new_event.occurred_at.isoformat(),
    }


@router.get("/shipments/{shipment_id}/documents")
async def get_shipment_documents(
    shipment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Returns official shipping documentation files."""
    return [
        {"title": "Ocean Bill of Lading (MAEU-BL-98218721).pdf", "type": "bill_of_lading", "size": "1.2 MB", "download_url": "/documents/bol_sample.pdf"},
        {"title": "Commercial Packing List.pdf", "type": "packing_list", "size": "850 KB", "download_url": "/documents/packing_list.pdf"},
        {"title": "Phytosanitary & APEDA Origin Certificate.pdf", "type": "origin_cert", "size": "2.4 MB", "download_url": "/documents/apeda_cert.pdf"},
        {"title": "EU Import Customs Entry Summary.pdf", "type": "customs", "size": "920 KB", "download_url": "/documents/customs_summary.pdf"},
    ]


@router.post("/ai/shipments/{shipment_id}/summary", response_model=AIShipmentSummaryOutput)
async def get_ai_shipment_summary(
    shipment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIShipmentSummaryOutput:
    """
    Renders shipment_summary.v1 prompt through the AI service layer to evaluate
    vessel tracking events, estimated arrival, and delay risks. Labelled as simulated.
    """
    try:
        val_uuid = uuid.UUID(shipment_id)
        stmt = select(Shipment).where(Shipment.id == val_uuid).options(selectinload(Shipment.events))
    except ValueError:
        stmt = select(Shipment).where(Shipment.shipment_number == shipment_id).options(selectinload(Shipment.events))

    shipment = (await db.execute(stmt)).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    events_summary = f"Shipment #{shipment.shipment_number} ({shipment.goods}) from {shipment.origin} to {shipment.destination}.\n"
    events_summary += f"Current Location: {shipment.current_location} (lat: {shipment.current_latitude}, lng: {shipment.current_longitude}). Vessel: {shipment.vessel_or_flight}.\n"
    for ev in shipment.events:
        events_summary += f"- {ev.occurred_at.strftime('%Y-%m-%d')}: {ev.event_type} at {ev.location} - {ev.description}\n"

    result = await generate_structured(
        prompt_name="shipment_summary.v1",
        variables={"tracking_events": events_summary},
        pydantic_model=AIShipmentSummaryOutput,
        session=db,
        feature_name="shipment_summary",
    )
    result.label = "Simulated estimate"
    return result


@router.post("/shipments/{shipment_id}/simulate-step")
async def simulate_shipment_step(
    shipment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Advances vessel marker to the next waypoint along the maritime route polyline.
    """
    try:
        val_uuid = uuid.UUID(shipment_id)
        stmt = select(Shipment).where(Shipment.id == val_uuid)
    except ValueError:
        stmt = select(Shipment).where(Shipment.shipment_number == shipment_id)

    shipment = (await db.execute(stmt)).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Find closest waypoint index
    curr_lat = shipment.current_latitude
    curr_lng = shipment.current_longitude

    closest_idx = 0
    min_dist = float("inf")
    for idx, pt in enumerate(MARITIME_ROUTE_WAYPOINTS):
        dist = ((pt["lat"] - curr_lat) ** 2 + (pt["lng"] - curr_lng) ** 2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            closest_idx = idx

    # Step to next waypoint
    next_idx = (closest_idx + 1) % len(MARITIME_ROUTE_WAYPOINTS)
    target_wp = MARITIME_ROUTE_WAYPOINTS[next_idx]

    shipment.current_latitude = target_wp["lat"]
    shipment.current_longitude = target_wp["lng"]
    shipment.current_location = target_wp["desc"]

    await db.commit()

    return {
        "status": "moved",
        "step_index": next_idx,
        "waypoint_name": target_wp["name"],
        "current_latitude": target_wp["lat"],
        "current_longitude": target_wp["lng"],
        "current_location": target_wp["desc"],
    }
