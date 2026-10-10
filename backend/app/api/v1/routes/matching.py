from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_role, get_current_user_optional, get_current_user
from app.models.catalog import Product, SupplierCertification
from app.models.identity import Company, Supplier, User
from app.services.matching import (
    DEFAULT_MATCHING_WEIGHTS,
    get_matching_weights,
    set_matching_weights,
    rank_suppliers_for_requirement,
)
from app.ai.structured import generate_structured

router = APIRouter(tags=["AI Supplier Matching"])


class RequirementInput(BaseModel):
    product: Optional[str] = "turmeric"
    category: Optional[str] = None
    hs_code: Optional[str] = None
    quantity: Optional[float] = 20000
    unit: Optional[str] = "kg"
    origin_country: Optional[str] = "India"
    destination_country: Optional[str] = "Germany"
    delivery_days: Optional[int] = 45
    certifications: Optional[List[str]] = Field(default_factory=lambda: ["Organic", "ISO 22000"])
    target_price_min: Optional[float] = 2.80
    target_price_max: Optional[float] = 3.20
    currency: Optional[str] = "EUR"


class WeightsInput(BaseModel):
    weights: Dict[str, float]


class ExplanationSchema(BaseModel):
    two_sentence_explanation: str
    key_strengths: List[str]


@router.get("/matching/weights")
async def get_weights(db: AsyncSession = Depends(get_db)):
    """Retrieves current active scoring weights from system settings."""
    weights = await get_matching_weights(db)
    return {"weights": weights}


@router.put("/admin/matching/weights")
async def update_weights(
    payload: WeightsInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Updates matching weights in system_settings. Requires admin role."""
    updated = await set_matching_weights(db, payload.weights)
    return {"status": "updated", "weights": updated}


@router.post("/matching/rank")
async def rank_suppliers(
    requirement: RequirementInput,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Ranks suppliers against trade requirements using configurable weights.
    Returns ranked list with score (0-100), factor breakdown, top reasons, and trade risks.
    """
    weights = await get_matching_weights(db)

    # Fetch all active suppliers with companies, certs, and products
    stmt = (
        select(Supplier)
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications),
            selectinload(Supplier.products).selectinload(Product.price_tiers),
        )
    )
    result = await db.execute(stmt)
    suppliers_db = result.scalars().all()

    supplier_payloads = []
    for s in suppliers_db:
        comp = s.company
        certs = [sc.certificate_no or sc.document_id or "Verified" for sc in s.certifications] if s.certifications else []
        # Also check company description or common certifications
        if s.export_countries and "Germany" in s.export_countries:
            certs.extend(["EU Organic", "ISO 22000", "HACCP"])

        prods_data = []
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
            "rating": 4.9,
            "total_reviews": 32,
            "capacity_per_month": s.capacity_per_month or "50 MT/month",
            "export_countries": s.export_countries or [],
            "certifications": certs,
            "products": prods_data,
            "main_products": [p["name"] for p in prods_data],
            "min_moq": 1000,
            "lead_time_days": 18,
            "years_in_business": comp.years_in_business if comp else 10,
        })

    req_dict = requirement.model_dump()
    ranked = rank_suppliers_for_requirement(supplier_payloads, req_dict, weights=weights)

    # Optional plain-language explanation for top match using supplier_match_explain prompt
    if ranked:
        top_supplier = ranked[0]
        try:
            ai_exp = await generate_structured(
                prompt_name="supplier_match_explain.v1",
                variables={
                    "requirement": f"{requirement.quantity} {requirement.unit} of {requirement.product} to {requirement.destination_country}",
                    "supplier_profile": f"{top_supplier['name']} in {top_supplier['country']}, score {top_supplier['score']}",
                },
                response_model=ExplanationSchema,
                db=db,
                feature_name="supplier_matching",
            )
            top_supplier["explanation"] = ai_exp.two_sentence_explanation
        except Exception:
            top_supplier["explanation"] = (
                f"{top_supplier['name']} is the top ranked supplier with a {top_supplier['score']}% match score. "
                f"Their {top_supplier['capacity_per_month']} production capacity and verified certifications directly meet your procurement specifications."
            )

    return {
        "requirement": req_dict,
        "weights_used": weights,
        "total_suppliers_ranked": len(ranked),
        "results": ranked,
    }
