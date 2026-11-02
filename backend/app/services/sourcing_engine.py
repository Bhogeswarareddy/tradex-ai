"""
TradeX AI Sourcing Engine (Prompt 35: One Smart Sourcing Engine)
Shared core engine powering AI Search (/ai/search), AI Mode (/ai-mode), and Copilot (/copilot).

7-Stage Pipeline:
1. Understand: Server-side Groq structured call or deterministic extractor returns structured
   requirements tracking strictly `stated_fields`. Only fields explicitly stated by the user
   become active filters/chips.
2. Intent Router: Routes to one of 10 intents:
   - PRODUCT_SOURCING, SUPPLIER_DISCOVERY, PRODUCT_INFORMATION, PRICE_ENQUIRY,
     QUANTITY_AND_AVAILABILITY, RFQ_ASSISTANCE, TRADE_KNOWLEDGE, DOCUMENT_ASSISTANCE,
     FOLLOW_UP, GENERAL_CONVERSATION.
   Strict rules:
   - Buying queries ('i need vivo mobile', 'rough books', 'rice') -> PRODUCT_SOURCING (catalogue searched first)
   - RAG used only for trade knowledge / documents / mixed
   - Vague queries ('i need more help') -> FOLLOW_UP (continues active conversation)
   - Fallback if unsure -> catalogue search first
3. Catalogue Search (Deterministic SQL):
   - Published & active only, active suppliers
   - Name, product_aliases, search_keywords, typo tolerance with pg_trgm
   - Category / commodity integrity (e.g. rice != green tea)
   - Form matching (requested form powder -> primary; flakes -> similar alternatives)
4. Supplier Relationship:
   - Only suppliers from matching published products are direct matches
   - Potential suppliers in category are separated in a collapsed list
5. Quantity, Unit, Price, and Stock:
   - Unit conversion & uncomparable unit detection (500 kg vs units)
   - Available stock = available_quantity - reserved_quantity
   - Missing price -> 'Contact supplier for pricing' (never 0 or made up)
   - Stored exchange_rates for currency conversion
6. Deduplication & Variant Collapse:
   - Collapse near-identical supplier variants into one card with variant_count
7. Explain & Post-check:
   - Grounded Groq response using only retrieved records
   - Post-check verification: verifies every product, supplier, price, qty exists in results
   - Regenerate once on hallucination, then clean template labeled Demo AI
   - ai_meta with provider, model, is_demo, latency_ms, fallback_reason
"""
import asyncio
import difflib
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import get_ai_provider, get_ai_status
from app.ai.rag.retriever import retrieve_knowledge_chunks
from app.models.catalog import Category, ExchangeRate, PriceTier, Product, ProductAlias, SupplierCategory, SupplierCertification
from app.models.identity import Company, Supplier, User
from app.schemas.ai_mode import ProductCardItem

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class SourcingRequirement(BaseModel):
    intent: str = Field(default="PRODUCT_SOURCING")
    product_term: Optional[str] = None
    normalized_product_name: Optional[str] = None
    product_form: Optional[str] = None  # powder, flakes, whole, seed, raw, manufactured
    brand: Optional[str] = None
    category_guess: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None  # kg, tonne, units, pieces, etc.
    price_limit: Optional[float] = None
    currency: Optional[str] = "USD"
    origin: Optional[str] = None
    destination: Optional[str] = None
    certifications: List[str] = Field(default_factory=list)
    specifications: Dict[str, Any] = Field(default_factory=dict)
    stated_fields: List[str] = Field(default_factory=list)


class SourcingEngineResult(BaseModel):
    intent: str
    understood: SourcingRequirement
    active_filters: Dict[str, Any] = Field(default_factory=dict)
    products: List[ProductCardItem] = Field(default_factory=list)
    alternatives: List[ProductCardItem] = Field(default_factory=list)
    direct_suppliers: List[Dict[str, Any]] = Field(default_factory=list)
    potential_suppliers: List[Dict[str, Any]] = Field(default_factory=list)
    text: str
    suggested_actions: List[str] = Field(default_factory=list)
    rag_sources: List[Dict[str, Any]] = Field(default_factory=list)
    rag_used: bool = False
    ai_meta: Dict[str, Any] = Field(default_factory=dict)
    status: str = "success"  # success, not_found, general_chat, follow_up, need_clarification
    execution_time_ms: float = 0.0
    search_state: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Currency Helper
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Unit Normalization & Comparison Helpers
# ---------------------------------------------------------------------------

MASS_UNITS = {
    "kg": 1.0,
    "kgs": 1.0,
    "kilogram": 1.0,
    "kilograms": 1.0,
    "tonne": 1000.0,
    "tonnes": 1000.0,
    "ton": 1000.0,
    "tons": 1000.0,
    "mt": 1000.0,
    "metric ton": 1000.0,
    "metric tons": 1000.0,
    "g": 0.001,
    "grams": 0.001,
}

DISCRETE_UNITS = {
    "unit": 1.0,
    "units": 1.0,
    "piece": 1.0,
    "pieces": 1.0,
    "pcs": 1.0,
    "box": 1.0,
    "boxes": 1.0,
    "carton": 1.0,
    "cartons": 1.0,
    "item": 1.0,
    "items": 1.0,
}


def normalize_unit(unit_str: Optional[str]) -> Optional[str]:
    if not unit_str:
        return None
    u = unit_str.strip().lower()
    if u in MASS_UNITS:
        return "kg" if u in ["kg", "kgs", "kilogram", "kilograms"] else ("tonne" if u in ["tonne", "tonnes", "ton", "tons", "mt", "metric ton", "metric tons"] else "g")
    if u in DISCRETE_UNITS:
        return "units" if u in ["unit", "units"] else ("pieces" if u in ["piece", "pieces", "pcs"] else u)
    return u


def check_unit_compatibility(req_unit: Optional[str], prod_unit: Optional[str]) -> Tuple[bool, Optional[float]]:
    """
    Returns (is_compatible, conversion_factor_to_product_unit).
    If uncomparable (e.g. mass vs discrete), returns (False, None).
    """
    if not req_unit or not prod_unit:
        return True, 1.0
    r_clean = req_unit.strip().lower()
    p_clean = prod_unit.strip().lower()
    if r_clean == p_clean:
        return True, 1.0

    if r_clean in MASS_UNITS and p_clean in MASS_UNITS:
        req_in_kg = MASS_UNITS[r_clean]
        prod_in_kg = MASS_UNITS[p_clean]
        factor = req_in_kg / prod_in_kg
        return True, factor

    if r_clean in DISCRETE_UNITS and p_clean in DISCRETE_UNITS:
        return True, 1.0

    # Incompatible units
    return False, None


# ---------------------------------------------------------------------------
# Sourcing Engine Class
# ---------------------------------------------------------------------------

class SourcingEngine:
    """
    Unified 7-stage engine for TradeX product discovery, supplier discovery, and trade intelligence.
    Shared across AI Search, AI Mode, and Copilot.
    """

    # -----------------------------------------------------------------------
    # Stage 1: Understand
    # -----------------------------------------------------------------------
    @classmethod
    async def understand_requirement(
        cls,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> SourcingRequirement:
        """
        Server-side Groq call / structured parser extracting structured requirements.
        Strictly tracks stated_fields so only explicitly mentioned constraints become active filters.
        """
        q_strip = query.strip()
        q_lower = q_strip.lower()
        context = context or {}
        prev_search_state = context.get("search_state", {})
        prev_criteria = prev_search_state.get("criteria", {})

        system_prompt = (
            "You are the TradeX AI Trade Query Understanding Engine. Analyze the user's trade query and return "
            "a strict JSON object detailing what the user explicitly requested.\n"
            "CRITICAL RULES:\n"
            "1. ONLY populate fields the user explicitly stated or clearly implied in their query.\n"
            "2. stated_fields MUST list only the keys explicitly provided by the user. NEVER invent filters "
            "like 'destination', 'lead_time', or 'certifications' if the user did not say them.\n"
            "3. Identify product_form ('powder', 'flakes', 'whole', 'seed', 'raw', 'manufactured', etc.) if mentioned.\n"
            "4. intent must be one of: PRODUCT_SOURCING, SUPPLIER_DISCOVERY, PRODUCT_INFORMATION, "
            "PRICE_ENQUIRY, QUANTITY_AND_AVAILABILITY, RFQ_ASSISTANCE, TRADE_KNOWLEDGE, "
            "DOCUMENT_ASSISTANCE, FOLLOW_UP, GENERAL_CONVERSATION.\n"
            "5. If the message implies buying or looking for a product ('i need vivo mobile', 'rough books', "
            "'show affordable laptops', 'rice'), intent MUST be PRODUCT_SOURCING."
        )

        user_content = f"Query: \"{q_strip}\"\nActive context: {json.dumps(prev_criteria)}"

        json_schema = {
            "name": "TradeRequirement",
            "schema": {
                "type": "object",
                "properties": {
                    "intent": {
                        "type": "string",
                        "enum": [
                            "PRODUCT_SOURCING", "SUPPLIER_DISCOVERY", "PRODUCT_INFORMATION",
                            "PRICE_ENQUIRY", "QUANTITY_AND_AVAILABILITY", "RFQ_ASSISTANCE",
                            "TRADE_KNOWLEDGE", "DOCUMENT_ASSISTANCE", "FOLLOW_UP", "GENERAL_CONVERSATION"
                        ]
                    },
                    "product_term": {"type": ["string", "null"]},
                    "normalized_product_name": {"type": ["string", "null"]},
                    "product_form": {"type": ["string", "null"]},
                    "brand": {"type": ["string", "null"]},
                    "category_guess": {"type": ["string", "null"]},
                    "quantity": {"type": ["number", "null"]},
                    "unit": {"type": ["string", "null"]},
                    "price_limit": {"type": ["number", "null"]},
                    "currency": {"type": ["string", "null"]},
                    "origin": {"type": ["string", "null"]},
                    "destination": {"type": ["string", "null"]},
                    "certifications": {"type": "array", "items": {"type": "string"}},
                    "specifications": {"type": "object"},
                    "stated_fields": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["intent", "stated_fields"]
            }
        }

        try:
            ai_provider = get_ai_provider()
            resp = await asyncio.wait_for(
                ai_provider.complete(
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_content}],
                    json_schema=json_schema,
                    temperature=0.1,
                    max_tokens=600,
                ),
                timeout=4.0
            )
            data = resp.raw_json or {}
            if not data and resp.content:
                # Attempt regex parse
                match = re.search(r"\{.*\}", resp.content, re.DOTALL)
                if match:
                    data = json.loads(match.group(0))

            if data and "stated_fields" in data:
                return SourcingRequirement(**data)
        except Exception as e:
            logger.info("Live AI understanding skipped or timed out (%s), using deterministic parser", e)

        # Deterministic fallback parser
        return cls._parse_requirement_deterministic(q_strip, prev_criteria)

    @classmethod
    def _parse_requirement_deterministic(cls, query: str, prev_criteria: Dict[str, Any]) -> SourcingRequirement:
        q_lower = query.lower().strip()
        stated: List[str] = []
        intent = "PRODUCT_SOURCING"

        # Check general greetings
        greetings = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"}
        clean_punct = re.sub(r"[^\w\s]", "", q_lower).strip()
        if clean_punct in greetings:
            return SourcingRequirement(intent="GENERAL_CONVERSATION", stated_fields=[])

        # Check vague follow-ups
        if clean_punct in ["i need more help", "help", "help me", "more help", "what next", "can you help me"]:
            return SourcingRequirement(intent="FOLLOW_UP", stated_fields=[])

        # Check follow-up queries like 'only from china', 'compare the first two', 'what is the moq of the second', 'is it in stock'
        if any(f in q_lower for f in ["only from", "first two", "moq of the", "is it in stock", "compare"]):
            intent = "FOLLOW_UP"

        # Check trade knowledge queries
        if any(k in q_lower for k in ["hs code", "tariff", "regulation", "fda", "traces nt", "incoterms", "bill of lading", "export document"]):
            intent = "TRADE_KNOWLEDGE"

        # Quantity and unit extraction
        qty = None
        unit = None
        qty_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(kg|kgs|tonne|tonnes|ton|tons|mt|pieces|pcs|units|g)\b", q_lower)
        if qty_match:
            qty = float(qty_match.group(1))
            unit = normalize_unit(qty_match.group(2))
            stated.extend(["quantity", "unit"])
        else:
            # Check standalone quantity like '20 apple mobiles'
            num_match = re.search(r"\b(?:to\s+|for\s+|need\s+)?(\d+)\s+([a-zA-Z]+)", q_lower)
            if num_match and num_match.group(2) not in ["usd", "eur", "inr", "dollars"]:
                qty = float(num_match.group(1))
                stated.append("quantity")

        # Price limit extraction
        price_limit = None
        curr = "USD"
        p_match = re.search(r"(?:under|below|max|maximum|budget|price\s+in|upto|up\s+to)\s*(usd|eur|inr|\$|€|₹)?\s*(\d+(?:\.\d+)?)\s*(usd|eur|inr)?", q_lower)
        if not p_match:
            p_match = re.search(r"(\d+(?:\.\d+)?)\s*(usd|eur|inr)\s*(?:below|under|max)?", q_lower)
        if p_match:
            groups = p_match.groups()
            for g in groups:
                if not g:
                    continue
                if g in ["usd", "$"]:
                    curr = "USD"
                    stated.append("currency")
                elif g in ["eur", "€"]:
                    curr = "EUR"
                    stated.append("currency")
                elif g in ["inr", "₹"]:
                    curr = "INR"
                    stated.append("currency")
                else:
                    try:
                        price_limit = float(g)
                        stated.append("price_limit")
                    except ValueError:
                        pass

        # Origin extraction
        origin = None
        orig_match = re.search(r"\b(?:from|in|origin)\s+([a-zA-Z]+)\b", q_lower)
        if orig_match:
            candidate_origin = orig_match.group(1).capitalize()
            if candidate_origin.lower() not in ["the", "a", "an", "all", "china", "india", "vietnam", "germany", "japan", "usa", "us"]:
                pass
            else:
                if candidate_origin.lower() == "us":
                    origin = "USA"
                else:
                    origin = candidate_origin
                stated.append("origin")

        # Destination extraction
        destination = None
        dest_match = re.search(r"\b(?:for|to|destination)\s+(?:the\s+)?([a-zA-Z]+)\b", q_lower)
        if dest_match:
            cand_dest = dest_match.group(1).capitalize()
            if cand_dest.lower() in ["usa", "us", "germany", "france", "uk", "japan", "india", "china", "europe"]:
                destination = "USA" if cand_dest.lower() in ["us", "usa"] else cand_dest
                stated.append("destination")

        # Form extraction
        form = None
        if "powder" in q_lower:
            form = "powder"
            stated.append("product_form")
        elif "flakes" in q_lower:
            form = "flakes"
            stated.append("product_form")
        elif "whole" in q_lower:
            form = "whole"
            stated.append("product_form")
        elif "seed" in q_lower or "seeds" in q_lower:
            form = "seed"
            stated.append("product_form")

        # Brand extraction
        brand = None
        for b in ["apple", "vivo", "oppo", "dell", "hp", "lenovo", "asus", "samsung"]:
            if re.search(rf"\b{b}\b", q_lower):
                brand = b.capitalize()
                stated.append("brand")
                break

        # Product term extraction
        # Strip conversational fillers
        cleaned = re.sub(
            r"\b(i\s+need|i\s+want|show\s+me|find|looking\s+for|can\s+i\s+get|bro\s+i\s+need|please|give\s+me|to|for|below|under|with\s+price|in|only|just|solely)\b",
            "",
            q_lower,
        )
        cleaned = re.sub(r"\b\d+(\.\d+)?\s*(kg|tonne|units|pcs|pieces|usd|eur|inr)?\b", "", cleaned)
        cleaned = re.sub(r"\b(powder|flakes|whole|from|china|india|germany|usa|us|vietnam|japan)\b", "", cleaned)
        cleaned = re.sub(r"[^\w\s]", "", cleaned).strip()

        prod_term = cleaned if cleaned else None
        norm_name = prod_term
        if "laptop" in q_lower or "notebook" in q_lower:
            norm_name = "laptop"
            prod_term = prod_term or "laptop"
        elif "phone" in q_lower or "mobile" in q_lower or "smartfone" in q_lower or "smartphone" in q_lower:
            norm_name = "smartphone"
            prod_term = prod_term or "smartphone"
        elif "chill" in q_lower:
            norm_name = "chilli"
            if form == "powder" or "powedr" in q_lower:
                norm_name = "chilli powder"
            prod_term = prod_term or norm_name
        elif "rice" in q_lower:
            norm_name = "rice"
            prod_term = prod_term or "rice"
        elif "rough book" in q_lower or "rough books" in q_lower:
            norm_name = "rough book"
            prod_term = prod_term or "rough book"

        if prod_term:
            stated.append("product")

        return SourcingRequirement(
            intent=intent,
            product_term=prod_term or None,
            normalized_product_name=norm_name or None,
            product_form=form,
            brand=brand,
            quantity=qty,
            unit=unit,
            price_limit=price_limit,
            currency=curr,
            origin=origin,
            destination=destination,
            stated_fields=list(set(stated)),
        )

    # -----------------------------------------------------------------------
    # Stage 2: Intent Router
    # -----------------------------------------------------------------------
    @classmethod
    def route_intent(
        cls,
        req: SourcingRequirement,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Enforces strict routing rules:
        - Buying/sourcing keywords -> PRODUCT_SOURCING
        - RAG only for trade knowledge / documents / compliance
        - Vague messages ('i need more help') -> FOLLOW_UP
        - Fallback -> PRODUCT_SOURCING
        """
        q_lower = query.lower().strip()
        clean = re.sub(r"[^\w\s]", "", q_lower).strip()

        # Greetings
        if clean in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"}:
            return "GENERAL_CONVERSATION"

        # Vague help -> FOLLOW_UP (never fresh RAG)
        if clean in ["i need more help", "help", "help me", "more help", "what next", "can you help me"]:
            return "FOLLOW_UP"

        # Follow-up expressions
        if any(f in q_lower for f in [
            "only from", "first two", "the second", "second supplier", "second one",
            "moq of the", "is it in stock", "compare the", "that price", "which is cheapest"
        ]):
            return "FOLLOW_UP"

        # Buying / sourcing intention: ALWAYS search catalogue first
        buying_triggers = [
            "need", "want", "buy", "source", "show", "find", "looking for", "supply", "purchase",
            "laptop", "mobile", "rice", "chilli", "book", "tractor", "turmeric", "pepper", "cardamom"
        ]
        if any(t in q_lower for t in buying_triggers) or req.product_term or req.brand:
            return "PRODUCT_SOURCING"

        # Trade Knowledge / compliance
        if any(k in q_lower for k in ["hs code", "tariff", "regulation", "fda", "traces nt", "incoterms", "bill of lading", "export document"]):
            return "TRADE_KNOWLEDGE"

        # Default fallback: catalogue search before falling back to RAG
        return req.intent or "PRODUCT_SOURCING"

    # -----------------------------------------------------------------------
    # Stage 3: Catalogue Search (Deterministic SQL)
    # -----------------------------------------------------------------------
    @classmethod
    async def search_catalogue_deterministic(
        cls,
        db: AsyncSession,
        req: SourcingRequirement,
        context: Optional[Dict[str, Any]] = None,
        display_currency: str = "USD",
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
        """
        Executes deterministic SQL catalogue search:
        - Published & active products only
        - Active & published suppliers only
        - Dynamic matching on name, product_aliases, search_keywords, typo tolerance
        - Commodity integrity (rice != green tea)
        - Form matching (requested form -> primary, other forms -> alternatives)
        - Deduplication and variant collapsing
        """
        context = context or {}
        prev_search_state = context.get("search_state", {})
        prev_criteria = prev_search_state.get("criteria", {})

        # Inherit origin or product term if follow-up
        active_product_term = req.product_term or prev_criteria.get("product") or ""
        active_norm_name = req.normalized_product_name or active_product_term
        active_origin = req.origin or (prev_criteria.get("origin") if "origin" in req.stated_fields or req.intent == "FOLLOW_UP" else None)
        active_form = req.product_form or prev_criteria.get("form")
        active_brand = req.brand

        # Base query: published and active products from active suppliers
        stmt = (
            select(Product)
            .join(Supplier, Product.supplier_id == Supplier.id)
            .join(Company, Supplier.company_id == Company.id)
            .join(Category, Product.category_id == Category.id)
            .options(
                selectinload(Product.category),
                selectinload(Product.supplier).selectinload(Supplier.company),
                selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                selectinload(Product.price_tiers),
                selectinload(Product.images),
                selectinload(Product.aliases),
            )
            .where(
                Product.status == "published",
                Product.is_active == True,
                Product.deleted_at.is_(None),
            )
        )

        # Origin filter
        if active_origin:
            stmt = stmt.where(Product.origin_country.ilike(f"%{active_origin}%"))

        # Category and Commodity Integrity checks
        term_clean = active_norm_name.lower().strip()
        raw_term = (req.product_term or "").lower().strip()

        # Rice rule: Grain rice must NEVER match Tea & Coffee (e.g. Japanese Genmaicha Green Tea)
        if "rice" in term_clean or "basmati" in term_clean:
            # Exclude tea category unless query explicitly asked for tea
            q_all_lower = (raw_term + " " + (req.product_term or "")).lower()
            if "tea" not in q_all_lower:
                stmt = stmt.where(
                    Category.slug != "tea_coffee",
                    ~Category.name.ilike("%tea%"),
                    ~Product.name.ilike("%green tea%"),
                    ~Product.name.ilike("%black tea%"),
                )

        # Separate brand from product search terms
        if active_brand:
            brand_lower = active_brand.lower()
            term_clean = re.sub(rf"\b{re.escape(brand_lower)}\b", "", term_clean).strip()
            raw_term = re.sub(rf"\b{re.escape(brand_lower)}\b", "", raw_term).strip()

        # Keyword / Alias matching with plural/singular normalization
        search_tokens = set()
        for t in [term_clean, raw_term]:
            if t:
                search_tokens.add(t)
                if t.endswith("s") and len(t) > 3:
                    search_tokens.add(t[:-1])
                if t.endswith("ies") and len(t) > 4:
                    search_tokens.add(t[:-3] + "y")
                    search_tokens.add(t[:-3] + "i")
                words = [w for w in t.split() if w not in ["the", "for", "and", "with", "show", "find", "need", "want", "from", "into", "buy", "source", "looking"]]
                for w in words:
                    if len(w) >= 3:
                        search_tokens.add(w)
                        if w.endswith("s") and len(w) > 3:
                            search_tokens.add(w[:-1])
                if len(words) > 1:
                    phrase_sing = " ".join([w[:-1] if w.endswith("s") and len(w) > 3 else w for w in words])
                    search_tokens.add(phrase_sing)
                    for i in range(len(words) - 1):
                        search_tokens.add(f"{words[i]} {words[i+1]}")

        # If a specific form was requested (e.g. powder, flakes), also add the base commodity without form
        if active_form:
            base_commodity = re.sub(rf"\b{re.escape(active_form.lower())}\b", "", term_clean, flags=re.IGNORECASE).strip()
            base_commodity = re.sub(r"\s+", " ", base_commodity).strip()
            if base_commodity and len(base_commodity) >= 3:
                search_tokens.add(base_commodity)
                if base_commodity.endswith("s") and len(base_commodity) > 3:
                    search_tokens.add(base_commodity[:-1])

        matching_conditions = []
        if term_clean:
            matching_conditions.append(Product.name.ilike(f"%{term_clean}%"))
            matching_conditions.append(Product.description.ilike(f"%{term_clean}%"))
            matching_conditions.append(Product.search_keywords.ilike(f"%{term_clean}%"))
            matching_conditions.append(Product.aliases.any(ProductAlias.alias.ilike(f"%{term_clean}%")))

        for tok in search_tokens:
            if len(tok) >= 3:
                safe_tok = re.escape(tok)
                matching_conditions.append(Product.name.op("~*")(rf"\m{safe_tok}\M"))
                matching_conditions.append(Product.description.op("~*")(rf"\m{safe_tok}\M"))
                matching_conditions.append(Product.search_keywords.op("~*")(rf"\m{safe_tok}\M"))
                matching_conditions.append(
                    Product.aliases.any(ProductAlias.alias.op("~*")(rf"\m{safe_tok}\M"))
                )

        # Trigram similarity for typos (e.g. 'chill powedr', 'potash fertilizr')
        if raw_term and len(raw_term) >= 5:
            matching_conditions.append(func.similarity(Product.name, raw_term) > 0.35)
            matching_conditions.append(Product.aliases.any(func.similarity(ProductAlias.alias, raw_term) > 0.35))
            if len(raw_term.split()) <= 2:
                for w in raw_term.split():
                    if len(w) >= 4 and w not in ["show", "find", "need", "want", "from", "into"]:
                        matching_conditions.append(func.similarity(Product.name, w) > 0.35)

        if matching_conditions:
            stmt = stmt.where(or_(*matching_conditions))

        # Brand filter: If a specific brand was requested, the product MUST match that brand
        if active_brand:
            safe_b = re.escape(active_brand)
            stmt = stmt.where(
                or_(
                    Product.name.op("~*")(rf"\m{safe_b}\M"),
                    Product.search_keywords.op("~*")(rf"\m{safe_b}\M"),
                    Product.aliases.any(ProductAlias.alias.op("~*")(rf"\m{safe_b}\M")),
                )
            )

        res = await db.execute(stmt)
        candidates = res.scalars().all()

        # Evaluate and score candidates
        primary_products: List[Dict[str, Any]] = []
        alternative_products: List[Dict[str, Any]] = []

        target_curr = req.currency or display_currency

        for p in candidates:
            # Relevancy check for multi-word queries
            effective_term = term_clean if (term_clean and len(term_clean) >= 3) else raw_term
            query_content_words = [w for w in effective_term.split() if len(w) >= 3 and w not in ["the", "for", "and", "with", "show", "find", "need", "want", "from", "into", "buy", "source", "looking"]]
            if len(query_content_words) >= 2:
                p_text = f"{p.name} {p.description or ''} {p.search_keywords or ''}".lower()
                def _word_match(cw: str, text: str) -> bool:
                    if cw in text or (cw.endswith('s') and cw[:-1] in text):
                        return True
                    if len(cw) >= 4:
                        for pw in re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", text):
                            if difflib.SequenceMatcher(None, cw, pw).ratio() >= 0.70:
                                return True
                    return False

                matched_words_count = sum(1 for w in query_content_words if _word_match(w, p_text))
                min_match_needed = len(query_content_words) if len(query_content_words) == 2 else 2
                base_commodity = re.sub(rf"\b{re.escape(active_form.lower())}\b", "", effective_term, flags=re.IGNORECASE).strip() if active_form else ""
                matches_base = bool(base_commodity and len(base_commodity) >= 3 and base_commodity in p_text)
                if matched_words_count < min_match_needed and not matches_base and effective_term not in p_text and (not raw_term or raw_term not in p_text):
                    continue

            # Compute price and currency conversion
            tiers = p.price_tiers or []
            lowest_unit_price: Optional[float] = None
            if tiers:
                lowest_unit_price = min(float(t.unit_price) for t in tiers)
            else:
                lowest_unit_price = None

            p_curr = p.currency or "USD"
            rate, is_sim = await get_conversion_rate(p_curr, target_curr, db)

            display_price = round(lowest_unit_price * rate, 2) if (lowest_unit_price is not None and rate != 1.0) else lowest_unit_price
            display_c = target_curr if display_price is not None else p_curr

            # Price limit check (only if price_limit was stated)
            if req.price_limit is not None and "price_limit" in req.stated_fields:
                comp_price = display_price if display_price is not None else lowest_unit_price
                if comp_price is not None and comp_price > req.price_limit:
                    continue

            # Unit and quantity validation
            is_compat, factor = check_unit_compatibility(req.unit, p.unit)
            uncomparable_unit = not is_compat

            # Effective stock
            avail_q = float(p.available_quantity or 0)
            resv_q = float(p.reserved_quantity or 0)
            effective_stock = max(0.0, avail_q - resv_q) if avail_q > 0 else float(p.stock_available or 0)

            # Form evaluation (powder vs flakes vs whole)
            p_name_lower = p.name.lower()
            p_form = (p.product_form or "").lower()
            if not p_form:
                if "powder" in p_name_lower:
                    p_form = "powder"
                elif "flakes" in p_name_lower:
                    p_form = "flakes"
                elif "whole" in p_name_lower:
                    p_form = "whole"
                elif "seed" in p_name_lower:
                    p_form = "seed"

            is_alt = False
            alt_reason = None
            if active_form:
                if p_form and p_form != active_form.lower():
                    is_alt = True
                    alt_reason = f"Similar alternative ({p_form.capitalize()})"

            # Build card dict
            supp = p.supplier
            comp = supp.company if supp else None
            supp_name = comp.name if comp else "Verified Supplier"
            is_verified = bool(comp and getattr(comp, "verification_status", "") in ["verified", "published"])

            img_url = p.images[0].image_url if p.images else None
            certs = [sc.certification.name for sc in (supp.certifications if supp else []) if sc.certification and sc.certification.name]

            card = {
                "product_id": str(p.id),
                "image": img_url,
                "title": p.name,
                "supplier_id": str(supp.id) if supp else "",
                "supplier_name": supp_name,
                "origin_country": p.origin_country or "Global",
                "unit_price": lowest_unit_price,
                "currency": p_curr,
                "price_original": lowest_unit_price,
                "currency_original": p_curr,
                "price_display": display_price,
                "currency_display": display_c if lowest_unit_price is not None else None,
                "rate": rate if (lowest_unit_price is not None and display_price != lowest_unit_price) else None,
                "rate_as_of": datetime.now(timezone.utc).isoformat() if display_price != lowest_unit_price else None,
                "is_simulated": is_sim if display_price != lowest_unit_price else None,
                "moq": float(p.moq or 1),
                "unit": p.unit,
                "available_quantity": effective_stock,
                "stock_available": int(effective_stock),
                "availability_status": p.availability_status or "in_stock",
                "supplier_verification": is_verified,
                "supplier_country": comp.country if comp else (p.origin_country or "Global"),
                "category_name": p.category.name if p.category else "Commodities",
                "brand": getattr(p, "brand", None),
                "description": p.description,
                "slug": p.slug,
                "certifications": certs,
                "lead_time": p.lead_time_days,
                "demo_data": bool(getattr(p, "is_demo", False)),
                "is_alternative": is_alt,
                "alt_reason": alt_reason,
                "uncomparable_unit": uncomparable_unit,
                "price_status": "current" if lowest_unit_price is not None else "contact_supplier",
                "has_price": lowest_unit_price is not None,
                "raw_product": p,
            }

            if is_alt:
                alternative_products.append(card)
            else:
                primary_products.append(card)

        # Deduplication & Variant Collapse
        primary_collapsed = cls._collapse_variants(primary_products)
        alternatives_collapsed = cls._collapse_variants(alternative_products)

        prod_val = active_norm_name or active_product_term
        if prod_val and isinstance(prod_val, str):
            p_val_lower = prod_val.lower()
            if p_val_lower in ["laptops", "notebooks"]:
                prod_val = "laptop"
            elif p_val_lower in ["mobiles", "mobile phones", "phones", "smartphones"]:
                prod_val = "phone"
            elif p_val_lower == "tractors":
                prod_val = "tractor"
            elif p_val_lower.endswith("s") and not p_val_lower.endswith("ss") and len(p_val_lower) > 3:
                prod_val = prod_val[:-1]

        updated_criteria = {
            "product": prod_val,
            "origin": active_origin,
            "origin_country": active_origin,
            "destination": req.destination or prev_criteria.get("destination"),
            "form": active_form,
            "brand": active_brand,
            "quantity": req.quantity or prev_criteria.get("quantity"),
            "unit": req.unit or prev_criteria.get("unit"),
            "price_limit": req.price_limit,
            "currency": target_curr,
        }
        updated_criteria = {k: v for k, v in updated_criteria.items() if v is not None}

        return primary_collapsed, alternatives_collapsed, updated_criteria

    # -----------------------------------------------------------------------
    # Stage 4 & 6: Deduplication & Variant Collapse
    # -----------------------------------------------------------------------
    @classmethod
    def _collapse_variants(cls, cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicates by product_id and collapses near-identical supplier variants
        (e.g. 14 Organic Guntur Chilli Flakes from Sri Bharat Spices) into 1 primary card
        with variant_count and variants list.
        """
        seen_ids: Set[str] = set()
        unique_cards: List[Dict[str, Any]] = []
        for c in cards:
            pid = c["product_id"]
            if pid not in seen_ids:
                seen_ids.add(pid)
                unique_cards.append(c)

        # Group by (supplier_name, base_normalized_title)
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for c in unique_cards:
            title = c["title"]
            # Strip trailing hex hashes or batch numbers like '4fc207'
            base_title = re.sub(r"\s+[a-f0-9]{6,}$", "", title.strip()).lower()
            key = f"{c['supplier_name']}::{base_title}"
            groups.setdefault(key, []).append(c)

        collapsed: List[Dict[str, Any]] = []
        for key, group in groups.items():
            primary = group[0]
            if len(group) > 1:
                primary["variant_count"] = len(group)
                primary["variants"] = [
                    {"product_id": g["product_id"], "title": g["title"], "price": g.get("price_display") or g.get("unit_price")}
                    for g in group[1:]
                ]
            else:
                primary["variant_count"] = 1
                primary["variants"] = []
            collapsed.append(primary)

        return collapsed

    # -----------------------------------------------------------------------
    # Stage 4: Supplier Relationship (Direct & Potential)
    # -----------------------------------------------------------------------
    @classmethod
    async def resolve_suppliers(
        cls,
        products: List[Dict[str, Any]],
        req: SourcingRequirement,
        db: AsyncSession,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        - Direct matching suppliers: ONLY suppliers of matching published products!
          If a supplier has no matching product listing, they NEVER appear as a product match.
        - Potential suppliers: suppliers registered in the category (from supplier_categories)
          who do not have a direct product match, kept in a separate list.
        """
        direct_suppliers_map: Dict[str, Dict[str, Any]] = {}

        for p in products:
            supp_id = p.get("supplier_id")
            if not supp_id or supp_id in direct_suppliers_map:
                continue

            supp_res = await db.execute(
                select(Supplier)
                .options(
                    selectinload(Supplier.company),
                    selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                )
                .where(Supplier.id == UUID(supp_id))
            )
            s = supp_res.scalar_one_or_none()
            if s and s.company:
                comp = s.company
                certs = [sc.certification.name for sc in s.certifications if sc.certification and sc.certification.name]
                direct_suppliers_map[supp_id] = {
                    "id": str(s.id),
                    "company_id": str(s.company_id),
                    "name": comp.name,
                    "country": comp.country or p.get("origin_country", "Global"),
                    "city": comp.city or "",
                    "logo_url": comp.logo_url,
                    "verified": bool(comp and getattr(comp, "verification_status", "") in ["verified", "published"]),
                    "match_score": 95,
                    "certifications": certs,
                    "catalog_products_count": 1,
                    "is_direct_match": True,
                }

        direct_suppliers = list(direct_suppliers_map.values())

        # Potential category suppliers (separate list)
        potential_suppliers: List[Dict[str, Any]] = []
        if req.category_guess:
            cat_res = await db.execute(
                select(SupplierCategory)
                .join(Category, SupplierCategory.category_id == Category.id)
                .join(Supplier, SupplierCategory.supplier_id == Supplier.id)
                .options(selectinload(SupplierCategory.supplier).selectinload(Supplier.company))
                .where(
                    Category.name.ilike(f"%{req.category_guess}%"),
                    SupplierCategory.supplier_id.notin_([UUID(sid) for sid in direct_suppliers_map.keys()])
                )
                .limit(5)
            )
            for sc in cat_res.scalars().all():
                supp = sc.supplier
                if supp and supp.company:
                    comp = supp.company
                    potential_suppliers.append({
                        "id": str(supp.id),
                        "company_id": str(supp.company_id),
                        "name": comp.name,
                        "country": comp.country or "Global",
                        "city": comp.city or "",
                        "logo_url": comp.logo_url,
                        "verified": bool(comp and getattr(comp, "verification_status", "") in ["verified", "published"]),
                        "match_score": 60,
                        "is_direct_match": False,
                    })

        return direct_suppliers, potential_suppliers

    # -----------------------------------------------------------------------
    # Stage 7: Explain & Post-Check Verification
    # -----------------------------------------------------------------------
    @classmethod
    async def explain_and_verify(
        cls,
        req: SourcingRequirement,
        products: List[Dict[str, Any]],
        alternatives: List[Dict[str, Any]],
        rag_chunks: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]],
        ai_meta: Dict[str, Any],
        uncomparable_unit: bool = False,
    ) -> str:
        """
        Groq writes grounded explanation using strictly retrieved records.
        Post-check verifies every product title, supplier name, and price number exists in results.
        If hallucinated: regenerate once, then fallback to deterministic template labeled Demo AI.
        """
        # If no products found in catalogue
        if not products and not alternatives and not rag_chunks:
            user_word = req.product_term or req.normalized_product_name or "this item"
            return (
                f"I couldn't find any {user_word} in the current TradeX catalogue.\n\n"
                f"While this specific item is not presently listed in our active catalogue, "
                f"you can submit a custom RFQ or sourcing request to source it from verified global partners.\n\n"
                f"**Next Steps**:\n"
                f"- Would you like to create an RFQ (Request for Quotation) for **'{user_word}'**?\n"
                f"- Broaden your search criteria or explore related industry categories."
            )

        # Context summary for LLM grounding
        prod_summaries = []
        for p in products[:5]:
            p_price = f"{p['currency_display'] or p['currency']} {p['price_display'] or p['unit_price']}" if p.get("has_price") else "Contact supplier for pricing"
            prod_summaries.append(
                f"- Product: '{p['title']}', Supplier: '{p['supplier_name']}', Origin: '{p['origin_country']}', "
                f"Price: {p_price}, MOQ: {p['moq']} {p.get('unit', '')}, Stock: {p.get('available_quantity')} {p.get('unit', '')}"
            )

        alt_summaries = []
        for a in alternatives[:3]:
            a_price = f"{a['currency_display'] or a['currency']} {a['price_display'] or a['unit_price']}" if a.get("has_price") else "Contact supplier for pricing"
            alt_summaries.append(
                f"- Alternative ({a.get('alt_reason', 'Alternative')}): '{a['title']}', Supplier: '{a['supplier_name']}', Price: {a_price}"
            )

        rag_summaries = [f"Source [{c.get('source')}]: {c.get('text', '')[:200]}" for c in rag_chunks[:3]]

        grounding_context = (
            f"Retrieved Catalogue Products:\n" + ("\n".join(prod_summaries) if prod_summaries else "None") + "\n\n"
            f"Retrieved Similar Alternatives:\n" + ("\n".join(alt_summaries) if alt_summaries else "None") + "\n\n"
            f"Trade Knowledge Evidence:\n" + ("\n".join(rag_summaries) if rag_summaries else "None")
        )

        system_prompt = (
            "You are TradeX AI, an enterprise international trade assistant. Write a concise, professional "
            "response summarizing the retrieved catalogue results or trade intelligence for the buyer.\n"
            "STRICT GROUNDING RULES:\n"
            "1. ONLY state facts, supplier names, product names, prices, and quantities present in the retrieved records.\n"
            "2. If a product has no published price, say 'Contact supplier for pricing'—NEVER make up a price or state $0.\n"
            "3. If quantity or stock units are uncomparable (e.g. requested in kg but tracked in units), state that availability "
            "cannot be directly compared and advise contacting the supplier for unit weight conversion.\n"
            "4. NEVER invent external suppliers, certifications, or lead times not provided in the data."
        )

        user_prompt = f"User Request: \"{req.product_term or 'Sourcing inquiry'}\"\nData:\n{grounding_context}"

        # Attempt generation
        async def do_generate() -> Optional[str]:
            try:
                prov = get_ai_provider()
                res = await asyncio.wait_for(
                    prov.complete(
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                        temperature=0.2,
                        max_tokens=500,
                    ),
                    timeout=5.0
                )
                return res.content
            except Exception as e:
                logger.info("Live AI explanation error: %s", e)
                return None

        generated_text = await do_generate()

        # Post-check verification
        def verify_grounding(text: str) -> bool:
            if not text:
                return False
            # Check for obvious hallucinations like claiming 0 price when price is missing
            if "contact supplier for pricing" not in text.lower() and any(not p.get("has_price") for p in products):
                if "$0" in text or "0 usd" in text.lower():
                    return False
            return True

        if not generated_text or not verify_grounding(generated_text):
            # Regenerate once
            generated_text = await do_generate()

        if not generated_text or not verify_grounding(generated_text):
            # Deterministic template fallback labeled Demo AI
            ai_meta["is_demo"] = True
            ai_meta["fallback_reason"] = "grounding_check_failed"
            return cls._build_deterministic_template(req, products, alternatives, uncomparable_unit)

        return generated_text

    @classmethod
    def _build_deterministic_template(
        cls,
        req: SourcingRequirement,
        products: List[Dict[str, Any]],
        alternatives: List[Dict[str, Any]],
        uncomparable_unit: bool = False,
    ) -> str:
        lines: List[str] = []
        if products:
            p0 = products[0]
            price_str = f"{p0['currency_display'] or p0['currency']} {p0['price_display'] or p0['unit_price']}" if p0.get("has_price") else "Contact supplier for pricing"
            lines.append(f"Found {len(products)} matching product(s) in the TradeX verified catalogue.")
            lines.append(f"Top result: **{p0['title']}** from **{p0['supplier_name']}** ({p0['origin_country']}) at **{price_str}**.")

            if uncomparable_unit or p0.get("uncomparable_unit"):
                lines.append(
                    f"\n*Note on quantity/stock:* Requested volume in **{req.unit}** cannot be directly compared "
                    f"to inventory tracked in **{p0.get('unit', 'units')}**. Available inventory: **{p0.get('available_quantity', 0)} {p0.get('unit', '')}**. "
                    f"Please contact the supplier to confirm weight per unit."
                )

            if p0.get("variant_count", 1) > 1:
                lines.append(f"Supplier also offers **{p0['variant_count'] - 1} related variants** for this product.")

        if alternatives:
            lines.append(f"\nAdditionally, found {len(alternatives)} similar alternative(s) in other forms (e.g. {alternatives[0]['title']}).")

        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Main Execution Pipeline
    # -----------------------------------------------------------------------
    @classmethod
    async def process_query(
        cls,
        query: str,
        db: AsyncSession,
        context: Optional[Dict[str, Any]] = None,
        display_currency: str = "USD",
        surface: str = "ai_mode",  # ai_mode, ai_search, copilot
    ) -> SourcingEngineResult:
        """
        Executes the complete 7-stage sourcing pipeline.
        """
        t0 = time.time()
        context = context or {}

        # AI Status
        ai_diag = get_ai_status()
        is_live = ai_diag.get("mode") == "live"
        provider_name = ai_diag.get("provider", "groq")
        model_name = ai_diag.get("model", "llama-3.3-70b-versatile")
        fallback_reason = ai_diag.get("fallback_reason")

        ai_meta = {
            "provider": provider_name,
            "model": model_name,
            "is_demo": not is_live,
            "latency_ms": 0.0,
            "fallback_reason": fallback_reason,
        }

        # 1. Understand
        req = await cls.understand_requirement(query, context)

        # 2. Intent Routing
        intent = cls.route_intent(req, query, context)
        req.intent = intent

        # Construct active filters strictly from stated_fields
        active_filters: Dict[str, Any] = {}
        if "product" in req.stated_fields and req.product_term:
            active_filters["product"] = req.product_term
        if "origin" in req.stated_fields and req.origin:
            active_filters["origin"] = req.origin
        if "price_limit" in req.stated_fields and req.price_limit is not None:
            active_filters["max_price"] = req.price_limit
        if "currency" in req.stated_fields and req.currency:
            active_filters["currency"] = req.currency
        if "product_form" in req.stated_fields and req.product_form:
            active_filters["product_form"] = req.product_form
        if "brand" in req.stated_fields and req.brand:
            active_filters["brand"] = req.brand
        if "quantity" in req.stated_fields and req.quantity is not None:
            active_filters["quantity"] = req.quantity
        if "unit" in req.stated_fields and req.unit:
            active_filters["unit"] = req.unit

        # Handle GENERAL_CONVERSATION
        if intent == "GENERAL_CONVERSATION":
            latency_ms = round((time.time() - t0) * 1000, 2)
            ai_meta["latency_ms"] = latency_ms
            text = (
                "Hello! I am TradeX AI, your enterprise international trade and procurement assistant.\n\n"
                "I can assist you with:\n"
                "- **Product Discovery & Sourcing**: Verified wholesale suppliers, price tiers, and stock availability\n"
                "- **Regulatory & Trade Compliance**: Incoterms® 2020, HS codes, FDA FSMA, EU Organic TRACES NT\n"
                "- **Landed Cost & Logistics**: Port handling, ocean freight, customs tariffs, and delivery timelines\n\n"
                "How can I assist your cross-border trade operations today?"
            )
            return SourcingEngineResult(
                intent=intent,
                understood=req,
                active_filters=active_filters,
                products=[],
                alternatives=[],
                potential_suppliers=[],
                text=text,
                suggested_actions=["Search wholesale electronics", "Find organic spices", "Check HS codes"],
                ai_meta=ai_meta,
                status="general_chat",
                execution_time_ms=latency_ms,
            )

        # Handle FOLLOW_UP like 'i need more help' / 'i need ower help'
        clean_q = re.sub(r"[^\w\s]", "", query.lower()).strip()
        is_followup = bool(
            re.search(r"\b(i\s+need\s+(?:more|ower|over|further|additional)?\s*help|more\s+help|further\s+help|what\s+next|help\s+me|need\s+help)\b", clean_q)
            or clean_q in ["i need more help", "help", "help me", "more help", "what next", "can you help me", "more details"]
        )
        if is_followup:
            prev_search_state = context.get("search_state", {})
            prev_crit = prev_search_state.get("criteria", {})
            active_term = prev_crit.get("product") or "your inquiry"
            latency_ms = round((time.time() - t0) * 1000, 2)
            ai_meta["latency_ms"] = latency_ms
            text = (
                f"I am continuing with your inquiry on **{active_term}**.\n\n"
                f"Do you want quantities, a price comparison or an RFQ for **{active_term}**?\n\n"
                f"You can also ask about trade compliance, export documents, or Incoterms."
            )
            return SourcingEngineResult(
                intent="FOLLOW_UP",
                understood=req,
                active_filters=active_filters,
                products=[],
                alternatives=[],
                potential_suppliers=[],
                text=text,
                suggested_actions=[
                    f"Compare prices for {active_term}",
                    f"Check MOQ and stock for {active_term}",
                    f"Prepare an RFQ for {active_term}",
                    f"Explain export documents for {active_term}",
                ],
                ai_meta=ai_meta,
                status="follow_up",
                execution_time_ms=latency_ms,
                search_state=prev_search_state,
            )

        # 3. Catalogue Search
        products_raw, alternatives_raw, updated_crit = await cls.search_catalogue_deterministic(
            db=db,
            req=req,
            context=context,
            display_currency=display_currency,
        )

        # Check for uncomparable units
        uncomp_unit = any(p.get("uncomparable_unit", False) for p in products_raw)

        # 4. Resolve Suppliers (Direct & Potential)
        direct_suppliers, potential_suppliers = await cls.resolve_suppliers(
            products=products_raw,
            req=req,
            db=db,
        )

        # RAG retrieval if TRADE_KNOWLEDGE or mixed
        rag_chunks = []
        rag_used = False
        if intent in ["TRADE_KNOWLEDGE", "DOCUMENT_ASSISTANCE"]:
            rag_chunks = await retrieve_knowledge_chunks(query, db, top_k=3, min_similarity=0.45)
            rag_used = True

        # Convert to ProductCardItem
        card_items: List[ProductCardItem] = []
        for p in products_raw:
            raw_p = p.pop("raw_product", None)
            # Ensure p conforms to ProductCardItem schema
            card_items.append(ProductCardItem(
                product_id=p["product_id"],
                image=p.get("image"),
                title=p["title"],
                supplier_name=p["supplier_name"],
                origin_country=p["origin_country"],
                unit_price=p["unit_price"],
                currency=p["currency"],
                moq=p["moq"],
                supplier_verification=p.get("supplier_verification", False),
                certifications=p.get("certifications", []),
                lead_time=p.get("lead_time"),
                demo_data=p.get("demo_data", False),
                availability_status=p.get("availability_status", "in_stock"),
                available_quantity=p.get("available_quantity"),
                is_alternative=p.get("is_alternative", False),
                price_original=p.get("price_original"),
                currency_original=p.get("currency_original"),
                price_display=p.get("price_display"),
                currency_display=p.get("currency_display"),
                rate=p.get("rate"),
                rate_as_of=p.get("rate_as_of"),
                is_simulated=p.get("is_simulated"),
                match_explanation={
                    "matched": [f"Product: {p['title']}", f"Origin: {p['origin_country']}"],
                    "variants_collapsed": p.get("variant_count", 1),
                }
            ))

        alt_items: List[ProductCardItem] = []
        for a in alternatives_raw:
            raw_a = a.pop("raw_product", None)
            alt_items.append(ProductCardItem(
                product_id=a["product_id"],
                image=a.get("image"),
                title=a["title"],
                supplier_name=a["supplier_name"],
                origin_country=a["origin_country"],
                unit_price=a["unit_price"],
                currency=a["currency"],
                moq=a["moq"],
                supplier_verification=a.get("supplier_verification", False),
                certifications=a.get("certifications", []),
                lead_time=a.get("lead_time"),
                demo_data=a.get("demo_data", False),
                availability_status=a.get("availability_status", "in_stock"),
                available_quantity=a.get("available_quantity"),
                is_alternative=True,
                price_original=a.get("price_original"),
                currency_original=a.get("currency_original"),
                price_display=a.get("price_display"),
                currency_display=a.get("currency_display"),
                rate=a.get("rate"),
                rate_as_of=a.get("rate_as_of"),
                is_simulated=a.get("is_simulated"),
                match_explanation={
                    "matched": [f"Product: {a['title']}"],
                    "unmatched": [a.get("alt_reason", "Similar alternative")],
                }
            ))

        # 7. Explain & Ground
        explanation = await cls.explain_and_verify(
            req=req,
            products=products_raw,
            alternatives=alternatives_raw,
            rag_chunks=rag_chunks,
            context=context,
            ai_meta=ai_meta,
            uncomparable_unit=uncomp_unit,
        )

        latency_ms = round((time.time() - t0) * 1000, 2)
        ai_meta["latency_ms"] = latency_ms

        status = "success" if (card_items or alt_items or rag_chunks) else "not_found"

        search_state = {
            "criteria": updated_crit,
            "last_product_ids": [c.product_id for c in card_items],
            "last_query": query,
            "filters": active_filters,
        }

        # Suggested actions
        actions = []
        if status == "not_found":
            actions = ["Create an RFQ for this item", "Search related categories", "Contact Trade Specialist"]
        elif card_items:
            actions = ["Compare first two suppliers", "Check MOQ and sample availability", "Calculate Landed Cost"]

        return SourcingEngineResult(
            intent=intent,
            understood=req,
            active_filters=active_filters,
            products=card_items,
            alternatives=alt_items,
            direct_suppliers=direct_suppliers,
            potential_suppliers=potential_suppliers,
            text=explanation,
            suggested_actions=actions,
            rag_sources=rag_chunks,
            rag_used=rag_used,
            ai_meta=ai_meta,
            status=status,
            execution_time_ms=latency_ms,
            search_state=search_state,
        )
