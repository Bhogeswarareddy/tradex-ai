"""
TradeX AI - AI Mode Endpoints (Prompt 18)
Conversations, Selection, Chat Now, Negotiation Drafts
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppException
from app.core.rate_limit import _get_client_ip, ai_limiter
from app.models.ai_mode import AIConversation, AIMessage, AISelectedProduct, NegotiationDraft
from app.models.catalog import Category, PriceTier, Product, SupplierCertification
from app.models.identity import Company, Supplier, User
from app.schemas.ai_mode import (
    AIMessageDetail,
    ConversationCreate,
    ConversationDetail,
    ConversationListItem,
    ConversationUpdate,
    MessageInput,
    MessageTurnResponse,
    NegotiationDraftCreate,
    NegotiationDraftResponse,
    NegotiationDraftSendInput,
    ProductCardItem,
)
from app.services.ai_mode_service import (
    create_negotiation_draft,
    create_or_reuse_chat_thread,
    format_product_card,
    handle_user_message,
    send_negotiation_draft,
)

router = APIRouter(prefix="/ai-mode", tags=["AI Mode"])


async def get_verified_conversation(
    conv_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> AIConversation:
    """Fetches conversation ensuring ownership and not soft-deleted, else 404."""
    stmt = (
        select(AIConversation)
        .options(
            selectinload(AIConversation.messages),
            selectinload(AIConversation.selected_products).selectinload(AISelectedProduct.product).selectinload(Product.price_tiers),
            selectinload(AIConversation.selected_products).selectinload(AISelectedProduct.product).selectinload(Product.supplier).selectinload(Supplier.company),
            selectinload(AIConversation.selected_products).selectinload(AISelectedProduct.product).selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
            selectinload(AIConversation.selected_products).selectinload(AISelectedProduct.product).selectinload(Product.images),
            selectinload(AIConversation.selected_products).selectinload(AISelectedProduct.product).selectinload(Product.category),
        )
        .where(
            AIConversation.id == conv_id,
            AIConversation.user_id == user.id,
            AIConversation.deleted_at.is_(None),
        )
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        # Prompt requirement: another user gets 404 on someone else's conversation
        raise AppException(message="Conversation not found", code="CONVERSATION_NOT_FOUND", status_code=404)
    return conv


@router.post("/conversations", response_model=ConversationListItem, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: Optional[ConversationCreate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationListItem:
    """Creates a new AI Mode conversation."""
    title = (payload.title if payload and payload.title else "New Conversation").strip()
    conv = AIConversation(
        user_id=current_user.id,
        title=title or "New Conversation",
        search_state={},
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    return ConversationListItem(
        id=str(conv.id),
        title=conv.title,
        search_state=conv.search_state,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages_count=0,
        selected_count=0,
    )


@router.get("/conversations", response_model=List[ConversationListItem])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ConversationListItem]:
    """Lists user's active conversations, newest first."""
    stmt = (
        select(AIConversation)
        .options(
            selectinload(AIConversation.messages),
            selectinload(AIConversation.selected_products),
        )
        .where(
            AIConversation.user_id == current_user.id,
            AIConversation.deleted_at.is_(None),
        )
        .order_by(desc(AIConversation.updated_at))
    )
    conversations = (await db.execute(stmt)).scalars().all()

    return [
        ConversationListItem(
            id=str(c.id),
            title=c.title,
            search_state=c.search_state or {},
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
            messages_count=len(c.messages),
            selected_count=len(c.selected_products),
        )
        for c in conversations
    ]


@router.get("/conversations/{id}", response_model=ConversationDetail)
async def get_conversation_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationDetail:
    """Fetches a conversation with full message trajectory and selected products."""
    conv = await get_verified_conversation(id, current_user, db)

    messages_data = [
        AIMessageDetail(
            id=str(m.id),
            conversation_id=str(m.conversation_id),
            role=m.role,
            content=m.content,
            structured=m.structured,
            provider=m.provider,
            is_demo=m.is_demo,
            created_at=m.created_at.isoformat(),
        )
        for m in sorted(conv.messages, key=lambda x: x.created_at)
    ]

    selected_cards = [
        format_product_card(sp.product, conv.search_state.get("criteria", {}))
        for sp in conv.selected_products
        if sp.product
    ]

    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        search_state=conv.search_state or {},
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages=messages_data,
        selected_products=selected_cards,
    )


@router.patch("/conversations/{id}", response_model=ConversationListItem)
async def rename_conversation(
    id: uuid.UUID,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationListItem:
    """Renames an AI conversation."""
    conv = await get_verified_conversation(id, current_user, db)
    conv.title = payload.title.strip()
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)

    return ConversationListItem(
        id=str(conv.id),
        title=conv.title,
        search_state=conv.search_state or {},
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages_count=len(conv.messages),
        selected_count=len(conv.selected_products),
    )


@router.delete("/conversations/{id}", status_code=status.HTTP_200_OK)
async def soft_delete_conversation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Soft-deletes a conversation."""
    conv = await get_verified_conversation(id, current_user, db)
    conv.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "deleted", "id": str(id)}


@router.post("/conversations/{id}/messages", response_model=MessageTurnResponse)
async def post_conversation_message(
    id: uuid.UUID,
    payload: MessageInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageTurnResponse:
    """
    Posts a user message, processes intelligence & criteria, and returns the assistant reply with product cards.
    Rate-limited via sliding window.
    """
    client_ip = _get_client_ip(request)
    ai_limiter.check(client_ip)

    conv = await get_verified_conversation(id, current_user, db)

    user_msg, assistant_msg, classification, cards, clarifying_question, comparison_data = await handle_user_message(
        conversation=conv,
        user_content=payload.content,
        db=db,
    )

    return MessageTurnResponse(
        user_message=AIMessageDetail(
            id=str(user_msg.id),
            conversation_id=str(user_msg.conversation_id),
            role=user_msg.role,
            content=user_msg.content,
            structured=user_msg.structured,
            provider=user_msg.provider,
            is_demo=user_msg.is_demo,
            created_at=user_msg.created_at.isoformat(),
        ),
        assistant_reply=AIMessageDetail(
            id=str(assistant_msg.id),
            conversation_id=str(assistant_msg.conversation_id),
            role=assistant_msg.role,
            content=assistant_msg.content,
            structured=assistant_msg.structured,
            provider=assistant_msg.provider,
            is_demo=assistant_msg.is_demo,
            created_at=assistant_msg.created_at.isoformat(),
        ),
        classification=classification,
        product_cards=cards,
        clarifying_question=clarifying_question,
        comparison_data=comparison_data,
    )


@router.post("/conversations/{id}/selection/{product_id}", status_code=status.HTTP_200_OK)
async def select_product(
    id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Adds a product to the conversation selection without duplicates."""
    conv = await get_verified_conversation(id, current_user, db)

    # Verify product exists
    p_check = await db.execute(select(Product.id).where(Product.id == product_id))
    if not p_check.scalar_one_or_none():
        raise AppException(message="Product not found", code="PRODUCT_NOT_FOUND", status_code=404)

    # Check existing selection
    sel_stmt = select(AISelectedProduct).where(
        AISelectedProduct.conversation_id == conv.id,
        AISelectedProduct.product_id == product_id,
    )
    existing = (await db.execute(sel_stmt)).scalar_one_or_none()
    if not existing:
        sel = AISelectedProduct(conversation_id=conv.id, product_id=product_id)
        db.add(sel)

        # Update search_state selected_product_ids
        s_state = dict(conv.search_state or {})
        sel_ids = list(s_state.get("selected_product_ids") or [])
        if str(product_id) not in sel_ids:
            sel_ids.append(str(product_id))
            s_state["selected_product_ids"] = sel_ids
            conv.search_state = s_state

        await db.commit()

    return {"status": "selected", "conversation_id": str(id), "product_id": str(product_id)}


@router.delete("/conversations/{id}/selection/{product_id}", status_code=status.HTTP_200_OK)
async def unselect_product(
    id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Removes a product from conversation selection."""
    conv = await get_verified_conversation(id, current_user, db)

    del_stmt = delete(AISelectedProduct).where(
        AISelectedProduct.conversation_id == conv.id,
        AISelectedProduct.product_id == product_id,
    )
    await db.execute(del_stmt)

    s_state = dict(conv.search_state or {})
    sel_ids = list(s_state.get("selected_product_ids") or [])
    if str(product_id) in sel_ids:
        sel_ids.remove(str(product_id))
        s_state["selected_product_ids"] = sel_ids
        conv.search_state = s_state

    await db.commit()
    return {"status": "unselected", "conversation_id": str(id), "product_id": str(product_id)}


@router.get("/conversations/{id}/compare")
async def compare_products(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Compares selected products (or first two products shown in conversation)."""
    conv = await get_verified_conversation(id, current_user, db)

    # 1. Gather product IDs from selection or search_state
    sel_stmt = select(AISelectedProduct.product_id).where(AISelectedProduct.conversation_id == conv.id)
    selected_ids = list((await db.execute(sel_stmt)).scalars().all())

    if not selected_ids:
        last_ids = conv.search_state.get("last_product_ids") or []
        selected_ids = [uuid.UUID(i) for i in last_ids[:2]]

    if len(selected_ids) < 2:
        return {
            "comparison": None,
            "message": "At least two products must be selected or retrieved to compare.",
            "products": [],
        }

    # 2. Fetch full product records
    p_stmt = (
        select(Product)
        .options(
            selectinload(Product.price_tiers),
            selectinload(Product.supplier).selectinload(Supplier.company),
            selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
        .where(Product.id.in_(selected_ids[:4]))
    )
    products = list((await db.execute(p_stmt)).scalars().all())

    cards = [format_product_card(p, conv.search_state.get("criteria", {})) for p in products]

    rows = []
    for c in cards:
        rows.append({
            "product_id": c.product_id,
            "title": c.title,
            "supplier_name": c.supplier_name,
            "origin_country": c.origin_country,
            "unit_price": c.unit_price,
            "currency": c.currency,
            "moq": c.moq,
            "supplier_verification": c.supplier_verification,
            "lead_time": c.lead_time,
            "certifications": c.certifications,
        })

    return {
        "conversation_id": str(id),
        "products_count": len(rows),
        "comparison_table": rows,
        "recommendation": f"Best volume option: {rows[0]['title']} ({rows[0]['currency']} {rows[0]['unit_price']})",
    }


@router.post("/conversations/{id}/products/{product_id}/chat")
async def chat_now(
    id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Creates or reuses buyer-supplier thread through existing messaging service.
    IDEMPOTENT: Clicking multiple times reuses the same thread.
    """
    conv = await get_verified_conversation(id, current_user, db)
    thread = await create_or_reuse_chat_thread(current_user, conv.id, product_id, db)

    return {
        "status": "ready",
        "thread_id": str(thread.id),
        "title": thread.title,
        "product_id": str(product_id),
        "supplier_id": str(thread.supplier_id),
        "buyer_id": str(thread.buyer_id),
    }


@router.post("/conversations/{id}/products/{product_id}/negotiation-draft", response_model=NegotiationDraftResponse)
async def create_draft_endpoint(
    id: uuid.UUID,
    product_id: uuid.UUID,
    payload: NegotiationDraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NegotiationDraftResponse:
    """
    Creates an AI negotiation draft with real price, currency, MOQ, and AI-suggested pitch.
    """
    conv = await get_verified_conversation(id, current_user, db)
    draft = await create_negotiation_draft(
        user=current_user,
        conversation_id=conv.id,
        product_id=product_id,
        target_price=payload.target_price,
        quantity=payload.quantity,
        notes=payload.notes,
        db=db,
    )

    return NegotiationDraftResponse(
        id=str(draft.id),
        conversation_id=str(draft.conversation_id),
        product_id=str(draft.product_id),
        supplier_id=str(draft.supplier_id),
        buyer_id=str(draft.buyer_id),
        original_unit_price=draft.original_unit_price,
        currency=draft.currency,
        original_moq=draft.original_moq,
        target_price=draft.target_price,
        quantity=draft.quantity,
        ai_suggested_message=draft.ai_suggested_message,
        final_message=draft.final_message,
        status=draft.status,
        linked_thread_id=str(draft.linked_thread_id) if draft.linked_thread_id else None,
        created_at=draft.created_at.isoformat(),
    )


@router.post("/negotiation-drafts/{id}/send", response_model=NegotiationDraftResponse)
async def send_draft_endpoint(
    id: uuid.UUID,
    payload: NegotiationDraftSendInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NegotiationDraftResponse:
    """
    Dispatches a negotiation draft to the supplier thread.
    REQUIRES explicit confirm=True and final_message text.
    """
    draft = await send_negotiation_draft(
        user=current_user,
        draft_id=id,
        confirm=payload.confirm,
        final_message=payload.final_message,
        db=db,
    )

    return NegotiationDraftResponse(
        id=str(draft.id),
        conversation_id=str(draft.conversation_id),
        product_id=str(draft.product_id),
        supplier_id=str(draft.supplier_id),
        buyer_id=str(draft.buyer_id),
        original_unit_price=draft.original_unit_price,
        currency=draft.currency,
        original_moq=draft.original_moq,
        target_price=draft.target_price,
        quantity=draft.quantity,
        ai_suggested_message=draft.ai_suggested_message,
        final_message=draft.final_message,
        status=draft.status,
        linked_thread_id=str(draft.linked_thread_id) if draft.linked_thread_id else None,
        created_at=draft.created_at.isoformat(),
    )
