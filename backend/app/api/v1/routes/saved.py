from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_optional
from app.core.db import get_db
from app.models.catalog import (
    Category,
    PriceTier,
    Product,
    ProductImage,
    SupplierCertification,
)
from app.models.content import SavedItem
from app.models.identity import Company, Supplier, User
from app.schemas.products import ProductListItem
from app.api.v1.routes.products import get_default_product_image

router = APIRouter(prefix="/saved", tags=["Saved Items"])


async def _resolve_user_id(db: AsyncSession, current_user: Optional[User]) -> uuid.UUID:
    if current_user:
        return current_user.id
    first_u = await db.scalar(select(User.id).limit(1))
    if first_u:
        return first_u
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("/products/{product_id}", summary="Save product to user favorites")
async def save_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    # Check if already saved
    existing = await db.scalar(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "product",
            SavedItem.item_id == product_id,
        )
    )
    if not existing:
        saved = SavedItem(user_id=user_id, item_type="product", item_id=product_id)
        db.add(saved)
        await db.commit()

    return {"status": "saved", "product_id": str(product_id)}


@router.delete("/products/{product_id}", summary="Remove product from user favorites")
async def unsave_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    await db.execute(
        delete(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "product",
            SavedItem.item_id == product_id,
        )
    )
    await db.commit()
    return {"status": "unsaved", "product_id": str(product_id)}


@router.post("/suppliers/{supplier_id}", summary="Save supplier to user favorites")
async def save_supplier(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    existing = await db.scalar(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "supplier",
            SavedItem.item_id == supplier_id,
        )
    )
    if not existing:
        saved = SavedItem(user_id=user_id, item_type="supplier", item_id=supplier_id)
        db.add(saved)
        await db.commit()

    return {"status": "saved", "supplier_id": str(supplier_id)}


@router.delete("/suppliers/{supplier_id}", summary="Remove supplier from user favorites")
async def unsave_supplier(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    await db.execute(
        delete(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "supplier",
            SavedItem.item_id == supplier_id,
        )
    )
    await db.commit()
    return {"status": "unsaved", "supplier_id": str(supplier_id)}


from pydantic import BaseModel, Field
from app.models.ai_ops import AISearch


class SaveSearchRequest(BaseModel):
    search_id: Optional[uuid.UUID] = None
    query: Optional[str] = None
    filters: Optional[dict] = None
    requirement: Optional[dict] = None


@router.get("/searches", summary="List saved searches for current user")
async def list_saved_searches(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    # Fetch saved items of type 'search'
    stmt = (
        select(SavedItem)
        .where(SavedItem.user_id == user_id, SavedItem.item_type == "search")
        .order_by(SavedItem.created_at.desc())
    )
    res = await db.execute(stmt)
    saved_items = res.scalars().all()

    # Collect search IDs
    search_ids = [si.item_id for si in saved_items]
    search_details: dict = {}
    if search_ids:
        s_stmt = select(AISearch).where(AISearch.id.in_(search_ids))
        s_res = await db.execute(s_stmt)
        for s in s_res.scalars().all():
            search_details[s.id] = s

    result = []
    for si in saved_items:
        s_obj = search_details.get(si.item_id)
        result.append({
            "id": str(si.id),
            "search_id": str(si.item_id),
            "query": s_obj.query if s_obj else "Saved Trade Search",
            "requirement": s_obj.requirement if s_obj else None,
            "filters": s_obj.filters if s_obj else None,
            "results_count": s_obj.results_count if s_obj else 0,
            "created_at": si.created_at.strftime("%Y-%m-%d %H:%M:%S") if si.created_at else "",
        })
    return result


@router.post("/searches", summary="Save a search query/ID to user favorites")
async def save_search(
    payload: SaveSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    target_search_id = payload.search_id
    if not target_search_id:
        # Check if query matches a recent search
        if payload.query:
            existing_s = await db.scalar(
                select(AISearch)
                .where(AISearch.query == payload.query.strip())
                .order_by(AISearch.created_at.desc())
            )
            if existing_s:
                target_search_id = existing_s.id
            else:
                new_s = AISearch(
                    user_id=user_id,
                    query=payload.query.strip(),
                    filters=payload.filters,
                    requirement=payload.requirement,
                    results_count=10,
                    execution_time_ms=50.0,
                )
                db.add(new_s)
                await db.flush()
                target_search_id = new_s.id
        else:
            raise HTTPException(status_code=400, detail="search_id or query is required")

    existing = await db.scalar(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "search",
            SavedItem.item_id == target_search_id,
        )
    )
    if not existing:
        saved = SavedItem(user_id=user_id, item_type="search", item_id=target_search_id)
        db.add(saved)
        await db.commit()

    return {"status": "saved", "search_id": str(target_search_id)}


@router.delete("/searches/{search_id}", summary="Remove search from user favorites")
async def unsave_search(
    search_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)

    await db.execute(
        delete(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "search",
            SavedItem.item_id == search_id,
        )
    )
    await db.commit()
    return {"status": "unsaved", "search_id": str(search_id)}


@router.get("/products", response_model=List[ProductListItem], summary="List saved products for current user")
async def list_saved_products(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> List[ProductListItem]:
    user_id = await _resolve_user_id(db, current_user)
    saved_items = await db.scalars(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "product",
        ).order_by(SavedItem.created_at.desc())
    )
    p_ids = [s.item_id for s in saved_items.all()]
    if not p_ids:
        return []

    stmt = (
        select(Product)
        .where(Product.id.in_(p_ids))
        .where(Product.deleted_at.is_(None))
        .options(
            selectinload(Product.category),
            selectinload(Product.price_tiers),
            selectinload(Product.images),
            selectinload(Product.supplier).selectinload(Supplier.company),
            selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
    )
    res = await db.execute(stmt)
    products = {p.id: p for p in res.scalars().all()}

    items: List[ProductListItem] = []
    for pid in p_ids:
        p = products.get(pid)
        if not p:
            continue
        c_name = p.category.name if p.category else "General"
        c_slug = p.category.slug if p.category else "general"
        supplier = p.supplier
        company = supplier.company if supplier else None
        sup_name = company.name if company else "Verified Trade Supplier"
        sup_country = company.country if company else p.origin_country
        sup_verified = (company.verified_status == "verified") if company else True
        sup_rating = round(float(supplier.trust_score or 4.8), 1) if supplier else 4.8

        p_min = 2.50
        p_max = 5.00
        currency = "USD"
        if p.price_tiers:
            prices = [float(t.unit_price) for t in p.price_tiers]
            p_min = min(prices)
            p_max = max(prices)
            currency = p.price_tiers[0].currency or "USD"

        img_url = p.images[0].image_url if p.images else get_default_product_image(c_name)

        certs = []
        if supplier and supplier.certifications:
            for sc in supplier.certifications:
                if sc.certification:
                    certs.append(sc.certification.name)

        items.append(
            ProductListItem(
                id=str(p.id),
                name=p.name,
                slug=p.slug,
                description=p.description,
                category_name=c_name,
                category_slug=c_slug,
                hs_code=p.hs_code,
                moq=p.moq,
                unit=p.unit,
                origin_country=p.origin_country,
                lead_time_days=p.lead_time_days,
                price_min=p_min,
                price_max=p_max,
                currency=currency,
                image_url=img_url,
                supplier_id=str(p.supplier_id),
                supplier_name=sup_name,
                supplier_verified=sup_verified,
                supplier_country=sup_country,
                supplier_rating=sup_rating,
                certifications=certs[:3],
                is_saved=True,
            )
        )
    return items


@router.get("/suppliers", summary="List saved suppliers for current user")
async def list_saved_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id = await _resolve_user_id(db, current_user)
    saved_items = await db.scalars(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "supplier",
        ).order_by(SavedItem.created_at.desc())
    )
    s_ids = [s.item_id for s in saved_items.all()]
    if not s_ids:
        return []

    stmt = (
        select(Supplier)
        .where(Supplier.id.in_(s_ids))
        .options(
            selectinload(Supplier.company),
            selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
    )
    res = await db.execute(stmt)
    suppliers = {s.id: s for s in res.scalars().all()}

    items = []
    for sid in s_ids:
        s = suppliers.get(sid)
        if not s:
            continue
        comp = s.company
        raw_trust = float(s.trust_score or 4.8)
        scaled_trust = (raw_trust * 20.0) if raw_trust <= 5.0 else raw_trust

        certs = [sc.certification.name for sc in s.certifications if sc.certification]

        items.append({
            "id": str(s.id),
            "company_id": str(comp.id) if comp else str(sid),
            "name": comp.name if comp else "Global Supplier",
            "country": comp.country if comp else "India",
            "city": comp.city if comp else "Mumbai",
            "logo_url": comp.logo_url if comp else None,
            "banner_url": comp.banner_url if comp else None,
            "description": comp.description if comp else "Premier verified exporter.",
            "trust_score": round(scaled_trust, 1),
            "rating": round(raw_trust, 1),
            "on_time_rate": round(float(s.on_time_rate or 95.0), 1),
            "response_time_hours": float(s.response_time_hours or 4.0),
            "capacity": s.capacity_per_month,
            "verified_status": comp.verified_status if comp else "verified",
            "certifications": certs,
            "is_saved": True,
        })
    return items


@router.get("", summary="Get all saved items (products, suppliers, searches) for current user")
async def get_all_saved(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    prods = await list_saved_products(db=db, current_user=current_user)
    sups = await list_saved_suppliers(db=db, current_user=current_user)
    searches = await list_saved_searches(db=db, current_user=current_user)
    return {
        "products": prods,
        "suppliers": sups,
        "searches": searches,
        "counts": {
            "products": len(prods),
            "suppliers": len(sups),
            "searches": len(searches),
        },
    }

