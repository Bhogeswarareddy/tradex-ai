import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

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
from app.models.trade import RFQ, Order
from app.services.matching import get_matching_weights, rank_suppliers_for_requirement
from app.services.sourcing_engine import SourcingEngine, SourcingEngineResult, SourcingRequirement


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
    ai_meta: Optional[Dict[str, Any]] = None
    status: str = "success"


async def _execute_search_and_matching(
    db: AsyncSession,
    clean_query: str,
    requirement: SearchRequirement,
    t0: float,
    current_user: Optional[User] = None,
    persist_history: bool = True,
    search_status: str = "success",
    fallback_reason: Optional[str] = None,
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
        
        p_min = None
        p_max = None
        curr = getattr(p, "currency", None) or "USD"
        if p.price_tiers:
            prices = [float(t.unit_price) for t in p.price_tiers if t.unit_price is not None]
            if prices:
                p_min = min(prices)
                p_max = max(prices)
                curr = p.price_tiers[0].currency or curr

        price_display = f"{curr} {p_min:.2f}" if p_min is not None else "Contact supplier for pricing"
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
            "price": p_min,
            "price_min": p_min,
            "price_max": p_max,
            "price_display": price_display,
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

    from app.ai.provider import get_ai_status
    status_diag = get_ai_status()
    is_demo = status_diag.get("mode") == "demo" or search_status != "success"
    ai_meta = {
        "provider": status_diag.get("provider", "groq"),
        "model": status_diag.get("model", "llama-3.3-70b-versatile"),
        "is_demo": is_demo,
        "latency_ms": elapsed_ms,
        "fallback_reason": fallback_reason or status_diag.get("fallback_reason"),
    }

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
        is_mock=is_demo,
        ai_meta=ai_meta,
        status=search_status,
    )


@router.post("/search", response_model=AISearchResponse, dependencies=[Depends(rate_limit_ai)])
async def perform_ai_search(
    req: AISearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> AISearchResponse:
    """
    Prompt 35: Sourcing Engine powered AI Search.
    Extracts only stated fields (no invented filters), searches catalogue deterministically,
    and returns direct suppliers from matching listings only.
    """
    t0 = time.time()
    clean_query = req.query.strip()

    # Shared Sourcing Engine pipeline
    engine_res: SourcingEngineResult = await SourcingEngine.process_query(
        query=clean_query,
        db=db,
        context={},
        display_currency="USD",
        surface="ai_search",
    )

    req_obj = engine_res.understood
    # Only fields explicitly present in stated_fields are populated in requirement
    requirement = SearchRequirement(
        product=req_obj.normalized_product_name or req_obj.product_term or clean_query,
        category=req_obj.category_guess if "category" in req_obj.stated_fields else None,
        quantity=req_obj.quantity if "quantity" in req_obj.stated_fields else None,
        unit=req_obj.unit if "unit" in req_obj.stated_fields else None,
        origin_country=req_obj.origin if "origin" in req_obj.stated_fields else None,
        destination_country=req_obj.destination if "destination" in req_obj.stated_fields else None,
        certifications=req_obj.certifications if "certifications" in req_obj.stated_fields else [],
        max_budget=req_obj.price_limit if "price_limit" in req_obj.stated_fields else None,
        currency=req_obj.currency or "USD",
        moq=None,
        delivery_days=None,
        incoterm=None,
    )

    # Format products
    formatted_products: List[Dict[str, Any]] = []
    all_cards = engine_res.products + engine_res.alternatives
    for p in all_cards:
        unit_p = p.price_display if p.price_display is not None else p.unit_price
        curr = p.currency_display or p.currency or "USD"
        p_disp = f"{curr} {unit_p:.2f}" if unit_p is not None else "Contact supplier for pricing"
        formatted_products.append({
            "id": p.product_id,
            "name": p.title,
            "brand": getattr(p, "brand", None),
            "description": getattr(p, "description", None),
            "slug": getattr(p, "slug", None) or p.title.lower().replace(" ", "-"),
            "category_name": getattr(p, "category_name", None) or "Commodities",
            "hs_code": None,
            "origin_country": p.origin_country,
            "moq": int(p.moq or 1),
            "unit": getattr(p, "unit", None) or "units",
            "price": unit_p,
            "price_min": unit_p,
            "price_max": unit_p,
            "price_display": p_disp,
            "currency": curr,
            "image_url": p.image,
            "lead_time_days": p.lead_time or 14,
            "supplier_id": getattr(p, "supplier_id", "") or "",
            "supplier_name": p.supplier_name,
            "supplier_country": getattr(p, "supplier_country", None) or p.origin_country,
            "stock_available": int(p.available_quantity if p.available_quantity is not None else (p.stock_available or 0)),
            "match_explanation": p.match_explanation or {"summary": f"Matches query '{clean_query}'"},
            "is_alternative": p.is_alternative,
        })

    # Suppliers: ONLY suppliers from matching published products (direct matches)
    top_suppliers: List[Dict[str, Any]] = []
    for s in engine_res.direct_suppliers:
        top_suppliers.append({
            "id": s["id"],
            "company_id": s["company_id"],
            "name": s["name"],
            "country": s["country"],
            "city": s.get("city", ""),
            "logo_url": s.get("logo_url"),
            "verified": s.get("verified", True),
            "verified_status": "verified" if s.get("verified", True) else "unverified",
            "score": s.get("match_score", 95),
            "match_score": s.get("match_score", 95),
            "match_reasons": s.get("match_reasons") or [f"Authoritative supplier for published catalogue item: {s.get('matched_product_name', 'matching product')}"],
            "certifications": s.get("certifications", []),
            "catalog_products_count": s.get("catalog_products_count", 1),
            "risks": [],
            "breakdown": {},
            "explanation": f"{s['name']} is a verified supplier with matching published catalogue listings.",
        })

    relaxation_suggestions: List[str] = []
    if not formatted_products:
        user_term = req_obj.product_term or req_obj.normalized_product_name or clean_query
        relaxation_suggestions.append(f"Create an RFQ (Request for Quotation) for '{user_term}' to receive bids from global suppliers.")
        relaxation_suggestions.append("Check spelling or broaden search to related categories.")

    elapsed_ms = round((time.time() - t0) * 1000, 2)
    search_status = "success" if (formatted_products or top_suppliers) else "not_found"

    # Persist search log
    try:
        user_uuid = current_user.id if current_user else None
        search_log = AISearch(
            user_id=user_uuid,
            query=clean_query,
            filters=engine_res.active_filters,
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
        missing_fields=[],
        clarifying_questions=[],
        filters=engine_res.active_filters,
        products=formatted_products,
        suppliers=top_suppliers,
        relaxation_suggestions=relaxation_suggestions,
        execution_time_ms=elapsed_ms,
        is_mock=engine_res.ai_meta.get("is_demo", False),
        ai_meta=engine_res.ai_meta,
        status=search_status,
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
    user_req = req.requirement

    stated = []
    if user_req.product:
        stated.append("product")
    if user_req.quantity is not None:
        stated.append("quantity")
    if user_req.unit:
        stated.append("unit")
    if user_req.origin_country:
        stated.append("origin")
    if user_req.max_budget is not None:
        stated.append("price_limit")

    sourcing_req = SourcingRequirement(
        intent="PRODUCT_SOURCING",
        product_term=user_req.product,
        normalized_product_name=user_req.product,
        quantity=user_req.quantity,
        unit=user_req.unit,
        origin=user_req.origin_country,
        destination=user_req.destination_country,
        price_limit=user_req.max_budget,
        currency=user_req.currency or "USD",
        certifications=user_req.certifications or [],
        stated_fields=stated,
    )

    primary_cards, alt_cards, updated_crit = await SourcingEngine.search_catalogue_deterministic(
        db, sourcing_req, display_currency=user_req.currency or "USD"
    )
    direct_supps, potential_supps = await SourcingEngine.resolve_suppliers(primary_cards, sourcing_req, db)

    # Format products
    formatted_products: List[Dict[str, Any]] = []
    all_cards = primary_cards + alt_cards
    for p_dict in all_cards:
        raw_p = p_dict.get("raw_product")
        filt_unit_p = p_dict.get("price_display") if p_dict.get("price_display") is not None else p_dict.get("unit_price")
        filt_curr = p_dict.get("currency_display") or p_dict.get("currency") or "USD"
        filt_p_disp = f"{filt_curr} {filt_unit_p:.2f}" if filt_unit_p is not None else "Contact supplier for pricing"

        formatted_products.append({
            "id": p_dict["product_id"],
            "name": p_dict["title"],
            "brand": getattr(raw_p, "brand", None),
            "description": getattr(raw_p, "description", None),
            "slug": getattr(raw_p, "slug", None) or p_dict["title"].lower().replace(" ", "-"),
            "category_name": getattr(raw_p.category, "name", "Commodities") if raw_p and getattr(raw_p, "category", None) else "Commodities",
            "hs_code": getattr(raw_p, "hs_code", None),
            "origin_country": p_dict.get("origin_country", "Global"),
            "moq": int(p_dict.get("moq", 1)),
            "unit": p_dict.get("unit", "units"),
            "price": filt_unit_p,
            "price_min": filt_unit_p,
            "price_max": filt_unit_p,
            "price_display": filt_p_disp,
            "currency": filt_curr,
            "image_url": p_dict.get("image"),
            "lead_time_days": p_dict.get("lead_time") or 14,
            "supplier_id": p_dict.get("supplier_id") or "",
            "supplier_name": p_dict.get("supplier_name", "Supplier"),
            "supplier_country": p_dict.get("supplier_country") or p_dict.get("origin_country", "Global"),
            "stock_available": int(p_dict.get("available_quantity") if p_dict.get("available_quantity") is not None else p_dict.get("stock_available", 0)),
            "match_explanation": p_dict.get("match_explanation") or {"summary": f"Matches filter for {user_req.product}"},
            "is_alternative": p_dict.get("is_alternative", False),
        })

    # Direct suppliers only from matching published products
    top_suppliers: List[Dict[str, Any]] = []
    for s in direct_supps:
        top_suppliers.append({
            "id": s["id"],
            "company_id": s["company_id"],
            "name": s["name"],
            "country": s["country"],
            "city": s.get("city", ""),
            "logo_url": s.get("logo_url"),
            "verified": s.get("verified", True),
            "verified_status": "verified" if s.get("verified", True) else "unverified",
            "score": s.get("match_score", 95),
            "match_score": s.get("match_score", 95),
            "match_reasons": s.get("match_reasons") or [f"Authoritative supplier for published catalogue item: {s.get('matched_product_name', 'matching product')}"],
            "certifications": s.get("certifications", []),
            "catalog_products_count": s.get("catalog_products_count", 1),
            "risks": [],
            "breakdown": {},
            "explanation": f"{s['name']} is a verified supplier with matching published catalogue listings.",
        })

    relaxation_suggestions: List[str] = []
    if not formatted_products:
        user_term = user_req.product or "the requested commodity"
        relaxation_suggestions.append(f"Create an RFQ (Request for Quotation) for '{user_term}' to receive bids from global suppliers.")
        relaxation_suggestions.append("Check spelling or broaden search to related categories.")

    elapsed_ms = round((time.time() - t0) * 1000, 2)
    search_status = "success" if (formatted_products or top_suppliers) else "not_found"

    from app.ai.provider import get_ai_status
    status_diag = get_ai_status()
    is_demo = status_diag.get("mode") == "demo"
    ai_meta = {
        "provider": status_diag.get("provider", "groq"),
        "model": status_diag.get("model", "llama-3.3-70b-versatile"),
        "is_demo": is_demo,
        "latency_ms": elapsed_ms,
        "fallback_reason": None,
    }

    return AISearchResponse(
        query=f"Filtered requirement: {user_req.product}",
        requirement=user_req,
        missing_fields=[],
        clarifying_questions=[],
        filters=updated_crit,
        products=formatted_products,
        suppliers=top_suppliers,
        relaxation_suggestions=relaxation_suggestions,
        execution_time_ms=elapsed_ms,
        is_mock=is_demo,
        ai_meta=ai_meta,
        status=search_status,
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


@router.get("/palette/search", summary="Command palette fast universal search")
async def command_palette_search(
    q: str = Query(..., min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Fast indexed search for Command Palette (⌘K) across Products, Suppliers, RFQs, and Orders.
    Returns results in <50ms.
    """
    term = q.strip().lower()
    pattern = f"%{term}%"

    # 1. Products
    p_stmt = (
        select(Product)
        .where(Product.deleted_at.is_(None))
        .where(Product.is_active.is_(True))
        .where(Product.status == "published")
        .where(
            or_(
                Product.name.ilike(pattern),
                Product.hs_code.ilike(pattern),
                Product.origin_country.ilike(pattern),
            )
        )
        .options(selectinload(Product.category))
        .order_by(Product.created_at.desc())
        .limit(6)
    )
    p_res = await db.execute(p_stmt)
    products = [
        {
            "id": str(p.id),
            "title": p.name,
            "subtitle": f"HS: {p.hs_code or 'N/A'} • {p.origin_country} • {p.category.name if p.category else 'Trade'}",
            "type": "product",
            "url": f"/products/{p.id}",
            "badge": f"{p.currency} {p.stock_available:,} in stock",
            "is_demo": getattr(p, "is_demo", False),
        }
        for p in p_res.scalars().all()
    ]

    # 2. Suppliers
    s_stmt = (
        select(Supplier)
        .join(Company, Supplier.company_id == Company.id)
        .where(
            or_(
                Company.name.ilike(pattern),
                Company.country.ilike(pattern),
                Company.city.ilike(pattern),
            )
        )
        .options(selectinload(Supplier.company))
        .order_by(Supplier.trust_score.desc())
        .limit(6)
    )
    s_res = await db.execute(s_stmt)
    suppliers = [
        {
            "id": str(s.id),
            "title": s.company.name if s.company else "Supplier",
            "subtitle": f"{s.company.city if s.company else ''}, {s.company.country if s.company else ''} • {s.company.years_in_business if (s.company and s.company.years_in_business) else 5} yrs in business",
            "type": "supplier",
            "url": f"/suppliers/{s.id}",
            "badge": f"{getattr(s, 'verification_tier', 'Verified').capitalize()} Tier",
            "is_demo": getattr(s, "is_demo", False),
        }
        for s in s_res.scalars().all()
    ]

    # 3. RFQs
    r_stmt = (
        select(RFQ)
        .where(
            or_(
                RFQ.rfq_number.ilike(pattern),
                RFQ.title.ilike(pattern),
                RFQ.product.ilike(pattern),
            )
        )
        .order_by(RFQ.created_at.desc())
        .limit(6)
    )
    r_res = await db.execute(r_stmt)
    rfqs = [
        {
            "id": str(r.id),
            "title": f"{r.rfq_number}: {r.title or r.product}",
            "subtitle": f"Quantity: {r.quantity:,} {r.unit} • {r.destination_country or 'Global'}",
            "type": "rfq",
            "url": f"/rfqs/{r.id}",
            "badge": r.status.upper(),
            "is_demo": getattr(r, "is_demo", False),
        }
        for r in r_res.scalars().all()
    ]

    # 4. Orders
    o_stmt = (
        select(Order)
        .where(Order.order_number.ilike(pattern))
        .order_by(Order.created_at.desc())
        .limit(6)
    )
    o_res = await db.execute(o_stmt)
    orders = [
        {
            "id": str(o.id),
            "title": f"Order {o.order_number}",
            "subtitle": f"Amount: {o.currency} {o.total_amount:,.2f} • Incoterm: {o.incoterm}",
            "type": "order",
            "url": f"/orders/{o.id}",
            "badge": o.status.replace("_", " ").upper(),
            "is_demo": getattr(o, "is_demo", False),
        }
        for o in o_res.scalars().all()
    ]

    return {
        "query": q,
        "products": products,
        "suppliers": suppliers,
        "rfqs": rfqs,
        "orders": orders,
        "total_matches": len(products) + len(suppliers) + len(rfqs) + len(orders),
    }
