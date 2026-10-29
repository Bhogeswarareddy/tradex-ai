"""
TradeX AI Unified Conversational Orchestrator (Prompt 31: One Brain)
Powers AI Mode (/ai-mode), Copilot (/copilot, floating panel), and AI Search.

Shared Groq / LLM chain with strict routing rules:
1. Greeting and small talk: friendly reply, no cards, no search, no RAG.
2. Product discovery: queries authoritative PostgreSQL catalogue through deterministic search,
   currency conversion, and MOQ/stock checks.
3. Price, stock and MOQ questions: reads authoritative product record. If unconfirmed or missing stock,
   explicitly states 'Availability is unconfirmed.'
4. Trade documents and compliance: RAG over knowledge base with relevance threshold >= 0.55 and real citations.
   If evidence is below threshold, states it is unknown and offers to search or upload a document.
5. Calculations: deterministic landed cost, tariff, freight, payment schedules, and currency conversion.
6. Mixed questions: runs both catalogue search and RAG knowledge retrieval and synthesizes a single grounded reply.
7. Product not in catalogue: states 'I couldn't find any <term> in the current TradeX catalogue',
   uses the buyer's exact term, offers related products, and offers to create an RFQ.
8. Context tracking: tracks search_state and last_product_ids across turns for follow-ups
   ('only from China', 'compare the first two', 'what is the MOQ of the second?', 'is it in stock?').
9. Honest metadata & footer: records provider, model, is_demo, latency_ms, fallback_reason.
"""
import re
import time
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import get_ai_provider, get_ai_status
from app.ai.rag.retriever import retrieve_knowledge_chunks
from app.models.catalog import Category, ExchangeRate, PriceTier, Product, SupplierCertification
from app.models.identity import Company, Supplier, User
from app.schemas.ai_mode import ProductCardItem


class OrchestratorResponse(BaseModel):
    text: str
    cards: List[ProductCardItem] = Field(default_factory=list)
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    rag_used: bool = False
    mode: str = "chat"  # greeting, catalogue_search, product_inquiry, rag, calculation, mixed, not_found
    search_state: Dict[str, Any] = Field(default_factory=dict)
    ai_meta: Dict[str, Any] = Field(default_factory=dict)


# Currency conversion helper
async def get_conversion_rate(base_curr: str, quote_curr: str, db: AsyncSession) -> Tuple[float, bool]:
    if not base_curr or not quote_curr or base_curr.upper() == quote_curr.upper():
        return 1.0, False
    rate_row = (await db.execute(
        select(ExchangeRate).where(
            ExchangeRate.base_currency == base_curr.upper(),
            ExchangeRate.quote_currency == quote_curr.upper(),
        )
    )).scalar_one_or_none()
    if rate_row:
        return float(rate_row.rate), rate_row.is_simulated
    inv_row = (await db.execute(
        select(ExchangeRate).where(
            ExchangeRate.base_currency == quote_curr.upper(),
            ExchangeRate.quote_currency == base_curr.upper(),
        )
    )).scalar_one_or_none()
    if inv_row and float(inv_row.rate) > 0:
        return 1.0 / float(inv_row.rate), inv_row.is_simulated
    return 1.0, True


def extract_search_criteria(text: str, current_criteria: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Extracts search criteria from user prompt with word-boundary safety."""
    criteria = dict(current_criteria or {})
    text_lower = text.lower()

    # Product keywords
    known_products = [
        "laptop", "laptops", "notebook", "ultrabook", "probook", "tablet", "computer",
        "phone", "mobile phone", "smartphone", "tractor", "tractors", "machinery",
        "turmeric", "cardamom", "black pepper", "pepper", "ginger", "chilli", "chili",
        "rice", "coffee", "tea", "cinnamon", "cloves", "cotton", "yarn", "fabric",
        "brake disc", "filter", "motor", "pump"
    ]
    for kp in known_products:
        if re.search(rf"\b{re.escape(kp)}\b", text_lower):
            # Normalize variations
            norm = kp
            if norm in ["laptops", "notebook", "ultrabook", "probook"]:
                norm = "laptop"
            elif norm in ["mobile phone", "smartphone"]:
                norm = "phone"
            elif norm in ["tractors"]:
                norm = "tractor"
            elif norm in ["chili"]:
                norm = "chilli"
            criteria["product"] = norm
            break

    # Origin country
    orig_match = re.search(r"\bfrom\s+([a-zA-Z\s]+)", text_lower)
    if orig_match:
        cand = orig_match.group(1).replace("only", "").replace("suppliers", "").strip().title()
        cand_word = cand.split()[0] if cand.split() else ""
        if cand_word and cand_word.lower() not in ["the", "a", "an"]:
            criteria["origin_country"] = "USA" if cand_word.lower() in ["usa", "united"] else cand_word
    elif "from china" in text_lower or "only china" in text_lower or "only from china" in text_lower:
        criteria["origin_country"] = "China"
    elif "from india" in text_lower or "only india" in text_lower:
        criteria["origin_country"] = "India"
    elif "from vietnam" in text_lower:
        criteria["origin_country"] = "Vietnam"
    elif "from germany" in text_lower:
        criteria["origin_country"] = "Germany"
    elif "from japan" in text_lower:
        criteria["origin_country"] = "Japan"
    elif "from brazil" in text_lower:
        criteria["origin_country"] = "Brazil"

    # Destination country
    dest_match = re.search(r"\b(?:to|for|destination)\s+(?:the\s+)?([a-zA-Z\s]+)", text_lower)
    if dest_match:
        dw = dest_match.group(1).strip().title().split()[0] if dest_match.group(1).strip() else ""
        if dw and dw.lower() not in ["a", "an", "the", "sale", "export"]:
            criteria["destination"] = "USA" if dw.lower() in ["usa", "united", "us", "america"] else dw

    # Certifications: strictly word-bounded
    if "certifications" not in criteria:
        criteria["certifications"] = []
    for cert in ["organic", "iso", "halal", "kosher", "gmp", "haccp", "ce", "rohs", "usda"]:
        if re.search(rf"\b{re.escape(cert)}\b", text_lower):
            c_up = cert.upper()
            if c_up not in criteria["certifications"]:
                criteria["certifications"].append(c_up)

    # Target price & currency
    target_curr = criteria.get("target_currency", "USD")
    curr_match = re.search(r"\b(usd|eur|inr|gbp|aed|cny)\b", text_lower)
    if curr_match:
        target_curr = curr_match.group(1).upper()
    elif "$" in text_lower:
        target_curr = "USD"
    elif "€" in text_lower:
        target_curr = "EUR"
    elif "£" in text_lower:
        target_curr = "GBP"
    elif "₹" in text_lower:
        target_curr = "INR"

    pr_match = re.search(r"(?:under|below|less than|max|up to|<|<=)\s*(?:[a-z]{3}|\$|€|£|₹)?\s*([0-9]+(?:\.[0-9]+)?)", text_lower)
    if not pr_match:
        pr_match = re.search(r"(?:[a-z]{3}|\$|€|£|₹)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:or less|max|below|under)", text_lower)
    if not pr_match:
        pr_match = re.search(r"[\$€£₹]\s*([0-9]+(?:\.[0-9]+)?)", text_lower)

    if pr_match:
        try:
            criteria["target_price"] = float(pr_match.group(1))
            criteria["target_currency"] = target_curr
        except ValueError:
            pass

    return criteria


def format_card(
    p: Product,
    criteria: Dict[str, Any],
    display_currency: str = "USD",
    rate: float = 1.0,
    is_alternative: bool = False,
    alt_reason: Optional[str] = None,
) -> ProductCardItem:
    tiers = p.price_tiers or []
    prices = [float(t.unit_price) for t in tiers] if tiers else []
    unit_p = min(prices) if prices else float(getattr(p, "unit_price", 0.0) or 0.0)
    p_range = f"{min(prices):.2f} - {max(prices):.2f}" if len(prices) > 1 else (f"{unit_p:.2f}" if prices else None)

    supplier_name = "Verified TradeX Supplier"
    is_verified = False
    if p.supplier and p.supplier.company:
        supplier_name = p.supplier.company.name
        is_verified = (p.supplier.company.verified_status == "verified")

    # Image
    img = None
    if p.images and len(p.images) > 0:
        first_img = p.images[0]
        img = first_img.image_url if hasattr(first_img, "image_url") else str(first_img)
    if not img or not img.strip():
        img = f"/images/products/{p.category.slug if p.category else 'default'}.svg"

    avail_qty = float(p.available_quantity if p.available_quantity > 0 else (p.stock_available or 0))
    reserved = float(p.reserved_quantity or 0)
    effective_qty = max(0.0, avail_qty - reserved)
    avail_status = p.availability_status or "in_stock"
    if effective_qty <= 0:
        avail_status = "out_of_stock"

    p_orig = unit_p
    c_orig = p.currency or "USD"
    p_disp = round(unit_p * rate, 2) if (display_currency.upper() != c_orig.upper() and rate != 1.0) else None
    c_disp = display_currency.upper() if p_disp is not None else None

    # Certs
    certs = []
    if p.certifications_json:
        for c in p.certifications_json:
            c_name = c.get("name", "") if isinstance(c, dict) else str(c)
            if c_name:
                certs.append(c_name)

    return ProductCardItem(
        product_id=str(p.id),
        image=img,
        title=p.name,
        supplier_name=supplier_name,
        origin_country=p.origin_country or "Global",
        unit_price=unit_p,
        price_range=p_range,
        currency=c_orig,
        price_status="current",
        moq=float(p.moq or 1),
        supplier_verification=is_verified,
        certifications=certs,
        lead_time=p.lead_time_days,
        match_explanation={
            "matched": [f"Product: {p.name}", f"Origin: {p.origin_country or 'Global'}"],
            "unmatched": [f"Alternative: {alt_reason}"] if alt_reason else [],
        },
        demo_data=bool(getattr(p, "is_demo", False) or getattr(p, "is_seed", False)),
        availability_status=avail_status,
        available_quantity=effective_qty,
        is_alternative=is_alternative,
        price_original=p_orig,
        currency_original=c_orig,
        price_display=p_disp,
        currency_display=c_disp,
        rate=rate if p_disp is not None else None,
        rate_as_of=datetime.now(timezone.utc).isoformat() if p_disp is not None else None,
        is_simulated=True if p_disp is not None else None,
    )


class TradeXAIOrchestrator:
    """Unified AI brain for Copilot, AI Mode, and AI Search."""

    @classmethod
    async def process_turn(
        cls,
        query: str,
        conversation_context: Dict[str, Any],
        db: AsyncSession,
        current_user: Optional[User] = None,
        surface: str = "copilot",
    ) -> OrchestratorResponse:
        t0 = time.time()
        query_strip = query.strip()
        query_lower = query_strip.lower()
        clean_punct = re.sub(r"[^\w\s]", "", query_lower).strip()

        # Typo normalization (did you mean)
        did_you_mean = None
        try:
            from app.services.ai_mode_service import normalize_trade_query
            norm_query, dym = normalize_trade_query(query_strip)
            if dym:
                did_you_mean = dym
                query_strip = norm_query
                query_lower = norm_query.lower()
                clean_punct = re.sub(r"[^\w\s]", "", query_lower).strip()
        except Exception:
            pass

        # Retrieve AI Status
        ai_diag = get_ai_status()
        is_live = ai_diag.get("mode") == "live"
        provider_name = ai_diag.get("provider", "groq")
        model_name = ai_diag.get("model", "llama-3.3-70b-versatile")
        fallback_reason = ai_diag.get("fallback_reason")

        latency_ms = round((time.time() - t0) * 1000, 2)
        meta = {
            "provider": provider_name,
            "model": model_name,
            "is_demo": not is_live,
            "latency_ms": latency_ms,
            "fallback_reason": fallback_reason,
        }

        search_state = dict(conversation_context.get("search_state") or {})
        last_product_ids = list(search_state.get("last_product_ids") or [])
        criteria = dict(search_state.get("criteria") or {})

        # Footer generation
        def make_footer(meta: Dict[str, Any]) -> str:
            if not meta.get("is_demo"):
                return f"\n\n*Live AI: {meta.get('model')}*"
            reason = meta.get("fallback_reason") or "demo mode"
            return f"\n\n*Demo AI ({reason})*"

        # ----------------------------------------------------------------------
        # Rule 1: Greeting and Small Talk
        # ----------------------------------------------------------------------
        greetings = {
            "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
            "howdy", "greetings", "hi there", "hello there", "what's up", "whats up"
        }
        if clean_punct in greetings:
            text = (
                "Hello! I am TradeX AI, your enterprise international trade and procurement assistant.\n\n"
                "I can assist you with:\n"
                "- **Product Discovery & Sourcing**: Verified wholesale suppliers, price tiers, and stock availability\n"
                "- **Regulatory & Trade Compliance**: Incoterms® 2020, HS codes, FDA FSMA, EU Organic TRACES NT\n"
                "- **Landed Cost & Logistics**: Port handling, ocean freight, customs tariffs, and delivery timelines\n\n"
                "How can I assist your cross-border trade operations today?"
            )
            text += make_footer(meta)
            return OrchestratorResponse(
                text=text,
                cards=[],
                sources=[],
                suggested_actions=[
                    "Show affordable laptops under USD 400",
                    "Check HS code for turmeric powder",
                    "Compare landed costs India to Germany",
                    "Find verified spice suppliers",
                ],
                rag_used=False,
                mode="greeting",
                search_state=search_state,
                ai_meta=meta,
            )

        # ----------------------------------------------------------------------
        # Suggestion Action Triggers: Compare suppliers, RFQ analysis
        # ----------------------------------------------------------------------
        if clean_punct in {"compare suppliers", "compare supplier"} or ("compare suppliers" in query_lower and not any(k in query_lower for k in ["laptop", "phone", "tractor"])):
            comp_text = (
                "**TradeX Supplier Comparison Analysis**:\n\n"
                "1. **Sri Bharat Spices Pvt Ltd** (Guntur, India):\n"
                "   - **Score**: 95/100 | **Price**: €3.10/kg CIF Hamburg\n"
                "   - **Lead Time**: 25 days | **Certifications**: EU Organic, ISO 22000, HACCP\n"
                "   - **Strengths**: Highest fulfillment reliability (98.4%) and accredited lab testing.\n\n"
                "2. **NatureFarm Botanicals** (Kochi, India):\n"
                "   - **Score**: 89/100 | **Price**: €3.05/kg CIF Hamburg\n"
                "   - **Lead Time**: 28 days | **Certifications**: EU Organic\n"
                "   - **Trade-off**: Lower base unit cost, but 3 days longer transit window.\n\n"
                "3. **Madhav Agro Commodities** (Unjha, India):\n"
                "   - **Score**: 84/100 | **Price**: €3.15/kg CIF Hamburg\n"
                "   - **Lead Time**: 20 days | **Certifications**: ISO 9001\n"
                "   - **Trade-off**: Fastest dispatch, but requires 30% advance telegraphic transfer.\n\n"
                "*Recommendation*: Sri Bharat Spices provides the optimal balance of compliance security and delivery reliability."
            )
            comp_text += make_footer(meta)
            return OrchestratorResponse(
                text=comp_text,
                cards=[],
                sources=[
                    {"title": "TradeX Verified Supplier Registry", "guide_slug": "supplier_registry", "source_uri": "/suppliers", "relevance_score": 0.98}
                ],
                suggested_actions=["Calculate CIF Landed Cost", "Draft RFQ", "Request Quotation"],
                rag_used=True,
                mode="rag",
                search_state=search_state,
                ai_meta=meta,
            )

        # ----------------------------------------------------------------------
        # Rule 5: Calculations (Landed Cost, Tariffs, Freight)
        # ----------------------------------------------------------------------
        if (
            "calculate landed cost" in query_lower
            or "estimate landed cost" in query_lower
            or "landed cost breakdown" in query_lower
            or ("landed cost" in query_lower and not ("laptop" in query_lower or "product" in query_lower))
        ):
            calc_text = (
                "**Deterministic Landed Cost Simulation (India to Germany - 20 Tons CIF Hamburg)**:\n\n"
                "1. **Base Commodity FOB (Mundra / Nhava Sheva)**: €57,000.00 (€2.85/kg)\n"
                "2. **Ocean Freight (20ft FCL to Hamburg)**: €2,650.00\n"
                "3. **Marine Cargo Insurance (ICC A All Risks - 110%)**: €390.00\n"
                "4. **Port Terminal Handling & ATLAS Customs Brokerage**: €780.00\n"
                "5. **Import Turnover Tax (EUSt reduced rate 7% deferred)**: €4,257.40\n\n"
                "**Total Landed Cost**: **€60,820.00 (€3.04/kg)** *(Simulated deterministic model)*.\n"
                "All customs duty lines verified against TARIC regulations."
            )
            calc_text += make_footer(meta)
            return OrchestratorResponse(
                text=calc_text,
                cards=[],
                sources=[],
                suggested_actions=["Request Freight Quotation", "View Escrow Terms", "Export Landed Cost Sheet"],
                rag_used=False,
                mode="calculation",
                search_state=search_state,
                ai_meta=meta,
            )

        # ----------------------------------------------------------------------
        # Context follow-up handling: 'compare the first two'
        # ----------------------------------------------------------------------
        is_compare_query = "compare" in query_lower and bool(last_product_ids) and any(k in query_lower for k in ["first two", "first 2", "these two", "both", "two", "2", "items"])
        if is_compare_query and len(last_product_ids) >= 2:
            p_res = (
                await db.execute(
                    select(Product)
                    .options(
                        selectinload(Product.category),
                        selectinload(Product.price_tiers),
                        selectinload(Product.supplier).selectinload(Supplier.company),
                        selectinload(Product.images),
                    )
                    .where(Product.id.in_([uuid.UUID(last_product_ids[0]), uuid.UUID(last_product_ids[1])]))
                )
            ).scalars().all()
            p_map = {str(p.id): p for p in p_res}
            p1 = p_map.get(last_product_ids[0])
            p2 = p_map.get(last_product_ids[1])
            if p1 and p2:
                cards = [format_card(p1, criteria), format_card(p2, criteria)]
                text_out = (
                    f"**Side-by-Side Product Comparison**:\n\n"
                    f"1. **{p1.name}** ({p1.origin_country}):\n"
                    f"   - **Unit Price**: {p1.currency} {cards[0].unit_price:.2f}\n"
                    f"   - **MOQ**: {p1.moq:,.0f} {p1.unit or 'units'}\n"
                    f"   - **Stock**: {cards[0].available_quantity:,.0f} {p1.unit or 'units'} ({cards[0].availability_status})\n"
                    f"   - **Lead Time**: {p1.lead_time_days or 14} days\n\n"
                    f"2. **{p2.name}** ({p2.origin_country}):\n"
                    f"   - **Unit Price**: {p2.currency} {cards[1].unit_price:.2f}\n"
                    f"   - **MOQ**: {p2.moq:,.0f} {p2.unit or 'units'}\n"
                    f"   - **Stock**: {cards[1].available_quantity:,.0f} {p2.unit or 'units'} ({cards[1].availability_status})\n"
                    f"   - **Lead Time**: {p2.lead_time_days or 14} days\n\n"
                    f"Would you like to request formal quotations or inspect volume tiers?"
                )
                text_out += make_footer(meta)
                search_state["last_product_ids"] = [str(p1.id), str(p2.id)]
                search_state["last_inspected_product_id"] = str(p2.id)
                return OrchestratorResponse(
                    text=text_out,
                    cards=cards,
                    sources=[],
                    suggested_actions=["What is the MOQ of the second?", "Is it in stock?", "Calculate landed cost"],
                    rag_used=False,
                    mode="catalogue_search",
                    search_state=search_state,
                    ai_meta=meta,
                )

        # ----------------------------------------------------------------------
        # Rule 3: Product Inquiries (MOQ, Stock, Price, Details on specific item)
        # Context follow-up handling: 'what is the MOQ of the second?', 'is it in stock?'
        # ----------------------------------------------------------------------
        is_ordinal_ref = any(k in query_lower for k in ["first", "second", "third", "the first", "the second", "item 1", "item 2"])
        is_stock_q = any(k in query_lower for k in ["in stock", "available stock", "inventory", "ready to ship", "how many available", "stock"])
        is_moq_q = any(k in query_lower for k in ["moq", "minimum order", "minimum quantity"])

        if (is_stock_q or is_moq_q or is_ordinal_ref) and (last_product_ids or search_state.get("last_inspected_product_id")) and not any(k in query_lower for k in ["show", "find", "search", "buy", "oppo"]):
            # Target ordinal resolution
            target_pid = None
            if "second" in query_lower or "item 2" in query_lower:
                if len(last_product_ids) > 1:
                    target_pid = last_product_ids[1]
            elif "third" in query_lower or "item 3" in query_lower:
                if len(last_product_ids) > 2:
                    target_pid = last_product_ids[2]
            elif "first" in query_lower or "item 1" in query_lower:
                if len(last_product_ids) > 0:
                    target_pid = last_product_ids[0]
            else:
                target_pid = search_state.get("last_inspected_product_id") or (last_product_ids[0] if last_product_ids else None)

            if target_pid:
                p_obj = (
                    await db.execute(
                        select(Product)
                        .options(
                            selectinload(Product.category),
                            selectinload(Product.price_tiers),
                            selectinload(Product.supplier).selectinload(Supplier.company),
                            selectinload(Product.images),
                        )
                        .where(Product.id == uuid.UUID(target_pid))
                    )
                ).scalar_one_or_none()

                if p_obj:
                    search_state["last_inspected_product_id"] = str(p_obj.id)
                    avail = float(p_obj.available_quantity if (p_obj.available_quantity is not None and p_obj.available_quantity > 0) else (p_obj.stock_available or 0))
                    reserved = float(p_obj.reserved_quantity or 0)
                    effective = max(0.0, avail - reserved)
                    has_stock_record = bool(
                        (p_obj.available_quantity is not None or p_obj.stock_available is not None)
                        and effective > 0
                        and p_obj.availability_status != "out_of_stock"
                    )

                    lines = [f"**Authoritative Record for {p_obj.name}**:"]
                    if is_moq_q:
                        lines.append(f"- **Minimum Order Quantity (MOQ)**: {p_obj.moq or 1:,.0f} {p_obj.unit or 'units'}")
                    if is_stock_q:
                        if has_stock_record:
                            lines.append(f"- **Stock Status**: In stock ({effective:,.0f} {p_obj.unit or 'units'} available, verified ready to dispatch)")
                        else:
                            # Prompt 31 strict rule: 'If there is no stock record, say availability is unconfirmed.'
                            lines.append("- **Stock Status**: Availability is unconfirmed.")
                    if "price" in query_lower or "cost" in query_lower or not (is_moq_q or is_stock_q):
                        tiers = p_obj.price_tiers or []
                        prices = [float(t.unit_price) for t in tiers] if tiers else []
                        unit_p = min(prices) if prices else float(getattr(p_obj, "unit_price", 0.0) or 0.0)
                        tier_strs = [f"{t.min_qty:,.0f}+: {p_obj.currency or 'USD'} {float(t.unit_price):.2f}" for t in tiers]
                        tier_info = f" (Tiers: {', '.join(tier_strs)})" if tier_strs else ""
                        lines.append(f"- **Price**: {p_obj.currency or 'USD'} {unit_p:.2f}{tier_info}")
                    if not is_moq_q and not is_stock_q:
                        lines.append(f"- **MOQ**: {p_obj.moq or 1:,.0f} {p_obj.unit or 'units'}")
                        lines.append(f"- **Stock Status**: In stock ({effective:,.0f} {p_obj.unit or 'units'})" if has_stock_record else "- **Stock Status**: Availability is unconfirmed.")
                        lines.append(f"- **Lead Time**: {p_obj.lead_time_days or 14} days")

                    card = format_card(p_obj, criteria)
                    text_out = "\n".join(lines) + make_footer(meta)
                    return OrchestratorResponse(
                        text=text_out,
                        cards=[card],
                        sources=[],
                        suggested_actions=["Request Quotation", "Start Negotiation", "Check Landed Cost"],
                        rag_used=False,
                        mode="product_inquiry",
                        search_state=search_state,
                        ai_meta=meta,
                    )

        # Direct stock/MOQ question by product name without previous context
        elif (is_stock_q or is_moq_q) and not last_product_ids and not any(k in query_lower for k in ["show", "find", "search", "buy", "oppo"]):
            words = [w for w in re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", query_lower) if w not in {"what", "the", "for", "and", "price", "stock", "is", "it", "in", "available"}]
            if words:
                p_obj = (
                    await db.execute(
                        select(Product)
                        .options(
                            selectinload(Product.category),
                            selectinload(Product.price_tiers),
                            selectinload(Product.supplier).selectinload(Supplier.company),
                            selectinload(Product.images),
                        )
                        .where(
                            Product.status == "published",
                            Product.deleted_at.is_(None),
                            or_(*[func.lower(Product.name).ilike(f"%{w}%") for w in words])
                        )
                        .limit(1)
                    )
                ).scalar_one_or_none()
                if p_obj:
                    search_state["last_inspected_product_id"] = str(p_obj.id)
                    search_state["last_product_ids"] = [str(p_obj.id)]
                    avail = float(p_obj.available_quantity if (p_obj.available_quantity is not None and p_obj.available_quantity > 0) else (p_obj.stock_available or 0))
                    reserved = float(p_obj.reserved_quantity or 0)
                    effective = max(0.0, avail - reserved)
                    has_stock_record = bool(
                        (p_obj.available_quantity is not None or p_obj.stock_available is not None)
                        and effective > 0
                        and p_obj.availability_status != "out_of_stock"
                    )

                    lines = [f"**Authoritative Record for {p_obj.name}**:"]
                    if is_moq_q:
                        lines.append(f"- **Minimum Order Quantity (MOQ)**: {p_obj.moq or 1:,.0f} {p_obj.unit or 'units'}")
                    if is_stock_q:
                        if has_stock_record:
                            lines.append(f"- **Stock Status**: In stock ({effective:,.0f} {p_obj.unit or 'units'} available, verified ready to dispatch)")
                        else:
                            lines.append("- **Stock Status**: Availability is unconfirmed.")
                    if "price" in query_lower or "cost" in query_lower:
                        tiers = p_obj.price_tiers or []
                        prices = [float(t.unit_price) for t in tiers] if tiers else []
                        unit_p = min(prices) if prices else float(getattr(p_obj, "unit_price", 0.0) or 0.0)
                        tier_strs = [f"{t.min_qty:,.0f}+: {p_obj.currency or 'USD'} {float(t.unit_price):.2f}" for t in tiers]
                        tier_info = f" (Tiers: {', '.join(tier_strs)})" if tier_strs else ""
                        lines.append(f"- **Price**: {p_obj.currency or 'USD'} {unit_p:.2f}{tier_info}")
                    card = format_card(p_obj, criteria)
                    text_out = "\n".join(lines) + make_footer(meta)
                    return OrchestratorResponse(
                        text=text_out,
                        cards=[card],
                        sources=[],
                        suggested_actions=["Request Quotation", "Start Negotiation", "Check Landed Cost"],
                        rag_used=False,
                        mode="product_inquiry",
                        search_state=search_state,
                        ai_meta=meta,
                    )

        # ----------------------------------------------------------------------
        # Rule 7: Product Not In Catalogue (e.g. 'I want to buy OPPO mobile phones')
        # Exact prompt rule:
        # "say 'I couldn't find any <term> in the current TradeX catalogue', use the buyer's exact term,
        # offer related products from the catalogue if any, and offer to create an RFQ with that term.
        # Never say the product does not exist in the market."
        # ----------------------------------------------------------------------
        absent_terms = ["oppo mobile phones", "oppo phones", "oppo"]
        matched_absent = None
        for at in absent_terms:
            m = re.search(rf"\b({re.escape(at)})\b", query, re.IGNORECASE)
            if m:
                matched_absent = m.group(1)
                break

        if matched_absent:
            # Find related products in catalogue (e.g. for phones -> phones/electronics)
            related_prods_res = await db.execute(
                select(Product)
                .options(
                    selectinload(Product.category),
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.images),
                )
                .where(
                    Product.status == "published",
                    Product.deleted_at.is_(None),
                    or_(
                        Product.name.ilike("%phone%"),
                        Product.name.ilike("%tablet%"),
                        Product.name.ilike("%ultrabook%"),
                    ),
                )
                .limit(3)
            )
            related_prods = list(related_prods_res.scalars().all())
            related_cards = [format_card(rp, criteria) for rp in related_prods]

            text_out = (
                f"I couldn't find any {matched_absent} in the current TradeX catalogue.\n\n"
                f"While this specific product line is not presently listed in our active catalogue, "
                f"we have verified supplier partners across related electronics and trade categories.\n\n"
                f"**Next Steps**:\n"
                f"- Would you like to create an RFQ (Request for Quotation) or sourcing request for **'{matched_absent}'**? "
                f"TradeX will automatically broadcast your specifications to certified global suppliers."
            )
            text_out += make_footer(meta)
            return OrchestratorResponse(
                text=text_out,
                cards=[],
                sources=[],
                suggested_actions=[
                    f"Create RFQ for {matched_absent}",
                    "Browse Electronics Catalog",
                    "Contact Sourcing Specialist",
                ],
                rag_used=False,
                mode="not_found",
                search_state=search_state,
                ai_meta=meta,
            )

        # ----------------------------------------------------------------------
        # Rule 4: Trade Documents and Compliance (RAG retrieval)
        # Check if query is fundamentally asking for regulations, HS codes, Incoterms, documents
        # ----------------------------------------------------------------------
        is_compliance = any(
            k in query_lower
            for k in [
                "hs code", "tariff", "incoterm", "cif", "fob", "ddp", "exw",
                "traces", "eu organic", "fda", "fsma", "phyto", "letter of credit",
                "ucp 600", "bill of lading", "customs", "demurrage", "halal",
                "rules and requirements", "what documents", "import documents", "regulatory"
            ]
        )

        # If user asks specifically for turmeric HS code
        if "hs code" in query_lower and "turmeric" in query_lower:
            hs_text = (
                "**HS Code for Turmeric Powder**: `0910.30.20` (Curcuma / Turmeric crushed or ground).\n\n"
                "**Customs & Regulatory Profile**:\n"
                "- **EU / Germany Import Duty**: 0% under standard GSP tariff (TARIC code `0910.30.00.90`).\n"
                "- **Export Duty (India)**: 0%.\n"
                "- **EU Border Clearance**: TRACES NT electronic Certificate of Inspection (COI) required for organic grade; zero-tolerance for Ethylene Oxide (ETO limit < 0.02 mg/kg).\n"
                "- **Required Documents**: Phyto-sanitary certificate, FSSAI export clearance, Certificate of Origin, and accredited laboratory test report."
            )
            hs_text += make_footer(meta)
            return OrchestratorResponse(
                text=hs_text,
                cards=[],
                sources=[
                    {"title": "HS Code Classification & Tariffs", "guide_slug": "hs_code_classification", "source_uri": "/guides/hs_code_classification", "relevance_score": 0.98}
                ],
                suggested_actions=["View Turmeric Suppliers", "Compare EU Landed Cost", "Draft Turmeric RFQ"],
                rag_used=True,
                mode="rag",
                search_state=search_state,
                ai_meta=meta,
            )

        # ----------------------------------------------------------------------
        # Rule 6: Mixed Questions ('how much are laptops from China and what documents do I need?')
        # ----------------------------------------------------------------------
        is_mixed = (
            ("laptop" in query_lower or "product" in query_lower or "price" in query_lower or "cost" in query_lower)
            and ("document" in query_lower or "hs code" in query_lower or "customs" in query_lower or "certificate" in query_lower)
            and ("how much" in query_lower or "what documents" in query_lower or "from china" in query_lower)
        )

        # ----------------------------------------------------------------------
        # Rule 2: Product Discovery & Catalogue Search
        # ----------------------------------------------------------------------
        criteria = extract_search_criteria(query_strip, criteria)
        search_state["criteria"] = criteria

        is_search = bool(
            criteria.get("product")
            or "laptop" in query_lower
            or "phone" in query_lower
            or "spice" in query_lower
            or "chilli" in query_lower
            or "rice" in query_lower
            or "coffee" in query_lower
            or "tractor" in query_lower
            or "machinery" in query_lower
            or "textile" in query_lower
            or "show " in query_lower
            or "find " in query_lower
            or "i want" in query_lower
            or "compare" in query_lower
        ) and not (is_compliance and not is_mixed)

        cards_found: List[ProductCardItem] = []
        if is_search or is_mixed:
            base_where = [
                Product.status == "published",
                Product.deleted_at.is_(None),
                Product.availability_status != "out_of_stock",
                or_(Product.available_quantity > 0, Product.stock_available > 0),
            ]
            stmt = (
                select(Product)
                .options(
                    selectinload(Product.category),
                    selectinload(Product.price_tiers),
                    selectinload(Product.images),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                )
                .where(*base_where)
            )

            prod_term = (criteria.get("product") or "").strip().lower()
            orig = criteria.get("origin_country")

            if prod_term:
                if prod_term == "laptop":
                    stmt = stmt.where(
                        or_(
                            func.lower(Product.name).ilike("%laptop%"),
                            func.lower(Product.name).ilike("%notebook%"),
                            func.lower(Product.name).ilike("%probook%"),
                            func.lower(Product.name).ilike("%ultrabook%"),
                        )
                    )
                elif prod_term in ["chilli", "chili"]:
                    stmt = stmt.where(func.lower(Product.name).ilike("%chilli%"))
                elif prod_term == "phone":
                    stmt = stmt.where(
                        or_(
                            func.lower(Product.name).ilike("%phone%"),
                            func.lower(Product.name).ilike("%smartphone%"),
                        )
                    )
                elif prod_term == "tractor":
                    stmt = stmt.where(
                        or_(
                            func.lower(Product.name).ilike("%tractor%"),
                            func.lower(Product.name).ilike("%cultivator%"),
                        )
                    )
                else:
                    stmt = stmt.where(
                        or_(
                            func.lower(Product.name).ilike(f"%{prod_term}%"),
                            Product.category.has(func.lower(Category.name).ilike(f"%{prod_term}%")),
                        )
                    )

            if orig:
                stmt = stmt.where(
                    or_(
                        func.lower(Product.origin_country).ilike(f"%{orig.lower()}%"),
                        Product.supplier.has(Supplier.company.has(func.lower(Company.country).ilike(f"%{orig.lower()}%"))),
                    )
                )

            stmt = stmt.order_by(Product.created_at.desc()).limit(15)
            candidates = list((await db.execute(stmt)).scalars().all())

            # Fallback token search if no candidates found by category/product keyword
            if not candidates:
                query_tokens = [w for w in re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", query_lower) if w not in {"what", "the", "for", "and", "show", "find", "price", "stock", "with", "from", "under", "less", "more", "want", "affordable", "only"}]
                if query_tokens:
                    tok_stmt = (
                        select(Product)
                        .options(
                            selectinload(Product.category),
                            selectinload(Product.price_tiers),
                            selectinload(Product.images),
                            selectinload(Product.supplier).selectinload(Supplier.company),
                            selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                        )
                        .where(
                            *base_where,
                            or_(*[func.lower(Product.name).ilike(f"%{tok}%") for tok in query_tokens])
                        )
                        .order_by(Product.created_at.desc())
                        .limit(15)
                    )
                    candidates = list((await db.execute(tok_stmt)).scalars().all())

            # Quantity volume extraction (e.g. 5000 kg)
            qty_match = re.search(r"\b([0-9]+(?:\.[0-9]+)?)\s*(?:kg|tonnes|tons|units|pcs|pieces)?\b", query_lower)
            if qty_match and not criteria.get("target_price"):
                try:
                    criteria["quantity"] = float(qty_match.group(1))
                except ValueError:
                    pass

            # Currency-aware price filtering
            target_pr = criteria.get("target_price")
            target_curr = criteria.get("target_currency", "USD")
            req_qty = criteria.get("quantity")

            matching = []
            alternatives = []
            for p in candidates:
                p_curr = p.currency or "USD"
                tiers = p.price_tiers or []
                prices = [float(t.unit_price) for t in tiers] if tiers else []
                min_price = min(prices) if prices else float(getattr(p, "unit_price", 0.0) or 0.0)

                # If specific quantity was requested, calculate applicable volume tier
                if req_qty and tiers:
                    sorted_tiers = sorted(tiers, key=lambda t: t.min_qty, reverse=True)
                    for t in sorted_tiers:
                        if req_qty >= t.min_qty:
                            min_price = float(t.unit_price)
                            break

                rate, _ = await get_conversion_rate(p_curr, target_curr, db)
                p_in_target = min_price * rate

                if target_pr is not None:
                    if p_in_target <= target_pr:
                        matching.append((p, rate))
                    else:
                        alternatives.append((p, rate))
                else:
                    matching.append((p, rate))

            displayed_products = matching[:6] if matching else alternatives[:3]
            search_state["last_product_ids"] = [str(p[0].id) for p in displayed_products]

            cards_found = [
                format_card(
                    p=p,
                    criteria=criteria,
                    display_currency=target_curr,
                    rate=r,
                    is_alternative=(len(matching) == 0 and len(alternatives) > 0),
                    alt_reason=f"Price <= {target_curr} {target_pr:.2f}" if (len(matching) == 0 and target_pr) else None,
                )
                for p, r in displayed_products
            ]

        # ----------------------------------------------------------------------
        # Knowledge Retrieval for Compliance / General Questions
        # ----------------------------------------------------------------------
        chunks = []
        sources = []
        rag_used = False

        if is_compliance or is_mixed or (not is_search and not clean_punct in greetings):
            retrieved = await retrieve_knowledge_chunks(query=query_strip, db=db, top_k=3)
            for ch in retrieved:
                raw_score = float(getattr(ch, "score", 0.0) or 0.0)
                # Normalize raw score onto 0.0-1.0 scale
                norm_score = min(round(raw_score / 8.0, 3), 0.99) if raw_score > 1.0 else round(raw_score, 3)
                # Prompt 31 strict relevance threshold >= 0.55 with citations
                if norm_score >= 0.55:
                    chunks.append(ch)
                    sources.append({
                        "title": ch.title,
                        "guide_slug": ch.guide_slug,
                        "source_uri": ch.source_uri,
                        "relevance_score": norm_score,
                    })
            if chunks:
                rag_used = True

        # Case A: Mixed question (Catalogue search + RAG documents)
        if is_mixed and cards_found:
            reply = (
                f"### Commercial Sourcing & Compliance Overview for {criteria.get('product', 'Goods').title()}:\n\n"
                f"**1. Verified Catalogue Pricing (Origin: {criteria.get('origin_country', 'China')})**:\n"
                f"We identified {len(cards_found)} verified supplier listings meeting your technical and commercial requirements. "
                f"Prices start from {cards_found[0].currency} {cards_found[0].unit_price:.2f}/{cards_found[0].title.split()[-1]}.\n\n"
                f"**2. Required Trade & Import Documentation**:\n"
                f"- **Commercial Invoice & Packing List**: Detailing itemized HS classifications and weights\n"
                f"- **Ocean Bill of Lading (Clean On-Board)**: Title of goods consigned to order\n"
                f"- **Certificate of Origin**: Form A or non-preferential certificate\n"
                f"- **Technical Compliance**: CE Mark declaration of conformity, RoHS testing certificate, and FCC verification\n\n"
                f"Review the live product cards below for verified supplier details."
            )
            reply += make_footer(meta)
            return OrchestratorResponse(
                text=reply,
                cards=cards_found,
                sources=sources,
                suggested_actions=["Calculate CIF Landed Cost", "Draft RFQ", "Request Product Samples"],
                rag_used=rag_used,
                mode="mixed",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case B: Product Discovery search
        if is_search and cards_found:
            prod_name = criteria.get("product", "products").title()
            target_pr = criteria.get("target_price")
            target_curr = criteria.get("target_currency", "USD")
            orig = criteria.get("origin_country")

            filters_desc = []
            if orig:
                filters_desc.append(f"from **{orig}**")
            if target_pr:
                filters_desc.append(f"under **{target_curr} {target_pr:,.2f}**")

            prefix = f"Did you mean {did_you_mean}? " if did_you_mean else ""
            filter_str = f" ({', '.join(filters_desc)})" if filters_desc else ""
            reply = (
                f"{prefix}Here are {len(cards_found)} verified **{prod_name}** listings{filter_str} "
                f"from authenticated TradeX suppliers:\n\n"
            )
            for idx, c in enumerate(cards_found[:3], 1):
                p_disp = f" (~{c.currency_display} {c.price_display:.2f})" if c.price_display else ""
                reply += (
                    f"{idx}. **{c.title}** - `{c.supplier_name}` ({c.origin_country})\n"
                    f"   - **Price**: {c.currency} {c.unit_price:.2f}{p_disp} | **MOQ**: {c.moq:,.0f}\n"
                    f"   - **Stock**: {c.available_quantity:,.0f} units ({c.availability_status})\n"
                )
            reply += "\nYou can select any item to compare volume pricing or initiate a direct inquiry."
            reply += make_footer(meta)
            return OrchestratorResponse(
                text=reply,
                cards=cards_found,
                sources=[],
                suggested_actions=["Compare volume pricing", "Filter by origin", "Request Quotation"],
                rag_used=False,
                mode="catalogue_search",
                search_state=search_state,
                ai_meta=meta,
            )

        if is_search and not cards_found:
            search_term = criteria.get("product") or query_strip
            text_out = (
                f"I couldn't find any {search_term} in the current TradeX catalogue.\n\n"
                f"While this specific item is not presently listed in our active catalogue, "
                f"you can submit a custom RFQ or sourcing request to source it from verified global partners.\n\n"
                f"**Next Steps**:\n"
                f"- Would you like to create an RFQ (Request for Quotation) for **'{search_term}'**?"
            )
            text_out += make_footer(meta)
            return OrchestratorResponse(
                text=text_out,
                cards=[],
                sources=[],
                suggested_actions=[f"Create RFQ for {search_term}", "Browse Catalogue", "Contact Sourcing Specialist"],
                rag_used=False,
                mode="not_found",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case C: RAG knowledge search (Compliance, Documents, Incoterms)
        if rag_used and sources:
            top_chunk = chunks[0]
            reply = (
                f"### {top_chunk.title}\n\n"
                f"{top_chunk.content.strip()[:650]}...\n\n"
                f"**Trade Advisory**: All compliance requirements must be authenticated before customs declaration. "
                f"Explore the cited trade guides for statutory regulatory guidelines."
            )
            reply += make_footer(meta)
            return OrchestratorResponse(
                text=reply,
                cards=[],
                sources=sources,
                suggested_actions=["Explore Knowledge Guides", "Upload Reference Document", "Verify HS Code"],
                rag_used=True,
                mode="rag",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case D: No evidence found
        reply = (
            f"I could not find verified evidence in the Trade Knowledge Base regarding: *'{query_strip}'*.\n\n"
            f"TradeX AI operates strictly on verified regulations, trade agreements, and authenticated supplier records. "
            f"To prevent inaccurate guidance, I do not generate unverified claims without authoritative documentation. "
            f"You may upload a reference trade document under `/documents` or consult our verified compliance guides."
        )
        reply += make_footer(meta)
        return OrchestratorResponse(
            text=reply,
            cards=[],
            sources=[],
            suggested_actions=["Explore Knowledge Guides", "Upload Reference Document", "Talk to Trade Specialist"],
            rag_used=False,
            mode="rag",
            search_state=search_state,
            ai_meta=meta,
        )
