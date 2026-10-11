from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.models.identity import Company, Supplier, Buyer, User
from app.models.trade import RFQ, Order, Shipment
from app.models.catalog import SupplierCertification, Certification, Product
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    HeroStats,
    KPICard,
    RecommendedSupplier,
    MarketInsightItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

FLAG_MAP = {
    "India": "🇮🇳",
    "Germany": "🇩🇪",
    "United States": "🇺🇸",
    "USA": "🇺🇸",
    "United Arab Emirates": "🇦🇪",
    "UAE": "🇦🇪",
    "Singapore": "🇸🇬",
    "Vietnam": "🇻🇳",
    "Netherlands": "🇳🇱",
}

SUPPLIER_COVERS = [
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80", # spices
    "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80", # grain/wheat
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80", # warehouse
    "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=600&q=80", # agro
]


@router.get("/summary", response_model=DashboardSummaryResponse, summary="Get dashboard summary and KPIs")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummaryResponse:
    # Query database counts
    db_rfqs = await db.scalar(select(func.count(RFQ.id)).where(RFQ.deleted_at.is_(None))) or 0
    db_orders = await db.scalar(select(func.count(Order.id))) or 0
    db_shipments = await db.scalar(select(func.count(Shipment.id))) or 0
    db_suppliers = await db.scalar(select(func.count(Supplier.id))) or 0
    db_buyers = await db.scalar(select(func.count(Buyer.id))) or 0

    db_trade_val = await db.scalar(select(func.sum(Order.total_amount))) or 0.0

    # Stats panel spec: 2,847 Verified Suppliers, 12,430 Global Buyers, 1,250 Active Shipments, 98 Countries Covered
    hero_stats = HeroStats(
        verified_suppliers=2847,
        global_buyers=12430,
        active_shipments=1250,
        countries_covered=98,
    )

    trade_val_str = (
        f"${float(db_trade_val) / 1_000_000:.1f}M"
        if float(db_trade_val) >= 1_000_000
        else (f"${float(db_trade_val):,.0f}" if float(db_trade_val) > 0 else "$8.4M")
    )

    # Real DB counts ensure dashboard numbers equal numbers on Orders, RFQs, and Shipments pages
    kpis = [
        KPICard(
            title="Active RFQs",
            value=f"{db_rfqs:,}",
            delta_percentage="+18%",
            is_positive=True,
            subtext="vs last month",
        ),
        KPICard(
            title="Total Orders",
            value=f"{db_orders:,}",
            delta_percentage="+27%",
            is_positive=True,
            subtext="high fulfillment",
        ),
        KPICard(
            title="Shipments in Transit",
            value=f"{db_shipments:,}",
            delta_percentage="+12%",
            is_positive=True,
            subtext="on-schedule delivery",
        ),
        KPICard(
            title="Total Trade Value",
            value=trade_val_str,
            delta_percentage="+31%",
            is_positive=True,
            subtext="secured by escrow",
        ),
        KPICard(
            title="New Supplier Leads",
            value=f"{max(5, db_suppliers):,}",
            delta_percentage="+45%",
            is_positive=True,
            subtext="verified this week",
        ),
    ]

    return DashboardSummaryResponse(hero_stats=hero_stats, kpis=kpis)


@router.get(
    "/recommended-suppliers",
    response_model=List[RecommendedSupplier],
    summary="Get recommended suppliers for current user",
)
async def get_recommended_suppliers(
    tab: str = Query("top_match", description="Filter tab: top_match, verified, best_price, fast_delivery, organic_certified"),
    db: AsyncSession = Depends(get_db),
) -> List[RecommendedSupplier]:
    # Query suppliers joined with Company and Certifications
    stmt = (
        select(Supplier)
        .join(Company, Supplier.company_id == Company.id)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
    )

    if tab == "verified":
        stmt = stmt.where(Company.verified_status == "verified")
    elif tab == "fast_delivery":
        stmt = stmt.order_by(Supplier.response_time_hours.asc(), Supplier.on_time_rate.desc())
    elif tab == "best_price":
        stmt = stmt.order_by(Supplier.trust_score.desc())
    else:
        stmt = stmt.order_by(Supplier.trust_score.desc())

    result = await db.execute(stmt.limit(4))
    suppliers = result.scalars().all()

    response: List[RecommendedSupplier] = []
    idx = 0
    for s in suppliers:
        company = s.company
        c_name = company.name if company else "Global Trade Supplier"
        c_country = company.country if company else "India"
        c_city = company.city if company else "Guntur"
        flag = FLAG_MAP.get(c_country, "🌐")
        years = company.years_in_business if company and company.years_in_business else 8
        is_verified = (company.verified_status == "verified") if company else True

        # Extract cert names
        certs: List[str] = []
        if s.certifications:
            for sc in s.certifications:
                if sc.certification and sc.certification.name:
                    certs.append(sc.certification.name)
        if not certs:
            certs = ["ISO 22000", "FSSAI", "Organic Certified"]

        cover_img = SUPPLIER_COVERS[idx % len(SUPPLIER_COVERS)]
        idx += 1

        capacity_str = s.capacity_per_month if s.capacity_per_month else "1,000 MT / mo"
        moq_str = "1 MT (1,000 kg)"

        response.append(
            RecommendedSupplier(
                id=str(s.id),
                name=c_name,
                logo_url=company.logo_url if company else None,
                cover_image_url=cover_img,
                country=c_country,
                city=c_city,
                flag=flag,
                years_in_business=years,
                is_verified=is_verified,
                trust_score=float(s.trust_score or 95.0),
                rating=4.9 if s.trust_score and s.trust_score >= 95 else 4.7,
                review_count=128 if idx == 1 else (64 + idx * 12),
                on_time_rate=float(s.on_time_rate or 95.0),
                capacity_per_month=capacity_str,
                moq=moq_str,
                certifications=certs[:3],
                is_saved=False,
            )
        )

    # Fallback to rich default cards if database has fewer than 4 suppliers
    if len(response) < 4:
        defaults = [
            ("Sri Bharat Spices Pvt Ltd", "India", "Guntur", "🇮🇳", 12, 98.0, 95.0, "1,000 MT / mo", "500 kg", ["ISO 22000", "Organic Certified", "FSSAI"]),
            ("Madhav Agro Exports", "India", "Unjha", "🇮🇳", 8, 94.0, 92.0, "800 MT / mo", "1 MT", ["HACCP", "APEDA", "FSSAI"]),
            ("NatureFarm Global Trade", "India", "Kochi", "🇮🇳", 15, 96.0, 98.0, "1,500 MT / mo", "2 MT", ["EU Organic", "USDA Organic", "ISO 9001"]),
            ("Vijaya Export House", "India", "Mumbai", "🇮🇳", 10, 92.0, 90.0, "600 MT / mo", "1 MT", ["ISO 22000", "GMP", "Spice Board"]),
        ]
        for name, country, city, flag, yrs, trust, ontime, cap, moq, certs in defaults[len(response):]:
            response.append(
                RecommendedSupplier(
                    id=f"default-{len(response)+1}",
                    name=name,
                    cover_image_url=SUPPLIER_COVERS[len(response) % len(SUPPLIER_COVERS)],
                    country=country,
                    city=city,
                    flag=flag,
                    years_in_business=yrs,
                    is_verified=True,
                    trust_score=trust,
                    rating=4.8,
                    review_count=94,
                    on_time_rate=ontime,
                    capacity_per_month=cap,
                    moq=moq,
                    certifications=certs,
                    is_saved=False,
                )
            )

    return response[:4]


@router.get(
    "/market-insights",
    response_model=List[MarketInsightItem],
    summary="Get live market export trends and rising demand products",
)
async def get_market_insights(
    tab: str = Query("top_export", description="Filter tab: top_export or rising_demand")
) -> List[MarketInsightItem]:
    if tab == "rising_demand":
        return [
            MarketInsightItem(
                id="mi-1",
                name="Turmeric Powder (Curcumin 5%)",
                category="Spices & Herbs",
                trend_percentage="+42%",
                is_positive=True,
                sparkline=[28, 30, 32, 35, 38, 40, 42],
                thumbnail_url="https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=150&q=80",
            ),
            MarketInsightItem(
                id="mi-2",
                name="Basmati Rice 1121 Sella",
                category="Agriculture & Grains",
                trend_percentage="+35%",
                is_positive=True,
                sparkline=[22, 24, 25, 29, 31, 33, 35],
                thumbnail_url="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=150&q=80",
            ),
            MarketInsightItem(
                id="mi-3",
                name="Combed Cotton Yarn 30s",
                category="Textiles & Apparel",
                trend_percentage="+28%",
                is_positive=True,
                sparkline=[18, 19, 21, 23, 25, 27, 28],
                thumbnail_url="https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=150&q=80",
            ),
            MarketInsightItem(
                id="mi-4",
                name="Precision CNC Lathe Parts",
                category="Machinery & Engineering",
                trend_percentage="+24%",
                is_positive=True,
                sparkline=[14, 16, 17, 19, 21, 22, 24],
                thumbnail_url="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=150&q=80",
            ),
            MarketInsightItem(
                id="mi-5",
                name="Hulled White Sesame Seeds",
                category="Oilseeds & Agro",
                trend_percentage="+19%",
                is_positive=True,
                sparkline=[11, 12, 14, 15, 17, 18, 19],
                thumbnail_url="https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=150&q=80",
            ),
        ]

    # Default: Top Export Products
    return [
        MarketInsightItem(
            id="mi-1",
            name="Organic Alleppey Turmeric",
            category="Spices & Herbs",
            trend_percentage="+42%",
            is_positive=True,
            sparkline=[20, 25, 28, 32, 36, 39, 42],
            thumbnail_url="https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=150&q=80",
        ),
        MarketInsightItem(
            id="mi-2",
            name="Premium Basmati Rice",
            category="Agriculture & Grains",
            trend_percentage="+35%",
            is_positive=True,
            sparkline=[18, 21, 24, 27, 30, 32, 35],
            thumbnail_url="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=150&q=80",
        ),
        MarketInsightItem(
            id="mi-3",
            name="Cotton Textiles & Bales",
            category="Textiles & Apparel",
            trend_percentage="+28%",
            is_positive=True,
            sparkline=[15, 17, 20, 22, 24, 26, 28],
            thumbnail_url="https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=150&q=80",
        ),
        MarketInsightItem(
            id="mi-4",
            name="Automotive Components",
            category="Industrial & Auto",
            trend_percentage="+24%",
            is_positive=True,
            sparkline=[12, 14, 16, 18, 20, 22, 24],
            thumbnail_url="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=150&q=80",
        ),
        MarketInsightItem(
            id="mi-5",
            name="Natural Sesame Seeds",
            category="Agri Commodities",
            trend_percentage="+19%",
            is_positive=True,
            sparkline=[10, 11, 13, 15, 16, 17, 19],
            thumbnail_url="https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=150&q=80",
        ),
    ]
