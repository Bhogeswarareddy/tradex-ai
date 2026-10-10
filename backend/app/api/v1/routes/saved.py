from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.db import get_db
from app.models.content import SavedItem
from app.models.identity import User

router = APIRouter(prefix="/saved", tags=["Saved Items"])


@router.post("/products/{product_id}", summary="Save product to user favorites")
async def save_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else uuid.UUID("00000000-0000-0000-0000-000000000001")

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
    current_user: User = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else uuid.UUID("00000000-0000-0000-0000-000000000001")

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
    current_user: User = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else uuid.UUID("00000000-0000-0000-0000-000000000001")

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
    current_user: User = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else uuid.UUID("00000000-0000-0000-0000-000000000001")

    await db.execute(
        delete(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_type == "supplier",
            SavedItem.item_id == supplier_id,
        )
    )
    await db.commit()
    return {"status": "unsaved", "supplier_id": str(supplier_id)}
