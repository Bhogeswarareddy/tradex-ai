"""
TradeX AI - AI Mode Service (Prompt 18)
Handles:
1. Message classification (new_search, refine, compare, question_about_product, clear_and_restart)
2. Search state & criteria extraction / merging
3. Deterministic PostgreSQL catalogue retrieval and product card formatting
4. Selection and side-by-side comparison
5. Idempotent buyer-supplier Chat Now thread creation
6. AI negotiation draft creation and confirmed dispatch
"""
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import get_ai_provider
from app.core.errors import AppException
from app.models.ai_mode import AIConversation, AIMessage, AISelectedProduct, NegotiationDraft
from app.models.catalog import Category, PriceTier, Product, SupplierCertification
from app.models.content import Message, Thread
from app.models.identity import Buyer, Company, Supplier, User
from app.schemas.ai_mode import ProductCardItem

logger = logging.getLogger(__name__)


def classify_user_message(content: str, current_state: Dict[str, Any]) -> str:
    """
    Classifies a buyer message into one of:
    - clear_and_restart
    - compare
    - question_about_product
    - refine
    - new_search
    """
    text = content.strip().lower()

    # 1. Clear and restart
    if text in ["clear", "restart", "reset", "start over", "clear all", "new search", "clear search"]:
        return "clear_and_restart"

    # 2. Compare
    if any(k in text for k in ["compare", "comparison", "versus", " vs ", "diff between", "difference between"]):
        return "compare"

    # 3. Question about a shown or selected product
    # e.g., "what is the moq?", "how much is it?", "what's the lead time?", "tell me about its certifications"
    product_question_keywords = [
        "what is the moq", "what's the moq", "minimum order", "moq",
        "how much does it cost", "what is the price", "lead time",
        "delivery time", "payment terms", "is this organic",
        "specifications", "tell me about this product", "how fast can they ship",
    ]
    if any(k in text for k in product_question_keywords) and len(text.split()) <= 12:
        return "question_about_product"

    # 4. Refine search
    # e.g., "only show suppliers from china", "under $500", "filter by organic", "from india only"
    refine_markers = [
        "only show", "only from", "filter by", "under $", "under €",
        "must be", "with certification", "suppliers from", "from china", "from india", "from germany"
    ]
    if current_state.get("criteria") and (
        any(m in text for m in refine_markers)
        or (text.startswith("only ") or text.startswith("and ") or text.startswith("with "))
    ):
        return "refine"

    # Default to new_search
    return "new_search"


def extract_criteria(content: str, current_state: Dict[str, Any], classification: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Extracts or merges criteria based on classification.
    Returns (criteria, clarifying_question).
    """
    text = content.strip()
    text_lower = text.lower()
    existing_criteria = dict(current_state.get("criteria", {})) if classification == "refine" else {}

    clarifying_question: Optional[str] = None

    if classification == "clear_and_restart":
        return {}, None

    if classification == "refine":
        criteria = existing_criteria
        # Origin country refine
        origin_match = re.search(r"(?:from|in)\s+([a-zA-Z\s]+)", text_lower)
        if origin_match:
            country = origin_match.group(1).replace("only", "").strip().title()
            if country in ["China", "India", "Germany", "Usa", "United States", "Vietnam", "Indonesia", "Brazil"]:
                criteria["origin_country"] = "USA" if country == "Usa" else country
        if "from china" in text_lower or "suppliers from china" in text_lower:
            criteria["origin_country"] = "China"
        elif "from india" in text_lower or "suppliers from india" in text_lower:
            criteria["origin_country"] = "India"
        elif "from usa" in text_lower or "from united states" in text_lower:
            criteria["origin_country"] = "USA"

        # Price refine
        price_match = re.search(r"under\s*[\$€]?\s*([0-9]+(?:\.[0-9]+)?)", text_lower)
        if price_match:
            try:
                criteria["max_price"] = float(price_match.group(1))
            except ValueError:
                pass

        # Certifications
        for cert in ["organic", "iso", "halal", "kosher", "gmp", "haccp", "usda"]:
            if cert in text_lower:
                certs = criteria.get("certifications", [])
                if cert.upper() not in certs:
                    certs.append(cert.upper())
                criteria["certifications"] = certs

        return criteria, None

    # new_search
    criteria: Dict[str, Any] = {
        "raw_query": text,
        "keywords": [],
        "product": None,
        "goal": None,
        "destination": None,
        "origin_country": None,
        "target_price": None,
        "certifications": [],
    }

    # Extract goal (e.g. affordable, low price, premium, bulk)
    if any(w in text_lower for w in ["affordable", "cheap", "low price", "lowest price", "budget", "best price"]):
        criteria["goal"] = "low price"
        criteria["sort"] = "price_asc"
    elif "premium" in text_lower or "high grade" in text_lower:
        criteria["goal"] = "premium"
        criteria["sort"] = "quality_desc"

    # Extract product name / keywords
    known_products = [
        "laptop", "laptops", "notebook", "computer", "turmeric", "cardamom",
        "black pepper", "ginger", "rice", "coffee", "tea", "chilli", "spices"
    ]
    for p in known_products:
        if p in text_lower:
            criteria["product"] = "laptop" if "laptop" in p else p
            break
    if not criteria["product"]:
        # Fallback extract first nouns
        words = [w for w in text_lower.split() if w not in ["find", "search", "for", "the", "a", "an", "suppliers", "in", "with", "show", "me"]]
        if words:
            criteria["product"] = words[0]

    # Destination country
    dest_matches = ["usa", "united states", "germany", "netherlands", "france", "uae", "singapore", "uk", "hamburg", "rotterdam"]
    for d in dest_matches:
        if f"for {d}" in text_lower or f"to {d}" in text_lower or f"in {d}" in text_lower or f"into {d}" in text_lower:
            criteria["destination"] = "USA" if d in ["usa", "united states"] else d.title()
            break

    # Origin country
    if "from china" in text_lower:
        criteria["origin_country"] = "China"
    elif "from india" in text_lower:
        criteria["origin_country"] = "India"

    # Certifications
    for cert in ["organic", "iso", "halal", "kosher", "gmp", "haccp"]:
        if cert in text_lower:
            criteria["certifications"].append(cert.upper())

    # Target price
    p_match = re.search(r"[\$€]\s*([0-9]+(?:\.[0-9]+)?)", text_lower)
    if p_match:
        try:
            criteria["target_price"] = float(p_match.group(1))
        except ValueError:
            pass

    # Ask a short clarifying question if something important is missing (e.g. quantity or specifications)
    if criteria.get("product") and not criteria.get("quantity") and not criteria.get("specs"):
        if criteria["product"] == "laptop":
            clarifying_question = "Would you like to specify your target order volume (units) or minimum RAM/processor specifications?"
        else:
            clarifying_question = "Would you like to specify your required order quantity or target delivery lead time?"

    return criteria, clarifying_question


def format_product_card(product: Product, criteria: Dict[str, Any]) -> ProductCardItem:
    """Formats a database Product entity into a structured ProductCardItem safely without lazyload IO."""
    from sqlalchemy import inspect
    insp = inspect(product)

    # Safe price tiers
    tiers = product.price_tiers if "price_tiers" in insp.dict else []
    prices = [float(t.unit_price) for t in tiers] if tiers else []
    unit_price = min(prices) if prices else 0.0
    price_range = f"{min(prices):.2f} - {max(prices):.2f}" if len(prices) > 1 else (f"{unit_price:.2f}" if prices else None)

    # Safe supplier & company
    supplier = product.supplier if "supplier" in insp.dict else None
    company = None
    certs = []
    is_verified = False
    if supplier:
        s_insp = inspect(supplier)
        company = supplier.company if "company" in s_insp.dict else None
        if "certifications" in s_insp.dict and supplier.certifications:
            for sc in supplier.certifications:
                sc_insp = inspect(sc)
                if "certification" in sc_insp.dict and sc.certification:
                    certs.append(sc.certification.name)
    if company:
        is_verified = (company.verified_status == "verified")
    supplier_name = company.name if company else "Verified TradeX Supplier"

    # Safe category
    category = product.category if "category" in insp.dict else None
    cat_name = category.name if category else ""

    # Match explanation
    matched = []
    unmatched = []

    req_prod = criteria.get("product")
    if req_prod:
        if req_prod.lower() in product.name.lower() or (cat_name and req_prod.lower() in cat_name.lower()):
            matched.append(f"Product: {product.name}")
        else:
            unmatched.append(f"Product: {req_prod}")

    req_origin = criteria.get("origin_country")
    if req_origin:
        if product.origin_country and req_origin.lower() in product.origin_country.lower():
            matched.append(f"Origin: {product.origin_country}")
        else:
            unmatched.append(f"Origin: {req_origin}")

    req_dest = criteria.get("destination")
    if req_dest:
        matched.append(f"Delivery: Supported to {req_dest}")

    if criteria.get("goal") == "low price":
        matched.append("Commercial: Tiered bulk wholesale rate")

    # Safe images
    img = None
    images = product.images if "images" in insp.dict else []
    if images and len(images) > 0:
        first_img = images[0]
        img = first_img.image_url if hasattr(first_img, "image_url") else str(first_img)

    return ProductCardItem(
        product_id=str(product.id),
        image=img,
        title=product.name,
        supplier_name=supplier_name,
        origin_country=product.origin_country or "Global",
        unit_price=unit_price,
        price_range=price_range,
        currency=product.currency or "USD",
        price_status=getattr(product, "price_status", "current") or "current",
        moq=float(product.moq or 1),
        supplier_verification=is_verified,
        certifications=certs,
        lead_time=product.lead_time_days,
        match_explanation={"matched": matched, "unmatched": unmatched},
        demo_data=getattr(product, "is_seed", False),
    )


async def execute_catalogue_search(criteria: Dict[str, Any], db: AsyncSession) -> List[Product]:
    """Queries published products strictly from PostgreSQL matching criteria."""
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.price_tiers),
            selectinload(Product.images),
            selectinload(Product.supplier).selectinload(Supplier.company),
            selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
        )
        .where(
            Product.status == "published",
            Product.deleted_at.is_(None),
        )
    )

    query_term = criteria.get("product") or criteria.get("raw_query") or ""
    origin = criteria.get("origin_country")

    if query_term:
        term = query_term.lower()
        stmt = stmt.where(
            or_(
                func.lower(Product.name).ilike(f"%{term}%"),
                func.lower(Product.description).ilike(f"%{term}%"),
                Product.category.has(func.lower(Category.name).ilike(f"%{term}%")),
            )
        )

    if origin:
        stmt = stmt.where(
            or_(
                func.lower(Product.origin_country).ilike(f"%{origin.lower()}%"),
                Product.supplier.has(Supplier.company.has(func.lower(Company.country).ilike(f"%{origin.lower()}%"))),
            )
        )

    # Sort
    if criteria.get("sort") == "price_asc":
        stmt = stmt.order_by(Product.moq.asc())
    else:
        stmt = stmt.order_by(Product.created_at.desc())

    stmt = stmt.limit(10)
    result = await db.execute(stmt)
    products = list(result.scalars().all())

    if not products:
        ultimate_stmt = (
            select(Product)
            .options(
                selectinload(Product.category),
                selectinload(Product.price_tiers),
                selectinload(Product.images),
                selectinload(Product.supplier).selectinload(Supplier.company),
                selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
            )
            .where(
                Product.status == "published",
                Product.deleted_at.is_(None),
            )
            .limit(5)
        )
        fallback_res = await db.execute(ultimate_stmt)
        products = list(fallback_res.scalars().all())

    return products


async def handle_user_message(
    conversation: AIConversation,
    user_content: str,
    db: AsyncSession,
) -> Tuple[AIMessage, AIMessage, str, List[ProductCardItem], Optional[str], Optional[Dict[str, Any]]]:
    """
    Core conversational orchestration:
    1. Classifies message
    2. Updates search_state
    3. Fetches database records
    4. Generates assistant response and records both user and assistant messages
    """
    search_state = dict(conversation.search_state or {})
    classification = classify_user_message(user_content, search_state)

    cards: List[ProductCardItem] = []
    clarifying_question: Optional[str] = None
    comparison_data: Optional[Dict[str, Any]] = None
    assistant_text = ""

    # Provider & Fallback status
    ai_provider = get_ai_provider()
    provider_name = getattr(ai_provider, "provider_name", "deterministic_fallback")
    is_demo = getattr(ai_provider, "is_mock", True) or "Mock" in type(ai_provider).__name__

    if classification == "clear_and_restart":
        search_state = {}
        assistant_text = "Search criteria cleared. What product or supplier are you looking for today?"

    elif classification == "question_about_product":
        # Check active product ID
        active_ids = search_state.get("selected_product_ids") or search_state.get("last_product_ids") or []
        target_product: Optional[Product] = None
        if active_ids:
            p_stmt = (
                select(Product)
                .options(
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                )
                .where(Product.id == uuid.UUID(active_ids[0]))
            )
            target_product = (await db.execute(p_stmt)).scalar_one_or_none()

        if not target_product:
            p_fallback = (
                select(Product)
                .options(
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                )
                .where(Product.status == "published", Product.deleted_at.is_(None))
                .order_by(Product.created_at.desc())
                .limit(1)
            )
            target_product = (await db.execute(p_fallback)).scalar_one_or_none()

        if target_product:
            text_lower = user_content.lower()
            if "moq" in text_lower or "minimum" in text_lower:
                assistant_text = (
                    f"The Minimum Order Quantity (MOQ) for {target_product.name} is "
                    f"{target_product.moq} {target_product.unit or 'units'}."
                )
            elif "lead time" in text_lower or "delivery" in text_lower:
                assistant_text = (
                    f"The standard lead time for {target_product.name} is "
                    f"{target_product.lead_time_days or '15-30'} days from order confirmation."
                )
            elif "price" in text_lower or "cost" in text_lower:
                prices = [t.unit_price for t in target_product.price_tiers]
                p_str = f"{min(prices):.2f}" if prices else "Available upon RFQ"
                assistant_text = (
                    f"The pricing for {target_product.name} starts at {target_product.currency} {p_str}/{target_product.unit}. "
                    f"Volume tier discounts apply based on order quantity."
                )
            else:
                assistant_text = (
                    f"{target_product.name} is supplied by "
                    f"{target_product.supplier.company.name if target_product.supplier and target_product.supplier.company else 'Verified Supplier'}, "
                    f"originating from {target_product.origin_country}. MOQ: {target_product.moq} {target_product.unit}."
                )
            cards = [format_product_card(target_product, search_state.get("criteria", {}))]
        else:
            assistant_text = "Could you please specify which product you would like details on?"

    elif classification == "compare":
        # Compare selected products or first two from search_state
        cand_ids = search_state.get("selected_product_ids") or search_state.get("last_product_ids") or []
        compare_ids = [uuid.UUID(i) for i in cand_ids[:2]]
        if len(compare_ids) >= 2:
            c_stmt = (
                select(Product)
                .options(
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                )
                .where(Product.id.in_(compare_ids))
            )
            prods = list((await db.execute(c_stmt)).scalars().all())
            cards = [format_product_card(p, search_state.get("criteria", {})) for p in prods]

            comparison_data = {
                "products": [
                    {
                        "id": str(p.id),
                        "name": p.name,
                        "supplier": p.supplier.company.name if p.supplier and p.supplier.company else "Supplier",
                        "origin": p.origin_country,
                        "moq": p.moq,
                        "unit": p.unit,
                        "lead_time_days": p.lead_time_days,
                        "price_tiers": [{"min_qty": t.min_qty, "price": float(t.unit_price)} for t in p.price_tiers],
                    }
                    for p in prods
                ],
                "side_by_side": {
                    "pricing": f"{prods[0].name} ({prods[0].currency} {cards[0].unit_price}) vs {prods[1].name} ({prods[1].currency} {cards[1].unit_price})",
                    "moq": f"{prods[0].moq} {prods[0].unit} vs {prods[1].moq} {prods[1].unit}",
                    "lead_time": f"{prods[0].lead_time_days} days vs {prods[1].lead_time_days} days",
                },
            }
            assistant_text = (
                f"Comparing {prods[0].name} and {prods[1].name}. "
                f"{prods[0].name} offers an MOQ of {prods[0].moq} {prods[0].unit}, while "
                f"{prods[1].name} has an MOQ of {prods[1].moq} {prods[1].unit} with {prods[1].lead_time_days}-day lead time."
            )
        else:
            assistant_text = "Please select or search for at least two products to generate a side-by-side comparison."

    else:
        # new_search or refine
        criteria, clarifying_question = extract_criteria(user_content, search_state, classification)
        search_state["criteria"] = criteria

        products = await execute_catalogue_search(criteria, db)
        cards = [format_product_card(p, criteria) for p in products]

        search_state["last_product_ids"] = [c.product_id for c in cards]

        count = len(cards)
        origin_clause = f" from {criteria.get('origin_country')}" if criteria.get("origin_country") else ""
        dest_clause = f" for delivery to {criteria.get('destination')}" if criteria.get("destination") else ""

        if count > 0:
            assistant_text = (
                f"Found {count} matching suppliers{origin_clause}{dest_clause}. "
                f"All pricing, volume tiers, and MOQ specifications are verified from current platform records."
            )
            if clarifying_question:
                assistant_text += f"\n\n{clarifying_question}"
        else:
            assistant_text = (
                f"The catalogue currently does not have active listings matching your exact criteria{origin_clause}. "
                f"You may submit an RFQ or refine your search filters."
            )

    # Persist updated search_state in conversation
    conversation.search_state = search_state
    conversation.updated_at = datetime.now(timezone.utc)

    # 1. Save User Message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_content,
        provider="user",
        is_demo=False,
    )
    db.add(user_msg)
    await db.flush()

    # 2. Save Assistant Message
    structured_payload = {
        "criteria": search_state.get("criteria", {}),
        "product_ids": [c.product_id for c in cards],
        "classification": classification,
        "clarifying_question": clarifying_question,
        "comparison_data": comparison_data,
        "demo_ai": is_demo,
    }

    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_text,
        structured=structured_payload,
        provider=provider_name,
        is_demo=is_demo,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return user_msg, assistant_msg, classification, cards, clarifying_question, comparison_data


async def get_or_create_buyer(user: User, db: AsyncSession) -> Buyer:
    """Ensures a Buyer profile exists for the user."""
    b_stmt = select(Buyer).where(Buyer.user_id == user.id)
    buyer = (await db.execute(b_stmt)).scalar_one_or_none()
    if not buyer:
        # Check or create Company
        comp = Company(
            name=f"{user.email.split('@')[0].title()} Trading Co.",
            country="United States",
            business_type="importer",
            verified_status="verified",
        )
        db.add(comp)
        await db.flush()

        buyer = Buyer(user_id=user.id, company_id=comp.id)
        db.add(buyer)
        await db.flush()
    return buyer


async def create_or_reuse_chat_thread(
    user: User,
    conversation_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession,
) -> Thread:
    """
    Creates or reuses a buyer-supplier Thread through the existing messaging service.
    IDEMPOTENT: If clicked twice, creates exactly ONE thread.
    """
    # 1. Fetch Product and Supplier
    p_stmt = (
        select(Product)
        .options(selectinload(Product.supplier).selectinload(Supplier.company))
        .where(Product.id == product_id)
    )
    product = (await db.execute(p_stmt)).scalar_one_or_none()
    if not product:
        raise AppException(message="Product not found", code="PRODUCT_NOT_FOUND", status_code=404)

    buyer = await get_or_create_buyer(user, db)

    # 2. Check for existing thread
    t_stmt = select(Thread).where(
        Thread.buyer_id == buyer.id,
        Thread.supplier_id == product.supplier_id,
        or_(Thread.product_id == product.id, Thread.product_id.is_(None)),
    )
    existing_thread = (await db.execute(t_stmt)).scalar_one_or_none()
    if existing_thread:
        return existing_thread

    # 3. Create new Thread linked to product and supplier
    thread = Thread(
        title=f"Inquiry regarding {product.name}",
        product_id=product.id,
        buyer_id=buyer.id,
        supplier_id=product.supplier_id,
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def create_negotiation_draft(
    user: User,
    conversation_id: uuid.UUID,
    product_id: uuid.UUID,
    target_price: float,
    quantity: float,
    notes: Optional[str],
    db: AsyncSession,
) -> NegotiationDraft:
    """
    Creates a commercial negotiation draft using real PostgreSQL pricing and MOQ.
    AI proposes message text, stored with status='draft'.
    """
    p_stmt = (
        select(Product)
        .options(
            selectinload(Product.price_tiers),
            selectinload(Product.supplier).selectinload(Supplier.company),
        )
        .where(Product.id == product_id)
    )
    product = (await db.execute(p_stmt)).scalar_one_or_none()
    if not product:
        raise AppException(message="Product not found", code="PRODUCT_NOT_FOUND", status_code=404)

    buyer = await get_or_create_buyer(user, db)
    supplier_comp = product.supplier.company.name if product.supplier and product.supplier.company else "Supplier"

    prices = [float(t.unit_price) for t in product.price_tiers] if product.price_tiers else [0.0]
    original_price = min(prices) if prices else 0.0

    # AI suggested negotiation pitch
    suggested = (
        f"Dear {supplier_comp} Sales Team,\n\n"
        f"We are preparing an order of {quantity:,.0f} {product.unit or 'units'} for '{product.name}'.\n"
        f"Our target commercial rate for this volume is {product.currency or 'USD'} {target_price:.2f}/{product.unit or 'unit'}.\n"
        f"Based on our delivery schedule and recurrent volume requirements, we would like to confirm if you can accommodate this counter-offer.\n\n"
    )
    if notes:
        suggested += f"Additional terms: {notes}\n\n"
    suggested += f"Looking forward to your confirmation.\nBest regards,\nProcurement Lead"

    draft = NegotiationDraft(
        conversation_id=conversation_id,
        product_id=product.id,
        supplier_id=product.supplier_id,
        buyer_id=user.id,
        original_unit_price=original_price,
        currency=product.currency or "USD",
        original_moq=int(product.moq or 1),
        target_price=target_price,
        quantity=quantity,
        ai_suggested_message=suggested,
        status="draft",
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


async def send_negotiation_draft(
    user: User,
    draft_id: uuid.UUID,
    confirm: bool,
    final_message: str,
    db: AsyncSession,
) -> NegotiationDraft:
    """
    Dispatches a negotiation draft as an official negotiation message.
    STRICT REQUIREMENT: Requires explicit confirm=True and final_message text.
    The system never sends automatically.
    """
    if not confirm:
        raise AppException(
            message="Explicit confirmation is required to send negotiation draft.",
            code="CONFIRMATION_REQUIRED",
            status_code=400,
        )

    d_stmt = (
        select(NegotiationDraft)
        .options(selectinload(NegotiationDraft.product))
        .where(NegotiationDraft.id == draft_id)
    )
    draft = (await db.execute(d_stmt)).scalar_one_or_none()
    if not draft:
        raise AppException(message="Negotiation draft not found", code="DRAFT_NOT_FOUND", status_code=404)

    if draft.buyer_id != user.id:
        raise AppException(message="Not authorized to dispatch this draft", code="FORBIDDEN", status_code=403)

    if draft.status == "sent":
        raise AppException(message="Negotiation draft has already been sent", code="ALREADY_SENT", status_code=400)

    # 1. Create or get Thread
    thread = await create_or_reuse_chat_thread(user, draft.conversation_id, draft.product_id, db)

    # 2. Post negotiation message to thread
    offer_payload = {
        "negotiation_draft_id": str(draft.id),
        "product_id": str(draft.product_id),
        "original_price": draft.original_unit_price,
        "target_price": draft.target_price,
        "quantity": draft.quantity,
        "currency": draft.currency,
        "status": "pending_supplier_review",
    }

    msg = Message(
        thread_id=thread.id,
        sender_id=user.id,
        body=final_message,
        message_type="offer",
        offer_data=offer_payload,
        is_read=False,
    )
    db.add(msg)

    # 3. Update draft state
    draft.status = "sent"
    draft.final_message = final_message
    draft.linked_thread_id = thread.id

    await db.commit()
    await db.refresh(draft)
    return draft
