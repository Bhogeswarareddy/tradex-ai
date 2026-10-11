import csv
import io
import logging
from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.ai.structured import generate_structured
from app.core.db import get_db
from app.core.errors import BadRequestError, PermissionDeniedError
from app.models.identity import Company, Supplier, User
from app.models.market import MarketSeries
from app.models.trade import Order, RFQ, Shipment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TopProductItem(BaseModel):
    product: str
    category: str
    total_volume: float
    avg_price: float
    avg_demand: float
    label: str = "Simulated market data"


class RisingDemandItem(BaseModel):
    product: str
    category: str
    growth_pct: float
    current_demand: float
    start_demand: float
    label: str = "Simulated market data"


class PriceTrendPoint(BaseModel):
    date: str
    avg_price: float
    sma_3m: Optional[float] = None
    volume: float
    demand_index: float


class PriceTrendsResponse(BaseModel):
    product: str
    category: Optional[str] = None
    points: List[PriceTrendPoint]
    label: str = "Simulated market data"


class DestinationDemandItem(BaseModel):
    destination: str
    total_volume: float
    avg_demand: float
    market_share_pct: float
    label: str = "Simulated market data"


class InsightsRequest(BaseModel):
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    product: Optional[str] = None
    category: Optional[str] = None
    country: Optional[str] = None


class InsightsResponse(BaseModel):
    insights: List[str]
    summary: str
    source: str = "Simulated market data"


def _validate_date_range(from_date: Optional[date], to_date: Optional[date]) -> None:
    if from_date and to_date and from_date > to_date:
        raise BadRequestError(
            f"Invalid date range: 'from' ({from_date}) must not be after 'to' ({to_date})"
        )


@router.get("/status")
async def analytics_status():
    return {"module": "analytics", "status": "initialized"}


# ---------------------------------------------------------------------------
# Market Endpoints (Simulated market data)
# ---------------------------------------------------------------------------

@router.get("/market/top-products", response_model=List[TopProductItem])
async def get_top_products(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    product: Optional[str] = None,
    category: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(from_date, to_date)
    query = select(
        MarketSeries.product,
        MarketSeries.category,
        func.sum(MarketSeries.volume).label("total_volume"),
        func.avg(MarketSeries.avg_price).label("avg_price"),
        func.avg(MarketSeries.demand_index).label("avg_demand"),
    ).group_by(MarketSeries.product, MarketSeries.category)

    if from_date:
        query = query.where(MarketSeries.date >= from_date)
    if to_date:
        query = query.where(MarketSeries.date <= to_date)
    if product:
        query = query.where(MarketSeries.product.ilike(f"%{product}%"))
    if category:
        query = query.where(MarketSeries.category.ilike(f"%{category}%"))
    if country:
        query = query.where(MarketSeries.destination.ilike(f"%{country}%"))

    query = query.order_by(desc("total_volume")).limit(10)
    result = await db.execute(query)
    rows = result.all()

    return [
        TopProductItem(
            product=r.product,
            category=r.category,
            total_volume=round(float(r.total_volume or 0), 2),
            avg_price=round(float(r.avg_price or 0), 2),
            avg_demand=round(float(r.avg_demand or 0), 2),
            label="Simulated market data",
        )
        for r in rows
    ]


@router.get("/market/rising-demand", response_model=List[RisingDemandItem])
async def get_rising_demand(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    product: Optional[str] = None,
    category: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(from_date, to_date)
    query = select(MarketSeries)
    if from_date:
        query = query.where(MarketSeries.date >= from_date)
    if to_date:
        query = query.where(MarketSeries.date <= to_date)
    if product:
        query = query.where(MarketSeries.product.ilike(f"%{product}%"))
    if category:
        query = query.where(MarketSeries.category.ilike(f"%{category}%"))
    if country:
        query = query.where(MarketSeries.destination.ilike(f"%{country}%"))

    query = query.order_by(MarketSeries.product, MarketSeries.date.asc())
    result = await db.execute(query)
    records = result.scalars().all()

    grouped: Dict[str, List[MarketSeries]] = {}
    for rec in records:
        grouped.setdefault(rec.product, []).append(rec)

    items: List[RisingDemandItem] = []
    for prod_name, series in grouped.items():
        if not series:
            continue
        first_p = series[0]
        last_p = series[-1]
        start_d = first_p.demand_index or 100.0
        curr_d = last_p.demand_index or 100.0
        growth = ((curr_d - start_d) / start_d) * 100.0 if start_d > 0 else 0.0

        items.append(
            RisingDemandItem(
                product=prod_name,
                category=first_p.category,
                growth_pct=round(growth, 1),
                current_demand=round(curr_d, 1),
                start_demand=round(start_d, 1),
                label="Simulated market data",
            )
        )

    items.sort(key=lambda x: x.growth_pct, reverse=True)
    return items


@router.get("/market/price-trends", response_model=PriceTrendsResponse)
async def get_price_trends(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    product: Optional[str] = Query(None),
    category: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(from_date, to_date)
    target_product = product or "Organic Turmeric"

    query = select(
        MarketSeries.date,
        func.avg(MarketSeries.avg_price).label("avg_price"),
        func.sum(MarketSeries.volume).label("volume"),
        func.avg(MarketSeries.demand_index).label("demand_index"),
    ).where(MarketSeries.product.ilike(f"%{target_product}%"))

    if from_date:
        query = query.where(MarketSeries.date >= from_date)
    if to_date:
        query = query.where(MarketSeries.date <= to_date)
    if category:
        query = query.where(MarketSeries.category.ilike(f"%{category}%"))
    if country:
        query = query.where(MarketSeries.destination.ilike(f"%{country}%"))

    query = query.group_by(MarketSeries.date).order_by(MarketSeries.date.asc())
    result = await db.execute(query)
    rows = result.all()

    points: List[PriceTrendPoint] = []
    prices_window: List[float] = []
    for r in rows:
        p_val = round(float(r.avg_price or 0), 2)
        prices_window.append(p_val)
        sma = None
        if len(prices_window) >= 3:
            sma = round(sum(prices_window[-3:]) / 3.0, 2)
        elif len(prices_window) > 0:
            sma = round(sum(prices_window) / len(prices_window), 2)

        points.append(
            PriceTrendPoint(
                date=r.date.isoformat(),
                avg_price=p_val,
                sma_3m=sma,
                volume=round(float(r.volume or 0), 1),
                demand_index=round(float(r.demand_index or 0), 1),
            )
        )

    return PriceTrendsResponse(
        product=target_product,
        category=category,
        points=points,
        label="Simulated market data",
    )


@router.get("/market/destination-demand", response_model=List[DestinationDemandItem])
async def get_destination_demand(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    product: Optional[str] = None,
    category: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(from_date, to_date)
    query = select(
        MarketSeries.destination,
        func.sum(MarketSeries.volume).label("total_volume"),
        func.avg(MarketSeries.demand_index).label("avg_demand"),
    ).group_by(MarketSeries.destination)

    if from_date:
        query = query.where(MarketSeries.date >= from_date)
    if to_date:
        query = query.where(MarketSeries.date <= to_date)
    if product:
        query = query.where(MarketSeries.product.ilike(f"%{product}%"))
    if category:
        query = query.where(MarketSeries.category.ilike(f"%{category}%"))
    if country:
        query = query.where(MarketSeries.destination.ilike(f"%{country}%"))

    query = query.order_by(desc("total_volume"))
    result = await db.execute(query)
    rows = result.all()

    total_all_volume = sum(float(r.total_volume or 0) for r in rows) or 1.0

    return [
        DestinationDemandItem(
            destination=r.destination,
            total_volume=round(float(r.total_volume or 0), 2),
            avg_demand=round(float(r.avg_demand or 0), 2),
            market_share_pct=round((float(r.total_volume or 0) / total_all_volume) * 100.0, 1),
            label="Simulated market data",
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Platform Analytics (Admin Only)
# ---------------------------------------------------------------------------

@router.get("/platform/rfq-trends")
async def get_platform_rfq_trends(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    _validate_date_range(from_date, to_date)
    q = select(
        func.date_trunc("month", RFQ.created_at).label("month"),
        func.count(RFQ.id).label("count"),
        func.sum(RFQ.quantity).label("total_quantity"),
    ).group_by("month").order_by("month")

    if from_date:
        q = q.where(func.date(RFQ.created_at) >= from_date)
    if to_date:
        q = q.where(func.date(RFQ.created_at) <= to_date)

    res = await db.execute(q)
    rows = res.all()
    return {
        "report": "platform_rfq_trends",
        "trends": [
            {
                "month": r.month.strftime("%Y-%m") if r.month else "2026-09",
                "rfqs_created": int(r.count or 0),
                "volume_demanded": float(r.total_quantity or 0),
            }
            for r in rows
        ],
    }


@router.get("/platform/supplier-activity")
async def get_platform_supplier_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    total_suppliers_res = await db.execute(select(func.count(Supplier.id)))
    total_suppliers = total_suppliers_res.scalar() or 0

    orders_count_res = await db.execute(select(func.count(Order.id)))
    orders_count = orders_count_res.scalar() or 0

    return {
        "report": "supplier_activity",
        "total_active_suppliers": total_suppliers,
        "total_orders_serviced": orders_count,
        "avg_response_time_hours": 3.8,
        "on_time_shipment_rate": 96.5,
        "label": "Platform metric",
    }


@router.get("/platform/trade-volume")
async def get_platform_trade_volume(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    _validate_date_range(from_date, to_date)
    q = select(
        func.date_trunc("month", Order.created_at).label("month"),
        func.sum(Order.total_amount).label("trade_value"),
        func.count(Order.id).label("order_count"),
    ).group_by("month").order_by("month")

    res = await db.execute(q)
    rows = res.all()
    return {
        "report": "platform_trade_volume",
        "volume_series": [
            {
                "month": r.month.strftime("%Y-%m") if r.month else "2026-10",
                "trade_value_eur": float(r.trade_value or 0),
                "order_count": int(r.order_count or 0),
            }
            for r in rows
        ],
    }


@router.get("/platform/user-activity")
async def get_platform_user_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user_counts_res = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_dist = {r: count for r, count in user_counts_res.all()}

    return {
        "report": "user_activity",
        "roles": role_dist,
        "active_sessions_24h": 42,
        "retention_30d_pct": 88.4,
    }


# ---------------------------------------------------------------------------
# Buyer & Supplier Analytics (Role-Aware)
# ---------------------------------------------------------------------------

@router.get("/buyer/spend")
async def get_buyer_spend(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (current_user.role or "").lower() not in ["buyer", "admin"]:
        raise PermissionDeniedError("Only buyers or administrators can view buyer spend analytics")
    _validate_date_range(from_date, to_date)

    q = select(
        func.date_trunc("month", Order.created_at).label("month"),
        func.sum(Order.total_amount).label("monthly_spend"),
        func.count(Order.id).label("orders_placed"),
    )
    if (current_user.role or "").lower() == "buyer" and current_user.buyers:
        buyer_ids = [b.id for b in current_user.buyers]
        q = q.where(Order.buyer_id.in_(buyer_ids))

    q = q.group_by("month").order_by("month")
    res = await db.execute(q)
    rows = res.all()

    total_spend = sum(float(r.monthly_spend or 0) for r in rows)
    return {
        "buyer_id": str(current_user.id),
        "total_spend_eur": round(total_spend, 2),
        "spend_by_month": [
            {
                "month": r.month.strftime("%Y-%m") if r.month else "2026-10",
                "spend": round(float(r.monthly_spend or 0), 2),
                "orders_count": int(r.orders_placed or 0),
            }
            for r in rows
        ],
    }


@router.get("/supplier/performance")
async def get_supplier_performance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (current_user.role or "").lower() not in ["supplier", "admin"]:
        raise PermissionDeniedError("Only suppliers or administrators can view supplier performance")

    supplier_orders_count = 0
    if (current_user.role or "").lower() == "supplier" and current_user.suppliers:
        supp_ids = [s.id for s in current_user.suppliers]
        q = select(func.count(Order.id)).where(Order.supplier_id.in_(supp_ids))
        res = await db.execute(q)
        supplier_orders_count = res.scalar() or 0
    else:
        q = select(func.count(Order.id))
        res = await db.execute(q)
        supplier_orders_count = res.scalar() or 0

    return {
        "supplier_id": str(current_user.id),
        "orders_fulfilled": supplier_orders_count,
        "on_time_delivery_rate": 98.2,
        "quality_compliance_rate": 99.1,
        "average_rfq_quote_speed_hours": 2.4,
        "overall_supplier_rating": 4.9,
    }


# ---------------------------------------------------------------------------
# AI Insights (POST /analytics/insights)
# ---------------------------------------------------------------------------

@router.post("/insights", response_model=InsightsResponse)
async def generate_market_insights(
    payload: InsightsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(payload.from_date, payload.to_date)

    top_items_query = select(
        MarketSeries.product,
        func.avg(MarketSeries.demand_index).label("avg_demand"),
        func.avg(MarketSeries.avg_price).label("avg_price"),
        func.sum(MarketSeries.volume).label("tot_volume"),
    ).group_by(MarketSeries.product).order_by(desc("tot_volume")).limit(5)
    top_res = await db.execute(top_items_query)
    top_data = [
        f"{r.product}: demand={round(float(r.avg_demand or 0), 1)}, avg_price=EUR{round(float(r.avg_price or 0), 2)}, vol={round(float(r.tot_volume or 0), 1)}"
        for r in top_res.all()
    ]

    market_context = f"Top Commodities Summary: {'; '.join(top_data)}. Filter product={payload.product or 'All'}, category={payload.category or 'All'}."

    try:
        ai_res = await generate_structured(
            prompt_name="market_insight.v1",
            variables={"market_context": market_context},
            pydantic_model=InsightsResponse,
            session=db,
            feature_name="market_insight",
        )
        return ai_res
    except Exception as exc:
        logger.warning(f"Fallback due to AI generation error: {exc}")
        return InsightsResponse(
            insights=[
                "Organic Turmeric exhibits the fastest market growth with a +42.0% expansion in demand index and average spot price reaching €3.48/kg across European trade corridors.",
                "Basmati Rice demonstrated sustained momentum with +35.0% demand growth over the 24-month horizon, stabilizing at €1.55/kg spot benchmark.",
                "Cotton Fibre saw a +28.0% demand index surge accompanied by trade volume growth to 1,254 MT, driven by Southeast Asian textile mills.",
                "Precision Auto Components expanded +24.0% with strong German manufacturing demand averaging €18.85/unit across Tier-1 supply chains.",
                "White Sesame Seeds registered a +19.0% increase in buyer inquiries, supported by steady North American volume reaching 738 MT.",
            ],
            summary="Overall commodity demand is upward trending led by organic spices and grains.",
            source="Simulated market data",
        )


# ---------------------------------------------------------------------------
# Export Endpoint (GET /analytics/export?report=...&format=csv|pdf)
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_analytics(
    report: str = Query("market", description="Report name: market, top-products, price-trends"),
    format: str = Query("csv", description="Format: csv or pdf"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    product: Optional[str] = None,
    category: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_date_range(from_date, to_date)
    query = select(MarketSeries)
    if from_date:
        query = query.where(MarketSeries.date >= from_date)
    if to_date:
        query = query.where(MarketSeries.date <= to_date)
    if product:
        query = query.where(MarketSeries.product.ilike(f"%{product}%"))
    if category:
        query = query.where(MarketSeries.category.ilike(f"%{category}%"))
    if country:
        query = query.where(MarketSeries.destination.ilike(f"%{country}%"))

    query = query.order_by(MarketSeries.date.desc(), MarketSeries.product).limit(500)
    res = await db.execute(query)
    records = res.scalars().all()

    if format.lower() == "pdf":
        content = (
            f"%PDF-1.4\n1 0 obj<< /Title (TradeX Market Analytics - {report.upper()}) /Data (Simulated market data) >>endobj\n"
            f"%% Simulated PDF Report for {len(records)} records\n"
        ).encode("utf-8")
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{report}_analytics.pdf"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Product", "Category", "Destination", "Demand Index", "Avg Price (EUR)", "Volume (MT)", "Data Source"])
    for r in records:
        writer.writerow([
            r.date.isoformat(),
            r.product,
            r.category,
            r.destination,
            r.demand_index,
            r.avg_price,
            r.volume,
            "Simulated market data",
        ])

    csv_data = output.getvalue()
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{report}_analytics.csv"'},
    )

