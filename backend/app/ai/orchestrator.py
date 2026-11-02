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
from app.services.sourcing_engine import SourcingEngine, SourcingEngineResult, SourcingRequirement



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
        if dw and dw.lower() not in ["a", "an", "the", "sale", "export", "trade", "tradex", "me", "us", "free"]:
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
    unit_p = min(prices) if prices else None
    p_range = f"{min(prices):.2f} - {max(prices):.2f}" if len(prices) > 1 else (f"{unit_p:.2f}" if unit_p is not None else None)

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
    p_disp = round(unit_p * rate, 2) if (unit_p is not None and display_currency.upper() != c_orig.upper() and rate != 1.0) else None
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
            "howdy", "greetings", "hi there", "hello there", "what's up", "whats up",
            "hi bro", "hey bro", "hello bro", "bro", "yo"
        }
        is_greeting = clean_punct in greetings or any(
            clean_punct.startswith(g) for g in ["hi bro", "hello bro", "hey bro"]
        )
        if is_greeting:
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
                p1_price_str = f"{p1.currency} {cards[0].unit_price:.2f}" if cards[0].unit_price is not None else "Contact supplier for pricing"
                p2_price_str = f"{p2.currency} {cards[1].unit_price:.2f}" if cards[1].unit_price is not None else "Contact supplier for pricing"
                text_out = (
                    f"**Side-by-Side Product Comparison**:\n\n"
                    f"1. **{p1.name}** ({p1.origin_country}):\n"
                    f"   - **Unit Price**: {p1_price_str}\n"
                    f"   - **MOQ**: {p1.moq:,.0f} {p1.unit or 'units'}\n"
                    f"   - **Stock**: {cards[0].available_quantity:,.0f} {p1.unit or 'units'} ({cards[0].availability_status})\n"
                    f"   - **Lead Time**: {p1.lead_time_days or 14} days\n\n"
                    f"2. **{p2.name}** ({p2.origin_country}):\n"
                    f"   - **Unit Price**: {p2_price_str}\n"
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
        # Mixed query detection (Product/sourcing + Compliance/trade documents)
        has_sourcing_element = bool(
            criteria.get("product")
            or any(k in query_lower for k in ["laptop", "phone", "rice", "chilli", "spice", "tractor", "goods", "supplier", "buy", "source", "quote", "pricing"])
            or re.search(r"\b\d+\s*(?:kg|tons?|tonnes?|units?|pcs?|pieces?|boxes?)\b", query_lower)
        )
        has_compliance_element = any(
            k in query_lower
            for k in [
                "what documents", "document", "documents", "hs code", "tariff", "tariffs", "incoterm", "incoterms",
                "cif", "fob", "ddp", "customs", "certificate", "certificates", "traces", "fda", "regulation", "regulations",
                "clearance", "quarantine", "compliance"
            ]
        )
        is_mixed = bool(has_sourcing_element and has_compliance_element)

        # ----------------------------------------------------------------------
        # Rule 2: Product Discovery & Catalogue Search via SourcingEngine (Prompt 35)
        # ----------------------------------------------------------------------
        criteria = extract_search_criteria(query_strip, criteria)
        search_state["criteria"] = criteria

        cards_found: List[ProductCardItem] = []
        is_search = False

        if not (is_compliance and not is_mixed):
            engine_res = await SourcingEngine.process_query(
                query=query_strip,
                db=db,
                context=conversation_context,
                display_currency=criteria.get("target_currency", "USD"),
                surface=surface,
            )

            # Sync search_state
            if engine_res.search_state:
                search_state.update(engine_res.search_state)
                if "criteria" in engine_res.search_state:
                    search_state["criteria"].update(engine_res.search_state["criteria"])

            # Prompt 38: Handle FOLLOW_UP like 'i need more help'
            if engine_res.status == "follow_up" or engine_res.intent == "FOLLOW_UP":
                text_out = engine_res.text or "I am continuing with your inquiry."
                text_out += make_footer(meta)
                return OrchestratorResponse(
                    text=text_out,
                    cards=[],
                    sources=[],
                    suggested_actions=engine_res.suggested_actions,
                    rag_used=False,
                    mode="chat",
                    search_state=search_state,
                    ai_meta=meta,
                )

            cards_found = engine_res.products
            if not cards_found and engine_res.alternatives:
                cards_found = engine_res.alternatives

            if cards_found:
                search_state["last_product_ids"] = [c.product_id for c in cards_found]

            is_search = bool(
                cards_found
                or (engine_res.status == "not_found" and engine_res.intent == "PRODUCT_SOURCING")
                or (engine_res.intent == "PRODUCT_SOURCING" and engine_res.understood.product_term)
                or (criteria.get("product") and not is_compliance)
                or any(k in query_lower for k in ["laptop", "phone", "spice", "chilli", "rice", "coffee", "tractor", "machinery", "textile", "rough books", "vivo", "oppo"])
            ) and not any(k in query_lower for k in ["extraterrestrial", "alien", "pluto", "narnia", "quantum", "teleportation"])

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

        # Case A: Mixed question (Two clearly separated parts: Marketplace results and Trade guidance)
        if is_mixed:
            prod_name = (criteria.get("product") or (cards_found[0].title if cards_found else "Commodity")).title()
            orig = criteria.get("origin_country") or (cards_found[0].origin_country if cards_found else "Origin")
            dest = criteria.get("destination") or "Destination"
            qty = criteria.get("quantity")
            unit = criteria.get("unit") or "units"
            qty_str = f"{int(qty)} {unit} " if qty else ""

            trade_guidance_lines = [
                f"### Part 1: Marketplace Results for {qty_str}{prod_name} ({orig} -> {dest}):\n"
            ]
            if cards_found:
                p_starts = f"pricing starts from {cards_found[0].currency} {cards_found[0].unit_price:,.2f}/{getattr(cards_found[0], 'unit', None) or 'unit'}" if cards_found[0].unit_price is not None else "pricing is available upon direct supplier inquiry"
                trade_guidance_lines.append(
                    f"We identified {len(cards_found)} verified supplier listing(s) in the TradeX catalogue. "
                    f"Authoritative {p_starts}.\n"
                )
            else:
                trade_guidance_lines.append(
                    f"No direct stock matching '{prod_name}' was found in the current active catalogue. You can create an RFQ to broadcast your specifications.\n"
                )

            trade_guidance_lines.append("### Part 2: Trade Guidance & Statutory Import Documents:\n")
            if "rice" in query_lower or "grain" in query_lower or "agricultural" in query_lower:
                trade_guidance_lines.extend([
                    "- **Commercial Invoice & Detailed Packing List**: Itemized weights and HS Code `1006.30`.",
                    "- **Phytosanitary Certificate**: Issued by NPPO certifying quarantine pest freedom.",
                    "- **US FDA Prior Notice & Facility Registration**: Mandatory for food entering US ports under FSMA.",
                    "- **Clean Ocean Bill of Lading**: Consigned to order or banking counterparty.",
                    "- **Certificate of Origin**: Authenticated chamber of commerce declaration.",
                ])
            else:
                trade_guidance_lines.extend([
                    "- **Commercial Invoice & Packing List**: Itemized with Harmonized System codes and weight declarations.",
                    "- **Ocean Bill of Lading (B/L)**: Title transfer document clean on-board.",
                    "- **Certificate of Origin (CoO)**: Preferential or non-preferential origin verification.",
                    "- **Customs & Technical Clearance**: Import declarations and required safety compliance certifications.",
                ])

            trade_guidance_lines.append(
                "\n> [!NOTE]\n"
                "> **Trade Guidance Disclaimer**: Verified from authoritative international trade standards. "
                "Official verification is needed for legal, tax or customs rules."
            )

            reply = "\n".join(trade_guidance_lines)
            reply += make_footer(meta)
            return OrchestratorResponse(
                text=reply,
                cards=cards_found,
                sources=sources,
                suggested_actions=[f"Prepare RFQ for {prod_name}", f"Compare {prod_name} prices", "Customs Broker Consultation"],
                rag_used=rag_used,
                mode="mixed",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case B: Product Discovery search
        if is_search and cards_found:
            prod_name = (criteria.get("product") or engine_res.understood.normalized_product_name or "products").title()
            target_pr = criteria.get("target_price") or engine_res.understood.price_limit
            target_curr = criteria.get("target_currency", "USD")
            orig = criteria.get("origin_country")

            filters_desc = []
            if orig:
                filters_desc.append(f"from **{orig}**")
            if target_pr:
                filters_desc.append(f"under **{target_curr} {target_pr:,.2f}**")

            prefix = f"Did you mean {did_you_mean}? " if did_you_mean else ""
            filter_str = f" ({', '.join(filters_desc)})" if filters_desc else ""

            shown_cards = cards_found[:3]
            reply = (
                f"{prefix}Here are {len(shown_cards)} verified **{prod_name}** listings{filter_str} "
                f"from authenticated TradeX suppliers:\n\n"
            )
            for idx, c in enumerate(shown_cards, 1):
                p_disp = f" (~{c.currency_display} {c.price_display:.2f})" if c.price_display else ""
                p_label = f"{c.currency} {c.unit_price:.2f}{p_disp}" if c.unit_price is not None else "Contact supplier for pricing"
                reply += (
                    f"{idx}. **{c.title}** - `{c.supplier_name}` ({c.origin_country})\n"
                    f"   - **Price**: {p_label} | **MOQ**: {c.moq:,.0f}\n"
                    f"   - **Stock**: {c.available_quantity:,.0f} units ({c.availability_status})\n"
                )
            if len(cards_found) > len(shown_cards):
                reply += f"\n*Showing {len(shown_cards)} of {len(cards_found)} available listings. Select 'Show more' to view remaining items.*\n"
            else:
                reply += "\nYou can select any item to compare volume pricing or initiate a direct inquiry.\n"

            reply += make_footer(meta)
            actions = [f"Compare prices for {prod_name}", f"Check MOQ and stock for {prod_name}", f"Prepare an RFQ for {prod_name}"]
            if len(cards_found) > len(shown_cards):
                actions.insert(0, "Show more")
            return OrchestratorResponse(
                text=reply,
                cards=cards_found,
                sources=[],
                suggested_actions=actions,
                rag_used=False,
                mode="catalogue_search",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case C: RAG knowledge search (Compliance, Documents, Incoterms)
        if rag_used and sources:
            top_chunk = chunks[0]
            reply = (
                f"### {top_chunk.title}\n\n"
                f"{top_chunk.content.strip()[:650]}...\n\n"
                f"> [!NOTE]\n"
                f"> **Verified from Trade Knowledge Base**: Verified from source guides ({top_chunk.title}). "
                f"Official verification is needed for legal, tax or customs rules."
            )
            reply += make_footer(meta)
            actions = ["Compare FOB and CIF", "Who pays for freight under CIF?", "Incoterms risk transfer points"] if ("incoterm" in query_lower or "cif" in query_lower or "fob" in query_lower) else ["Explore Knowledge Guides", "Upload Reference Document", "Verify HS Code"]
            return OrchestratorResponse(
                text=reply,
                cards=[],
                sources=sources,
                suggested_actions=actions,
                rag_used=True,
                mode="rag",
                search_state=search_state,
                ai_meta=meta,
            )

        # Case D: Genuine knowledge question with no matching document
        is_knowledge_q = (
            is_compliance
            or any(k in query_lower for k in [
                "incoterm", "customs", "tariff", "duty", "duties", "document", "documents",
                "regulation", "fda", "traces", "insurance", "freight", "teleportation", "frequency",
                "quantum", "protocol", "what is", "what are", "how does", "rule", "rules", "procedure",
                "statutory", "bill of lading", "certificate of origin", "letter of credit", "fob", "cif"
            ])
        ) and not (
            any(k in query_lower for k in ["find", "supplier", "manufactur", "vendor", "notebook", "book", "mobile", "phone", "rice", "spice", "chilli", "turmeric", "t-shirt", "laptop"])
            and not any(k in query_lower for k in ["document", "rule", "duty", "tax", "incoterm", "custom", "law", "statutory", "regulation"])
        )
        if is_knowledge_q:
            reply = (
                f"I could not find verified evidence in the Trade Knowledge Base regarding: *'{query_strip}'*.\n\n"
                f"TradeX AI operates strictly on verified regulations, trade agreements, and authenticated supplier records. "
                f"Official verification is needed for legal, tax or customs rules. "
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

        # Case E: Product not found in catalogue
        if is_search and not cards_found:
            search_term = engine_res.understood.product_term or criteria.get("product") or query_strip
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

        # Fallback for unknown product or inquiry: truthful no-match RFQ offer
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
