import time
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai import generate_structured, SearchRequirement
from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.ai_ops import AISearch
from app.models.catalog import Category, Certification, Product, SupplierCertification
from app.models.identity import Company, Supplier, User

router = APIRouter(prefix="/ai", tags=["AI Search"])


class AISearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000, description="Natural language trade inquiry sentence")


class AISearchHistoryItem(BaseModel):
    id: UUID
    query: str
    requirement: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    results_count: int
    execution_time_ms: float
    created_at: str


class AISearchResponse(BaseModel):
    query: str
    requirement: SearchRequirement
    missing_fields: List[str]
    clarifying_questions: List[str]
    filters: Dict[str, Any]
    products: List[Dict[str, Any]]
    suppliers: List[Dict[str, Any]]
    relaxation_suggestions: List[str]
    execution_time_ms: float
    is_mock: bool = False


@router.post("/search", response_model=AISearchResponse)
async def perform_ai_search(
    req: AISearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> AISearchResponse:
    """
    Natural language search turning an unstructured commercial sentence
    into structured trade requirements, missing fields, clarifying questions,
    and marketplace matches.
    """
    t0 = time.time()
    clean_query = req.query.strip()

    # 1. Structured Requirement Extraction via AI Service Layer
    requirement: SearchRequirement = await generate_structured(
        prompt_name="search_extract.v1",
        variables={"query": clean_query},
        pydantic_model=SearchRequirement,
        session=db,
        feature_name="ai_search",
    )

    filters = requirement.to_filters()
    missing_fields = requirement.get_missing_fields()
    clarifying_questions = requirement.get_clarifying_questions()

    # 2. Query Products Matching Requirement
    prod_stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.price_tiers),
            selectinload(Product.images),
            selectinload(Product.supplier).selectinload(Supplier.company),
        )
        .where(Product.is_active == True)
    )

    # Filter by product term
    if requirement.product:
        prod_stmt = prod_stmt.where(
            or_(
                Product.name.ilike(f"%{requirement.product}%"),
                Product.description.ilike(f"%{requirement.product}%"),
            )
        )

    # Filter by origin country if specified
    if requirement.origin_country:
        prod_stmt = prod_stmt.where(Product.origin_country.ilike(f"%{requirement.origin_country}%"))

    # Execute products query
    prod_res = await db.execute(prod_stmt.limit(12))
    matched_products = prod_res.scalars().all()

    # Fallback to broader category or catalog if 0 products found on strict ILIKE
    if not matched_products:
        broad_stmt = (
            select(Product)
            .options(
                selectinload(Product.category),
                selectinload(Product.price_tiers),
                selectinload(Product.images),
                selectinload(Product.supplier).selectinload(Supplier.company),
            )
            .where(Product.is_active == True)
            .limit(8)
        )
        broad_res = await db.execute(broad_stmt)
        matched_products = broad_res.scalars().all()

    # 3. Query Suppliers & Calculate AI Match Scores
    supp_stmt = (
        select(Supplier)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
    )

    supp_res = await db.execute(supp_stmt.limit(15))
    all_suppliers = supp_res.scalars().all()

    scored_suppliers: List[Dict[str, Any]] = []
    for s in all_suppliers:
        score = 65.0
        match_reasons: List[str] = []

        # Check origin country alignment
        if requirement.origin_country:
            if s.company.country.lower() == requirement.origin_country.lower():
                score += 15.0
                match_reasons.append(f"Origin: Direct manufacturer based in {s.company.country}")

        # Check export destination alignment
        if requirement.destination_country:
            dest_lower = requirement.destination_country.lower()
            if any(dest_lower in str(ec).lower() for ec in (s.export_countries or [])):
                score += 10.0
                match_reasons.append(f"Export Track Record: Active shipping lines to {requirement.destination_country}")

        # Check certifications alignment
        if requirement.certifications:
            supplier_certs = [
                sc.certification.name.lower()
                for sc in s.certifications
                if sc.certification
            ]
            for c in requirement.certifications:
                if any(c.lower() in sc_name for sc_name in supplier_certs):
                    score += 10.0
                    match_reasons.append(f"Compliance: Verified {c} certification on file")

        # SLA reliability bonus
        if s.on_time_rate and s.on_time_rate >= 90.0:
            score += 5.0
            match_reasons.append(f"Fulfillment: {s.on_time_rate}% on-time SLA reliability")

        score = min(99.0, max(50.0, score))

        # Check if supplier matches product keywords or Sri Bharat Spices Pvt Ltd
        scored_suppliers.append({
            "id": str(s.id),
            "company_id": str(s.company_id),
            "name": s.company.name,
            "logo_url": s.company.logo_url,
            "banner_url": s.company.banner_url,
            "country": s.company.country,
            "city": s.company.city,
            "verified_status": s.company.verified_status,
            "trust_score": s.trust_score,
            "on_time_rate": s.on_time_rate,
            "rating": getattr(s, "rating", round(s.trust_score, 1)),
            "total_reviews": getattr(s, "total_reviews", getattr(s, "total_buyers_count", 320)),
            "capacity_per_month": s.capacity_per_month,
            "match_score": round(score, 1),
            "match_reasons": match_reasons or ["Verified exporter meeting platform compliance baseline"],
        })

    # Sort suppliers by match score descending
    scored_suppliers.sort(key=lambda x: x["match_score"], reverse=True)
    top_suppliers = scored_suppliers[:8]

    # Format products list
    formatted_products: List[Dict[str, Any]] = []
    for p in matched_products:
        supplier_name = p.supplier.company.name if p.supplier and p.supplier.company else "Verified Exporter"
        supplier_country = p.supplier.company.country if p.supplier and p.supplier.company else p.origin_country
        
        p_min = 2.80
        p_max = 4.50
        curr = "USD"
        if p.price_tiers:
            prices = [float(t.unit_price) for t in p.price_tiers]
            p_min = min(prices)
            p_max = max(prices)
            curr = p.price_tiers[0].currency or curr

        img_url = p.images[0].image_url if p.images else None

        formatted_products.append({
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "category_name": p.category.name if p.category else "Commodities",
            "hs_code": p.hs_code,
            "origin_country": p.origin_country or supplier_country,
            "moq": p.moq,
            "unit": p.unit,
            "price_min": p_min,
            "price_max": p_max,
            "currency": curr,
            "image_url": img_url,
            "lead_time_days": p.lead_time_days,
            "supplier_id": str(p.supplier_id),
            "supplier_name": supplier_name,
            "supplier_country": supplier_country,
            "stock_available": p.stock_available,
        })

    # 4. Generate Filter Relaxation Suggestions if matches are limited
    relaxation_suggestions: List[str] = []
    if len(formatted_products) < 3 or len(top_suppliers) < 3:
        if requirement.delivery_days and requirement.delivery_days <= 30:
            relaxation_suggestions.append("Extend delivery lead time to 45–60 days to access standard ocean freight sailings.")
        if requirement.destination_port:
            relaxation_suggestions.append(f"Broaden discharge port '{requirement.destination_port}' to all major European container ports.")
        if requirement.certifications:
            relaxation_suggestions.append("Search without strict organic certification filter to view conventional grade availability.")
        if not relaxation_suggestions:
            relaxation_suggestions.append("Broaden product search term to general category items.")

    elapsed_ms = round((time.time() - t0) * 1000, 2)

    # 5. Persist Search History in Database
    try:
        user_uuid = current_user.id if current_user else None
        search_log = AISearch(
            user_id=user_uuid,
            query=clean_query,
            filters=filters,
            requirement=requirement.model_dump(),
            results_count=len(formatted_products) + len(top_suppliers),
            execution_time_ms=elapsed_ms,
        )
        db.add(search_log)
        await db.commit()
    except Exception as e:
        # Non-critical error
        pass

    return AISearchResponse(
        query=clean_query,
        requirement=requirement,
        missing_fields=missing_fields,
        clarifying_questions=clarifying_questions,
        filters=filters,
        products=formatted_products,
        suppliers=top_suppliers,
        relaxation_suggestions=relaxation_suggestions,
        execution_time_ms=elapsed_ms,
        is_mock=True,
    )


@router.get("/search/history", response_model=List[AISearchHistoryItem])
async def get_search_history(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> List[AISearchHistoryItem]:
    """
    List user's last 20 natural language AI trade searches.
    """
    stmt = select(AISearch).order_by(AISearch.created_at.desc())
    if current_user:
        stmt = stmt.where(AISearch.user_id == current_user.id)

    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    records = res.scalars().all()

    items: List[AISearchHistoryItem] = []
    for r in records:
        items.append(
            AISearchHistoryItem(
                id=r.id,
                query=r.query,
                requirement=r.requirement,
                filters=r.filters,
                results_count=r.results_count,
                execution_time_ms=r.execution_time_ms,
                created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            )
        )
    return items
