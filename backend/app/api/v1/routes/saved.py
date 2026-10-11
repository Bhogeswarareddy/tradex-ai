from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.db import get_db
from app.models.content import SavedItem
from app.models.identity import User

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

