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
from app.core.rate_limit import rate_limit_ai
from app.models.catalog import Category, Certification, Product, SupplierCertification
from app.models.identity import Company, Supplier, User
from app.services.matching import get_matching_weights, rank_suppliers_for_requirement

router = APIRouter(prefix="/ai", tags=["AI Search"])


class AISearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000, description="Natural language trade inquiry sentence")


class AISearchFilterRequest(BaseModel):
    requirement: SearchRequirement


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


async def _execute_search_and_matching(
    db: AsyncSession,
    clean_query: str,
    requirement: SearchRequirement,
    t0: float,
    current_user: Optional[User] = None,
    persist_history: bool = True,
) -> AISearchResponse:
    filters = requirement.to_filters()
    missing_fields = requirement.get_missing_fields()
    clarifying_questions = requirement.get_clarifying_questions()

    # 1. Query Products Matching Requirement
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

    prod_res = await db.execute(prod_stmt.limit(12))
    matched_products = prod_res.scalars().all()

    # Fallback to broader catalog if 0 products found on strict ILIKE
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

    # 2. Query Suppliers & Rank using the Pure-Python 7-Factor Matching Engine
    supp_stmt = (
        select(Supplier)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
            selectinload(Supplier.products).selectinload(Product.price_tiers),
        )
    )
    supp_res = await db.execute(supp_stmt.limit(20))
    all_suppliers = supp_res.scalars().all()

    supplier_payloads: List[Dict[str, Any]] = []
    for s in all_suppliers:
        comp = s.company
        certs: List[str] = []
        if s.certifications:
            for sc in s.certifications:
                if sc.certification and sc.certification.name:
                    certs.append(sc.certification.name)
                elif sc.certificate_no:
                    certs.append(sc.certificate_no)

        prods_data: List[Dict[str, Any]] = []
        for p in (s.products or []):
            p_price = None
            if p.price_tiers:
                p_price = min(float(pt.unit_price) for pt in p.price_tiers)
            prods_data.append({
                "id": str(p.id),
                "name": p.name,
                "category_name": p.origin_country or "",
                "hs_code": p.hs_code or "",
                "price_min": p_price,
            })

        supplier_payloads.append({
            "id": str(s.id),
            "company_id": str(s.company_id),
            "name": comp.name if comp else "Supplier",
            "country": comp.country if comp else "",
            "city": comp.city if comp else "",
            "logo_url": comp.logo_url if comp else None,
            "banner_url": getattr(comp, "banner_url", None),
            "verified_status": comp.verified_status if comp else "verified",
            "trust_score": float(s.trust_score or 90.0),
            "on_time_rate": float(s.on_time_rate or 92.0),
            "rating": getattr(s, "rating", 4.9),
            "total_reviews": getattr(s, "total_reviews", 32),
            "capacity_per_month": s.capacity_per_month or "50 MT/month",
            "export_countries": s.export_countries or [],
            "certifications": certs,
            "products": prods_data,
            "main_products": [p["name"] for p in prods_data],
            "min_moq": getattr(s, "min_moq", 1000),
            "lead_time_days": getattr(s, "lead_time_days", 25),
            "years_in_business": getattr(comp, "years_in_business", 8) if comp else 8,
        })

    weights = await get_matching_weights(db)
    ranked = rank_suppliers_for_requirement(supplier_payloads, requirement.model_dump(), weights=weights)

    top_suppliers: List[Dict[str, Any]] = []
    for item in ranked[:8]:
        top_suppliers.append({
            "id": item["id"],
            "company_id": item["company_id"],
            "name": item["name"],
            "logo_url": item["logo_url"],
            "banner_url": item["banner_url"],
            "country": item["country"],
            "city": item["city"],
            "verified_status": item["verified_status"],
            "trust_score": item["trust_score"],
            "on_time_rate": item["on_time_rate"],
            "rating": item["rating"],
            "total_reviews": item["total_reviews"],
            "capacity_per_month": item["capacity_per_month"],
            "match_score": item["score"],
            "score": item["score"],
            "match_reasons": item["reasons"],
            "reasons": item["reasons"],
            "risks": item.get("risks", []),
            "breakdown": item.get("breakdown", {}),
            "explanation": f"{item['name']} achieved a {item['score']}% match score under platform deterministic weighting.",
        })

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

    # Suggestions if results are sparse
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

    if persist_history:
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
        except Exception:
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


@router.post("/search", response_model=AISearchResponse, dependencies=[Depends(rate_limit_ai)])
async def perform_ai_search(
    req: AISearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> AISearchResponse:
    """
    Natural language search turning an unstructured commercial sentence
    into structured trade requirements, missing fields, clarifying questions,
    and marketplace matches with 7-factor deterministic scoring.
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

    return await _execute_search_and_matching(
        db=db,
        clean_query=clean_query,
        requirement=requirement,
        t0=t0,
        current_user=current_user,
        persist_history=True,
    )


@router.post("/search/filter", response_model=AISearchResponse, dependencies=[Depends(rate_limit_ai)])
async def filter_ai_search(
    req: AISearchFilterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> AISearchResponse:
    """
    Re-filter marketplace results given user-modified requirement chips
    without calling the AI LLM extraction prompt.
    """
    t0 = time.time()
    query_str = f"Filtered requirement: {req.requirement.product}"

    return await _execute_search_and_matching(
        db=db,
        clean_query=query_str,
        requirement=req.requirement,
        t0=t0,
        current_user=current_user,
        persist_history=False,
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
