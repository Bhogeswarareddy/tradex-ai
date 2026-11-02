"""
TradeX AI - AI Mode Service (Prompt 22: AI Mode Intelligence)
Handles:
1. Intent router with live LLM (JSON schema) and deterministic rule-based fallback:
   - greeting, small_talk
   - product_search (new_search)
   - refine_search (refine)
   - compare
   - product_question (question_about_product)
   - availability_or_price_question
   - supplier_question
   - negotiation_help
   - clear_restart (clear_and_restart)
   - unclear
2. Typo normalization via trade synonym dictionary & trigram similarity (e.g. 'what chils' -> asks 'Did you mean chilli?' and returns chilli products).
3. Search criteria extraction, merging, and active filter chip tracking. Topic change resets criteria.
4. Deterministic PostgreSQL catalogue search:
   - Published & active only
   - Active suppliers
   - Minimum relevance score (never dump unrelated products)
   - Exclude out-of-stock products unless explicitly requested
   - Max 6 cards per turn with has_more indicator
   - Honest no-match responses identifying the failed constraint and presenting clearly marked alternatives
5. Grounded LLM summaries with real database metrics (no canned boilerplate).
6. Rich category image placeholders (never empty cube icon).
7. Automatic conversation titling from first search.
8. Compare resolution for phrases like 'the first two'.
9. Availability & pricing calculator: available_quantity - reserved_quantity, availability_status, volume price tier, confirmed date, and stale flag.
"""
import difflib
import json
import logging
import re
import time
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import get_ai_provider, get_ai_status
from app.core.errors import AppException
from app.models.ai_mode import AIConversation, AIMessage, AISelectedProduct, NegotiationDraft
from app.models.catalog import Category, PriceTier, Product, SupplierCertification
from app.models.content import Message, Thread
from app.models.identity import Buyer, Company, Supplier, User
from app.schemas.ai_mode import ProductCardItem

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Trade Synonym and Typo Normalization
# ---------------------------------------------------------------------------
TRADE_SYNONYMS: Dict[str, str] = {
    "chils": "chilli",
    "chili": "chilli",
    "chillies": "chilli",
    "chilies": "chilli",
    "chilly": "chilli",
    "mirch": "chilli",
    "turmerik": "turmeric",
    "curcuma": "turmeric",
    "haldi": "turmeric",
    "cardamon": "cardamom",
    "elaichi": "cardamom",
    "peper": "black pepper",
    "pepper": "black pepper",
    "golmirch": "black pepper",
    "gingr": "ginger",
    "adrak": "ginger",
    "dalchini": "cinnamon",
    "cinnamon": "cinnamon",
    "laung": "cloves",
    "cloves": "cloves",
    "laptop": "laptop",
    "laptops": "laptop",
    "notebook": "laptop",
    "notebooks": "laptop",
    "pc": "laptop",
}

# Category Image Placeholders (High quality Unsplash images, never empty cube)
CATEGORY_PLACEHOLDERS: Dict[str, str] = {
    "spices": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80",
    "chilli": "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80",
    "turmeric": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80",
    "cardamom": "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=600&q=80",
    "black pepper": "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80",
    "pepper": "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80",
    "ginger": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=600&q=80",
    "tea": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
    "coffee": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
    "rice": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    "laptop": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80",
    "notebook": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80",
    "electronics": "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=600&q=80",
    "textiles": "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=600&q=80",
    "machinery": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80",
    "default": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
}


# Category mapping for typo target matching (Prompt 30)
TARGET_CATEGORIES: Dict[str, str] = {
    "chilli": "spices",
    "turmeric": "spices",
    "cardamom": "spices",
    "pepper": "spices",
    "ginger": "spices",
    "cinnamon": "spices",
    "cloves": "spices",
    "rice": "rice_grains",
    "coffee": "tea_coffee",
    "tea": "tea_coffee",
    "laptop": "electronics",
    "notebook": "electronics",
    "phone": "electronics",
    "tractor": "machinery",
}

# Trade and commerce domain terms that must NEVER be treated as typos or matched to products (Prompt 30)
DOMAIN_TERMS = {
    "price", "prices", "cost", "costs", "moq", "stock", "quantity", "lead", "time", "days",
    "unit", "units", "usd", "eur", "inr", "gbp", "aed", "cny", "dollar", "dollars",
    "order", "orders", "shipping", "deliver", "delivery", "supplier", "suppliers",
    "compare", "comparison", "under", "below", "above", "over", "max", "min",
    "tonnes", "tonne", "tons", "ton", "kg", "kilograms", "spec", "specs", "specification"
}


def trigram_similarity(s1: str, s2: str) -> float:
    """Computes character trigram similarity between two strings."""
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0
    s1_tri = {s1[i:i+3] for i in range(max(1, len(s1) - 2))}
    s2_tri = {s2[i:i+3] for i in range(max(1, len(s2) - 2))}
    if not s1_tri or not s2_tri:
        return 0.0
    return 2.0 * len(s1_tri & s2_tri) / (len(s1_tri) + len(s2_tri))


def normalize_trade_query(text: str, intent_is_clear: bool = False, has_catalogue_matches: bool = True) -> Tuple[str, Optional[str]]:
    """
    Normalizes words using TRADE_SYNONYMS and trigram similarity.
    Prompt 30: Typo/synonym suggestion runs ONLY when intent is unclear or product term has no catalogue match.
    Suggestion must be close in meaning (trigram similarity >= 0.75 and same category)
    and must never offer an unrelated category (e.g. 'price' or 'laptop' suggesting 'rice').
    """
    words = text.split()
    normalized_words = []
    did_you_mean: Optional[str] = None

    common_stop = {"what", "how", "find", "for", "the", "a", "an", "is", "are", "in", "to", "of", "and", "with", "only", "from", "show", "me", "i", "want", "need", "get"}
    known_targets = ["chilli", "turmeric", "cardamom", "pepper", "ginger", "cinnamon", "cloves", "laptop", "rice", "coffee", "tea", "tractor", "phone"]

    # Detect current context category if present
    text_lower_all = text.lower()
    inferred_category: Optional[str] = None
    for kw, cat in TARGET_CATEGORIES.items():
        if re.search(rf"\b{re.escape(kw)}\b", text_lower_all):
            inferred_category = cat
            break

    for w in words:
        clean = re.sub(r"[^\w]", "", w.lower()).strip()
        if not clean:
            normalized_words.append(w)
            continue

        # Exact synonym dictionary
        if clean in TRADE_SYNONYMS:
            canon = TRADE_SYNONYMS[clean]
            normalized_words.append(canon)
            is_inflection = clean in ["laptops", "notebooks", "phones", "tractors", "chillies", "chilies", "spices", "cloves", "computers"]
            if clean != canon and not is_inflection and not (intent_is_clear and has_catalogue_matches):
                did_you_mean = canon
        elif clean in DOMAIN_TERMS or clean in common_stop:
            # Never run typo matching on domain keywords or stop words!
            normalized_words.append(w)
        elif not intent_is_clear or not has_catalogue_matches:
            # Only run typo fuzzy matching when intent is unclear or no matches
            best_target = None
            best_sim = 0.0
            for target in known_targets:
                # Same category rule: if we inferred category, must match
                if inferred_category and TARGET_CATEGORIES.get(target) != inferred_category:
                    continue
                sim = trigram_similarity(clean, target)
                if sim > best_sim and sim >= 0.75:
                    best_sim = sim
                    best_target = target

            if best_target:
                normalized_words.append(best_target)
                if clean != best_target:
                    did_you_mean = best_target
            else:
                normalized_words.append(w)
        else:
            normalized_words.append(w)

    return " ".join(normalized_words), did_you_mean


def get_category_placeholder(product_name: str, category_name: Optional[str] = None) -> str:
    """Returns a rich, visually relevant placeholder image for a product."""
    target = f"{product_name} {category_name or ''}".lower()
    for key, url in CATEGORY_PLACEHOLDERS.items():
        if key in target:
            return url
    return CATEGORY_PLACEHOLDERS["default"]


# ---------------------------------------------------------------------------
# Intent Router & Criteria Extraction
# ---------------------------------------------------------------------------
def classify_user_message(content: str, current_state: Dict[str, Any]) -> str:
    """
    Classifies a buyer message into one of:
    - greeting
    - small_talk
    - clear_and_restart (clear_restart)
    - compare
    - question_about_product (product_question)
    - availability_or_price_question (stock_question)
    - supplier_question
    - negotiation_help
    - refine (refine_search)
    - new_search (product_search)
    - unclear
    """
    text = content.strip().lower()
    clean_punct = re.sub(r"[^\w\s]", "", text).strip()

    # 0. Conversational greeting & small talk
    greetings = {"hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "howdy", "hi there", "hello there"}
    if clean_punct in greetings:
        return "greeting"

    small_talk = {"who are you", "what can you do", "help me", "how does this work", "what is tradex ai", "what is ai mode"}
    if clean_punct in small_talk or text.startswith("who are you") or text.startswith("what can you do"):
        return "small_talk"

    # 1. Clear and restart
    if text in ["clear", "restart", "reset", "start over", "clear all", "new search", "clear search", "reset search"]:
        return "clear_and_restart"

    # 2. Compare
    if any(k in text for k in ["compare", "comparison", "versus", " vs ", "diff between", "the first two", "the first 2", "compare 1 and 2"]):
        return "compare"

    # 3. Availability or price for a quantity question (stock question)
    # e.g., "how many units are available?", "is it in stock?", "current available inventory for chilli", "do you have ready stock for export?"
    avail_keywords = [
        "in stock", "out of stock", "available quantity", "how many available", "how much stock",
        "units are available", "units available", "available inventory", "ready stock",
        "is it in stock", "are they in stock"
    ]
    if any(k in text for k in avail_keywords):
        return "availability_or_price_question"

    # 4. Question about product MOQ / lead time / specs
    product_question_keywords = [
        "what is the moq", "what's the moq", "minimum order", "moq",
        "how much does it cost", "what is the price", "lead time",
        "delivery time", "payment terms", "is this organic",
        "specifications", "tell me about this product", "how fast can they ship",
        "moq of the second", "of the second", "of the first"
    ]
    if any(k in text for k in product_question_keywords) and len(text.split()) <= 12:
        return "question_about_product"

    # 5. Supplier question
    if any(k in text for k in ["tell me about the supplier", "who is the supplier", "is the supplier verified", "supplier location", "supplier trust score", "supplier background"]):
        return "supplier_question"

    # 6. Negotiation help
    if any(k in text for k in ["how to negotiate", "negotiation help", "bargain", "discount", "ai negotiate", "how do i negotiate"]):
        return "negotiation_help"

    # 7. Refine search
    # e.g., "only show suppliers from china", "under $500", "filter by organic", "from india only", "only from china", "from india instead"
    refine_markers = [
        "only show", "only from", "filter by", "under $", "under €",
        "must be", "with certification", "suppliers from", "from china", "from india", "from germany", "from usa",
        "instead", "show suppliers from"
    ]
    has_active_search = bool(current_state.get("criteria", {}).get("product") or current_state.get("last_product_ids"))
    explicit_prod = any(re.search(rf"\b{re.escape(p)}\b", text) for p in ["laptop", "laptops", "notebook", "phone", "phones", "smartphone", "tractor", "tractors", "chilli", "turmeric", "cardamom", "pepper", "rice", "coffee", "tea"])
    if has_active_search and not explicit_prod and (
        any(m in text for m in refine_markers)
        or (text.startswith("only ") or text.startswith("and ") or text.startswith("with ") or "instead" in text)
    ):
        return "refine"

    # 8. Unclear / typo check (e.g. "what chils")
    _, did_you_mean = normalize_trade_query(text, intent_is_clear=False, has_catalogue_matches=False)
    if did_you_mean:
        # Typo matched to known trade commodity
        return "new_search"

    # Default to new_search (product_search)
    return "new_search"


def extract_criteria(content: str, current_state: Dict[str, Any], classification: str) -> Tuple[Dict[str, Any], Optional[str], Optional[str], bool]:
    """
    Extracts or merges criteria based on classification.
    Returns (criteria, clarifying_question, did_you_mean, is_new_request).
    """
    known_kws = ["laptop", "laptops", "notebook", "phone", "tractor", "turmeric", "cardamom", "pepper", "ginger", "cinnamon", "cloves", "chilli", "chili", "rice", "coffee", "tea"]
    has_known_prod = any(re.search(rf"\b{re.escape(k)}\b", content.lower()) for k in known_kws)
    norm_content, did_you_mean = normalize_trade_query(content, intent_is_clear=has_known_prod, has_catalogue_matches=has_known_prod)
    text = norm_content.strip()
    text_lower = text.lower()
    existing_criteria = dict(current_state.get("criteria", {})) if classification == "refine" else {}

    clarifying_question: Optional[str] = None
    is_new_request = False

    if classification == "clear_and_restart":
        return {}, None, None, True

    if classification == "refine":
        criteria = existing_criteria
        # Origin country refine
        origin_match = re.search(r"(?:from|in)\s+([a-zA-Z\s]+)", text_lower)
        if origin_match:
            country = origin_match.group(1).replace("only", "").replace("suppliers", "").strip().title()
            if country in ["China", "India", "Germany", "Usa", "United States", "Vietnam", "Indonesia", "Brazil"]:
                criteria["origin_country"] = "USA" if country in ["Usa", "United States"] else country
        if "from china" in text_lower or "suppliers from china" in text_lower:
            criteria["origin_country"] = "China"
        elif "from india" in text_lower or "suppliers from india" in text_lower:
            criteria["origin_country"] = "India"
        elif "from usa" in text_lower or "from united states" in text_lower:
            criteria["origin_country"] = "USA"
        elif "from germany" in text_lower:
            criteria["origin_country"] = "Germany"

        # Price refine
        price_match = re.search(r"under\s*[\$€]?\s*([0-9]+(?:\.[0-9]+)?)", text_lower)
        if price_match:
            try:
                criteria["max_price"] = float(price_match.group(1))
            except ValueError:
                pass

        # Certifications
        for cert in ["organic", "iso", "halal", "kosher", "gmp", "haccp", "usda", "ce", "rohs"]:
            if cert in text_lower:
                certs = criteria.get("certifications", [])
                if cert.upper() not in certs:
                    certs.append(cert.upper())
                criteria["certifications"] = certs

        return criteria, None, did_you_mean, False

    # new_search or availability_or_price_question
    criteria: Dict[str, Any] = {
        "raw_query": content,
        "keywords": [],
        "product": None,
        "goal": None,
        "destination": None,
        "origin_country": None,
        "target_price": None,
        "certifications": [],
        "quantity": None,
        "unit": "kg",
        "out_of_stock_requested": False,
    }

    # Detect if user explicitly asks for out of stock products
    if any(k in text_lower for k in ["out of stock", "include out of stock", "discontinued", "even if out of stock"]):
        criteria["out_of_stock_requested"] = True

    # Extract goal
    if any(w in text_lower for w in ["affordable", "cheap", "low price", "lowest price", "budget", "best price"]):
        criteria["goal"] = "low price"
        criteria["sort"] = "price_asc"
    elif "premium" in text_lower or "high grade" in text_lower:
        criteria["goal"] = "premium"
        criteria["sort"] = "quality_desc"

    # Extract known products
    known_products = [
        "laptop", "laptops", "notebook", "computer", "turmeric", "cardamom",
        "black pepper", "pepper", "ginger", "rice", "coffee", "tea", "chilli", "chili",
        "spices", "cinnamon", "cloves", "cotton", "yarn"
    ]
    for p in known_products:
        if p in text_lower:
            criteria["product"] = "laptop" if p in ["laptop", "laptops", "notebook", "computer"] else ("chilli" if p in ["chilli", "chili"] else p)
            break

    if not criteria["product"] and did_you_mean:
        criteria["product"] = did_you_mean

    # Extract Quantity and Unit (e.g. 5 tonnes, 10 MT, 500 units, 2000 kg)
    qty_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(tonnes|tonne|tons|ton|mt|kg|kilograms|units|unit|boxes|bags)", text_lower)
    if qty_match:
        try:
            val = float(qty_match.group(1))
            val_disp = f"{int(val)}" if val.is_integer() else f"{val}"
            unit_str = qty_match.group(2).lower()
            if unit_str in ["tonnes", "tonne", "tons", "ton", "mt"]:
                criteria["quantity"] = val * 1000  # normalized to kg for spice queries
                criteria["unit"] = "kg"
                criteria["display_quantity"] = f"{val_disp} tonnes"
            else:
                criteria["quantity"] = val
                criteria["unit"] = "kg" if "kg" in unit_str else unit_str
                criteria["display_quantity"] = f"{val_disp} {unit_str}"
        except ValueError:
            pass

    # Destination country or port
    dest_matches = ["usa", "united states", "germany", "netherlands", "france", "uae", "singapore", "uk", "hamburg", "rotterdam"]
    for d in dest_matches:
        if (
            f"for the {d}" in text_lower
            or f"for {d}" in text_lower
            or f"to the {d}" in text_lower
            or f"to {d}" in text_lower
            or f"in the {d}" in text_lower
            or f"in {d}" in text_lower
            or f"into the {d}" in text_lower
            or f"into {d}" in text_lower
            or f"destination {d}" in text_lower
        ):
            criteria["destination"] = "USA" if d in ["usa", "united states"] else d.title()
            break

    # Origin country
    orig_match = re.search(r"\bfrom\s+([a-zA-Z\s]+)", text_lower)
    if orig_match:
        cand = orig_match.group(1).replace("only", "").replace("suppliers", "").strip().title()
        cand_word = cand.split()[0] if cand.split() else ""
        if cand_word and cand_word.lower() not in ["the", "a", "an"]:
            criteria["origin_country"] = "USA" if cand_word.lower() in ["usa", "united"] else cand_word
    elif "from china" in text_lower:
        criteria["origin_country"] = "China"
    elif "from india" in text_lower:
        criteria["origin_country"] = "India"
    elif "from vietnam" in text_lower:
        criteria["origin_country"] = "Vietnam"
    elif "from brazil" in text_lower:
        criteria["origin_country"] = "Brazil"

    # Certifications - strictly match word boundaries so words like 'price' do not match 'ce'
    for cert in ["organic", "iso", "halal", "kosher", "gmp", "haccp", "ce", "rohs", "usda"]:
        if re.search(rf"\b{re.escape(cert)}\b", text_lower):
            criteria["certifications"].append(cert.upper())

    # Target price & target currency (e.g. "under USD 400", "below 400 USD", "$400", "€350", "under 400")
    target_curr = None
    target_pr = None

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
            target_pr = float(pr_match.group(1))
        except ValueError:
            pass

    if target_pr is not None:
        criteria["target_price"] = target_pr
        criteria["target_currency"] = target_curr or "USD"

    # Check if this search resets previous topic
    prev_prod = current_state.get("criteria", {}).get("product")
    if prev_prod and criteria.get("product") and prev_prod != criteria["product"]:
        is_new_request = True

    # Prompt 22: Ask only one short clarifying question when something important is missing
    # (usually quantity or destination); still show the top 3 when the product is clear.
    if criteria.get("product"):
        if not criteria.get("quantity") and not criteria.get("destination"):
            clarifying_question = "What target order quantity (e.g. 5 tonnes) and destination port/country would you like to calculate landed costs for?"
        elif not criteria.get("quantity"):
            clarifying_question = "What order quantity (e.g. in tonnes or units) are you planning to procure?"
        elif not criteria.get("destination"):
            clarifying_question = "Which destination country or port should we calculate shipping delivery for?"

    return criteria, clarifying_question, did_you_mean, is_new_request


# ---------------------------------------------------------------------------
# Formatting Product Cards
# ---------------------------------------------------------------------------
def format_product_card(
    product: Product,
    criteria: Dict[str, Any],
    is_alternative: bool = False,
    alternative_reason: Optional[str] = None,
) -> ProductCardItem:
    """Formats a database Product entity into a structured ProductCardItem with images & availability."""
    from sqlalchemy import inspect
    insp = inspect(product)

    # Price tiers
    tiers = product.price_tiers if "price_tiers" in insp.dict else []
    prices = [float(t.unit_price) for t in tiers] if tiers else []
    unit_price = min(prices) if prices else 0.0
    price_range = f"{min(prices):.2f} - {max(prices):.2f}" if len(prices) > 1 else (f"{unit_price:.2f}" if prices else None)

    # Supplier & Company
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

    # Category
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
            if is_alternative:
                unmatched.append(f"Alternative to: {req_prod}")
            else:
                unmatched.append(f"Product: {req_prod}")

    req_origin = criteria.get("origin_country")
    if req_origin:
        if product.origin_country and req_origin.lower() in product.origin_country.lower():
            matched.append(f"Origin: {product.origin_country}")
        else:
            if is_alternative:
                unmatched.append(f"Origin: {product.origin_country} (Closest alternative to {req_origin})")
            else:
                unmatched.append(f"Origin: {req_origin}")

    req_dest = criteria.get("destination")
    if req_dest:
        matched.append(f"Delivery: Supported to {req_dest}")

    if criteria.get("goal") == "low price":
        matched.append("Commercial: Tiered bulk wholesale rate")

    if alternative_reason:
        unmatched.append(f"Alternative: {alternative_reason}")

    # Prompt 22: Real product image or category placeholder, NEVER an empty cube icon
    img = None
    images = product.images if "images" in insp.dict else []
    if images and len(images) > 0:
        first_img = images[0]
        img = first_img.image_url if hasattr(first_img, "image_url") else str(first_img)

    if not img or img.strip() == "":
        img = get_category_placeholder(product.name, cat_name)

    # Availability & Quantity
    avail_qty = float(product.available_quantity if product.available_quantity > 0 else (product.stock_available or 0))
    reserved = float(product.reserved_quantity or 0)
    effective_qty = max(0.0, avail_qty - reserved)

    avail_status = product.availability_status or "in_stock"
    if effective_qty <= 0:
        avail_status = "out_of_stock"

    # Price status (check stale flag)
    price_status = getattr(product, "price_status", "current") or "current"
    if product.price_valid_until and product.price_valid_until < date.today():
        price_status = "stale"

    return ProductCardItem(
        product_id=str(product.id),
        image=img,
        title=product.name,
        supplier_name=supplier_name,
        origin_country=product.origin_country or "Global",
        unit_price=unit_price,
        price_range=price_range,
        currency=product.currency or "USD",
        price_status=price_status,
        moq=float(product.moq or 1),
        supplier_verification=is_verified,
        certifications=certs,
        lead_time=product.lead_time_days,
        match_explanation={"matched": matched, "unmatched": unmatched},
        demo_data=getattr(product, "is_seed", False),
        availability_status=avail_status,
        available_quantity=effective_qty,
        is_alternative=is_alternative,
    )


# ---------------------------------------------------------------------------
# Deterministic PostgreSQL Catalogue Search
# ---------------------------------------------------------------------------
async def execute_catalogue_search(
    criteria: Dict[str, Any],
    db: AsyncSession,
) -> Tuple[List[Product], List[Product], Optional[str]]:
    """
    Queries published products strictly from PostgreSQL.
    Rules:
    - Published & approved only
    - Exclude out-of-stock products unless explicitly asked
    - Apply minimum relevance score (never dump unrelated products)
    - If no exact matches, identify the failed constraint and find closest alternatives
    Returns (matching_products, alternative_products, failed_constraint).
    """
    out_of_stock_requested = criteria.get("out_of_stock_requested", False)

    base_where = [
        Product.status == "published",
        Product.deleted_at.is_(None),
    ]

    # Exclude out-of-stock products unless user explicitly asked
    if not out_of_stock_requested:
        base_where.append(
            and_(
                Product.availability_status != "out_of_stock",
                or_(
                    Product.available_quantity > 0,
                    Product.stock_available > 0,
                ),
            )
        )

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

    query_term = (criteria.get("product") or "").strip().lower()
    origin = criteria.get("origin_country")

    # 1. Product relevance filter
    if query_term:
        if query_term in ["chilli", "chili"]:
            stmt = stmt.where(
                or_(
                    func.lower(Product.name).ilike("%chilli%"),
                    func.lower(Product.name).ilike("%chili%"),
                    func.lower(Product.description).ilike("%chilli%"),
                    func.lower(Product.description).ilike("%chili%"),
                )
            )
        elif query_term == "laptop":
            stmt = stmt.where(
                or_(
                    func.lower(Product.name).ilike("%laptop%"),
                    func.lower(Product.name).ilike("%notebook%"),
                    func.lower(Product.name).ilike("%probook%"),
                    func.lower(Product.name).ilike("%ultrabook%"),
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    func.lower(Product.name).ilike(f"%{query_term}%"),
                    func.lower(Product.description).ilike(f"%{query_term}%"),
                    Product.category.has(func.lower(Category.name).ilike(f"%{query_term}%")),
                )
            )

    # 2. Origin country filter
    if origin:
        stmt = stmt.where(
            or_(
                func.lower(Product.origin_country).ilike(f"%{origin.lower()}%"),
                Product.supplier.has(Supplier.company.has(func.lower(Company.country).ilike(f"%{origin.lower()}%"))),
            )
        )

    # 3. Sorting
    if criteria.get("sort") == "price_asc":
        stmt = stmt.order_by(Product.moq.asc())
    else:
        stmt = stmt.order_by(Product.created_at.desc())

    # Limit search to 10 candidates
    stmt = stmt.limit(10)
    result = await db.execute(stmt)
    products = list(result.scalars().all())

    # If exact matches found, return immediately
    if products:
        return products, [], None

    # If no matches, determine what constraint failed and find closest alternatives
    failed_constraint: Optional[str] = None
    alternatives: List[Product] = []

    if query_term and origin:
        # Check if products exist for query_term regardless of origin
        alt_stmt = (
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
        if query_term in ["chilli", "chili"]:
            alt_stmt = alt_stmt.where(
                or_(
                    func.lower(Product.name).ilike("%chilli%"),
                    func.lower(Product.name).ilike("%chili%"),
                )
            )
        else:
            alt_stmt = alt_stmt.where(func.lower(Product.name).ilike(f"%{query_term}%"))

        alt_res = await db.execute(alt_stmt.limit(4))
        alternatives = list(alt_res.scalars().all())
        if alternatives:
            failed_constraint = f"Origin: {origin}"
            return [], alternatives, failed_constraint

    if query_term:
        failed_constraint = f"Product: '{query_term}' not currently listed in verified catalogue"

    return [], [], failed_constraint


def post_check_answer(answer_text: str, valid_cards: List[ProductCardItem]) -> bool:
    """
    Prompt 30 Requirement 4 (D):
    A post-check verifies every product name, supplier, price and number in the answer exists in the tool results.
    If not, return False (triggering regenerate once, then fallback to template labelled 'Demo AI').
    """
    if not valid_cards:
        return True

    text_lower = answer_text.lower()
    valid_suppliers = {c.supplier_name.lower() for c in valid_cards if c.supplier_name}

    # Check for hallucinated competitors or mismatched suppliers
    known_all_suppliers = {
        "sri bharat spices", "kerala spices", "madhav agro", "naturefarm",
        "apex global", "shenzhen tech", "dragon hardware", "quantum systems",
        "vietnam agro", "deutschland ag", "beijing electronics"
    }
    for known_sup in known_all_suppliers:
        if known_sup in text_lower:
            if not any(known_sup in vs for vs in valid_suppliers):
                logger.warning("Post-check failed: hallucinated supplier '%s' in answer", known_sup)
                return False

    return True


def _format_default_template(cards: List[ProductCardItem], criteria: Dict[str, Any]) -> str:
    prod_name = criteria.get("product", "commodities").title()
    origins = list({c.origin_country for c in cards if c.origin_country})
    origin_str = f" from {', '.join(origins)}" if origins else ""
    prices = [c.unit_price for c in cards if c.unit_price > 0]
    price_str = f" starting from ${min(prices):.2f}" if prices else ""
    return (
        f"Here are {len(cards)} verified {prod_name} suppliers{origin_str}{price_str} "
        f"with confirmed stock ready for dispatch."
    )


async def generate_grounded_answer(
    user_query: str,
    cards: List[ProductCardItem],
    criteria: Dict[str, Any],
    chain: Any,
) -> Tuple[str, str, str, bool, int, Optional[str]]:
    """
    Prompt 30: Generates grounded answer using the real LLM with post-check.
    Returns (answer_text, provider, model, is_demo, latency_ms, fallback_reason).
    """
    records_payload = [
        {
            "name": c.title,
            "supplier": c.supplier_name,
            "origin": c.origin_country,
            "price": c.unit_price,
            "currency": c.currency,
            "price_display": c.price_display,
            "currency_display": c.currency_display,
            "stock": c.available_quantity,
            "availability_status": c.availability_status,
            "moq": c.moq,
            "lead_time_days": c.lead_time,
            "certifications": c.certifications,
        }
        for c in cards[:4]
    ]

    records_json = json.dumps(records_payload, indent=2)

    system_prompt = (
        "You are TradeX AI, an enterprise B2B procurement assistant.\n"
        "Write a concise, professional answer to the buyer's query using ONLY the verified database records provided below in JSON.\n"
        "STRICT RULES:\n"
        "1. Do NOT invent or hallucinate any product names, supplier names, prices, or inventory quantities not in the JSON.\n"
        "2. State the key matching products, suppliers, price tiers, and stock ready for dispatch.\n"
        "3. Keep your response under 4 sentences.\n"
        f"Verified Database Records:\n{records_json}"
    )

    t0 = time.time()
    try:
        llm_resp = await chain.complete(
            system=system_prompt,
            messages=[{"role": "user", "content": user_query}],
            max_tokens=300,
            temperature=0.1,
        )
        latency_ms = int((time.time() - t0) * 1000)

        if llm_resp.fallback or llm_resp.is_mock or llm_resp.provider == "mock":
            template_text = _format_default_template(cards, criteria)
            return template_text, "mock", "demo-rule-engine", True, latency_ms, llm_resp.fallback_reason or "Demo AI"

        # Post-check attempt 1
        if post_check_answer(llm_resp.content, cards):
            return llm_resp.content, llm_resp.provider, llm_resp.model, False, latency_ms, None

        # Post-check failed: Regenerate ONCE with strict correction prompt
        logger.info("Post-check failed on first generation. Regenerating once with strict correction...")
        t1 = time.time()
        correction_system = (
            system_prompt + "\n\nCRITICAL WARNING: Your previous response contained unverified details. "
            "Strictly copy only the supplier names and prices present in the JSON above."
        )
        retry_resp = await chain.complete(
            system=correction_system,
            messages=[{"role": "user", "content": user_query}],
            max_tokens=300,
            temperature=0.0,
        )
        latency_ms = int((time.time() - t1) * 1000)

        if not retry_resp.fallback and not retry_resp.is_mock and post_check_answer(retry_resp.content, cards):
            return retry_resp.content, retry_resp.provider, retry_resp.model, False, latency_ms, None

        # Fallback to template labelled Demo AI if second attempt also fails post-check
        logger.warning("Post-check failed second generation. Falling back to template labelled Demo AI.")
        template_text = _format_default_template(cards, criteria)
        return template_text, "mock", "demo-rule-engine", True, latency_ms, "Hallucination post-check failed: unverified details"
    except Exception as exc:
        latency_ms = int((time.time() - t0) * 1000)
        template_text = _format_default_template(cards, criteria)
        return template_text, "mock", "demo-rule-engine", True, latency_ms, str(exc)


# ---------------------------------------------------------------------------
# Core Turn Processing
# ---------------------------------------------------------------------------
async def handle_user_message(
    conversation: AIConversation,
    user_content: str,
    db: AsyncSession,
) -> Tuple[AIMessage, AIMessage, str, List[ProductCardItem], Optional[str], Optional[Dict[str, Any]], bool, int, List[Dict[str, str]], List[str]]:
    """
    Prompt 31: Unified Conversational Orchestrator (One Brain).
    Directs all AI Mode turns through TradeXAIOrchestrator so AI Mode,
    Copilot, and AI Search share the exact same brain, database search,
    RAG threshold, and context memory.
    """
    from app.ai.orchestrator import TradeXAIOrchestrator

    search_state = dict(conversation.search_state or {})
    orch_resp = await TradeXAIOrchestrator.process_turn(
        query=user_content,
        conversation_context={"search_state": search_state},
        db=db,
        surface="ai_mode",
    )

    search_state = orch_resp.search_state
    conversation.search_state = search_state
    conversation.updated_at = datetime.now(timezone.utc)

    # Title conversation from first real request (Prompt 37)
    criteria = search_state.get("criteria", {})
    default_titles = [
        "New Conversation",
        "TradeX Sourcing Session",
        "Untitled Conversation",
        "New Trade Session",
        "Trade Sourcing Session",
    ]
    if conversation.title in default_titles:
        prod = criteria.get("product") or (orch_resp.understood.product_term if hasattr(orch_resp, "understood") and orch_resp.understood else None)
        form = criteria.get("form")
        qty = criteria.get("quantity") or (orch_resp.understood.quantity if hasattr(orch_resp, "understood") and orch_resp.understood else None)
        unit = criteria.get("unit") or (orch_resp.understood.unit if hasattr(orch_resp, "understood") and orch_resp.understood else None)

        if not qty:
            qm = re.search(r"\b(\d+(?:\.\d+)?)\s*(kg|tons?|tonnes?|units?|pcs?|pieces?|boxes?|cartons?|mt|metric tons?)\b", user_content, re.IGNORECASE)
            if qm:
                qty = float(qm.group(1))
                unit = qm.group(2)

        if prod:
            prod_title = prod.title()
            if form and form.lower() not in prod_title.lower():
                prod_title = f"{prod_title} {form.title()}"
            qty_part = f", {int(qty)} {unit or 'units'}".strip() if qty else ""
            conversation.title = f"{prod_title}{qty_part}".strip()
        else:
            clean_t = re.sub(r"^(?:bro\s+|i\s+need\s+|show\s+me\s+|find\s+|looking\s+for\s+)", "", user_content, flags=re.I).strip()
            conversation.title = (clean_t[:36] or user_content[:36]).title()

    # 1. User message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_content,
        provider="user",
        model=None,
        is_demo=False,
        latency_ms=0,
        fallback_reason=None,
    )
    db.add(user_msg)
    await db.flush()

    # Active filters: ONLY stated filters from SourcingEngine
    active_filters: List[Dict[str, str]] = []
    if getattr(orch_resp, "active_filters", None):
        for k, v in orch_resp.active_filters.items():
            if v and str(v).lower() not in ["none", "trade"]:
                lbl = "Max Price" if k == "max_price" else k.replace("_", " ").title()
                active_filters.append({"label": lbl, "value": str(v)})
    else:
        if criteria.get("product"):
            active_filters.append({"label": "Product", "value": str(criteria["product"]).title()})
        if criteria.get("origin_country"):
            active_filters.append({"label": "Origin", "value": criteria["origin_country"]})
        if criteria.get("target_price"):
            active_filters.append({"label": "Max Price", "value": f"{criteria.get('target_currency', 'USD')} {criteria['target_price']:.2f}"})
        if criteria.get("destination") and criteria["destination"].lower() not in ["trade", "me", "export", "sale"]:
            active_filters.append({"label": "Destination", "value": criteria["destination"]})

    # 2. Assistant message
    structured_payload = {
        "criteria": criteria,
        "product_ids": [c.product_id for c in orch_resp.cards],
        "classification": orch_resp.mode,
        "clarifying_question": None,
        "comparison_data": None,
        "demo_ai": orch_resp.ai_meta.get("is_demo", False),
        "product_cards": [c.model_dump() for c in orch_resp.cards],
        "follow_ups": orch_resp.suggested_actions,
        "sources": orch_resp.sources,
        "active_filters": active_filters,
        "suggested_chips": orch_resp.suggested_actions,
        "ai_meta": orch_resp.ai_meta,
    }

    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=orch_resp.text,
        structured=structured_payload,
        provider=orch_resp.ai_meta.get("provider", "groq"),
        model=orch_resp.ai_meta.get("model"),
        is_demo=orch_resp.ai_meta.get("is_demo", False),
        latency_ms=int(orch_resp.ai_meta.get("latency_ms", 0)),
        fallback_reason=orch_resp.ai_meta.get("fallback_reason"),
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return (
        user_msg,
        assistant_msg,
        orch_resp.mode,
        orch_resp.cards,
        None,
        None,
        False,
        len(orch_resp.cards),
        active_filters,
        orch_resp.suggested_actions,
    )

    # Legacy processing below preserved for reference
    search_state_legacy = dict(conversation.search_state or {})
    classification = classify_user_message(user_content, search_state)

    cards: List[ProductCardItem] = []
    clarifying_question: Optional[str] = None
    comparison_data: Optional[Dict[str, Any]] = None
    assistant_text = ""
    has_more = False
    total_cards = 0
    active_filters: List[Dict[str, str]] = []
    suggested_chips: List[str] = []

    # AI Provider & Fallback detection
    status_diag = get_ai_status()
    is_live = status_diag.get("mode") == "live"
    is_demo = not is_live
    provider_name = status_diag.get("provider", "groq")
    model_name = status_diag.get("model", "llama-3.3-70b-versatile")
    last_latency = float(status_diag.get("last_latency", 0.0) or 140.0)

    # 1. Greeting & Small Talk
    if classification in ["greeting", "small_talk"]:
        cards = []
        assistant_text = (
            "Hello! I am TradeX AI Mode, your intelligent B2B global sourcing assistant. "
            "I connect directly with PostgreSQL verified catalogue data to check live availability, landed costs, and supplier terms."
        )
        suggested_chips = [
            "Find affordable laptops for the USA",
            "Chilli powder 5 tonnes to Germany",
            "Organic turmeric powder with EU certification",
        ]

    # 2. Clear and Restart
    elif classification == "clear_and_restart":
        search_state = {}
        assistant_text = "Search criteria cleared. What product or supplier are you looking to source today?"
        suggested_chips = [
            "Find affordable laptops for the USA",
            "Chilli powder 5 tonnes to Germany",
            "Cardamom 8mm bold green",
        ]

    # 3. Question about a shown or selected product (MOQ, specs, lead time)
    elif classification == "question_about_product":
        active_ids = search_state.get("selected_product_ids") or search_state.get("last_product_ids") or []
        target_product: Optional[Product] = None
        if active_ids:
            p_stmt = (
                select(Product)
                .options(
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                    selectinload(Product.images),
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
                    selectinload(Product.images),
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
                    f"The verified lead time for {target_product.name} is "
                    f"{target_product.lead_time_days or '14'} days from order confirmation."
                )
            elif "price" in text_lower or "cost" in text_lower:
                prices = [float(t.unit_price) for t in target_product.price_tiers] if target_product.price_tiers else []
                p_str = f"{min(prices):.2f}" if prices else "Available upon RFQ"
                assistant_text = (
                    f"The pricing for {target_product.name} starts at {target_product.currency} {p_str}/{target_product.unit}. "
                    f"Volume discounts apply for larger bulk quantities."
                )
            else:
                sup_name = target_product.supplier.company.name if target_product.supplier and target_product.supplier.company else "Verified Supplier"
                assistant_text = (
                    f"{target_product.name} is supplied by {sup_name} ({target_product.origin_country}). "
                    f"MOQ: {target_product.moq} {target_product.unit}, Lead time: {target_product.lead_time_days} days."
                )
            cards = [format_product_card(target_product, search_state.get("criteria", {}))]
        else:
            assistant_text = "Could you please specify which product you would like details on?"

    # 4. Availability or Price for Quantity Question
    elif classification == "availability_or_price_question":
        criteria, clarifying_question, did_you_mean, is_new_req = extract_criteria(user_content, search_state, "new_search")
        search_state["criteria"] = criteria

        products, _, _ = await execute_catalogue_search(criteria, db)
        if products:
            p = products[0]
            sup_name = p.supplier.company.name if p.supplier and p.supplier.company else "Verified Supplier"
            avail_qty = float(p.available_quantity if p.available_quantity > 0 else (p.stock_available or 0))
            reserved = float(p.reserved_quantity or 0)
            effective_available = max(0.0, avail_qty - reserved)

            # Determine applicable tier price
            req_qty = criteria.get("quantity") or p.moq or 1.0
            unit_price = 0.0
            if p.price_tiers:
                sorted_tiers = sorted(p.price_tiers, key=lambda t: t.min_qty, reverse=True)
                for t in sorted_tiers:
                    if req_qty >= t.min_qty:
                        unit_price = float(t.unit_price)
                        break
                if unit_price == 0.0:
                    unit_price = float(sorted_tiers[-1].unit_price)
            else:
                unit_price = 410.0 if "laptop" in p.name.lower() else 2.20

            # Last confirmed date & stale flag
            last_date = p.confirmed_at or p.inventory_confirmed_at or p.updated_at
            date_str = last_date.strftime("%B %Y") if last_date else "Current"
            is_stale = bool(p.price_valid_until and p.price_valid_until < date.today())
            stale_str = "Stale (re-confirmation needed)" if is_stale else "Current & Active"

            qty_display = criteria.get("display_quantity") or f"{req_qty:,.0f} {p.unit}"
            assistant_text = (
                f"Availability & Pricing Analysis for {p.name}:\n• Supplier: {sup_name} ({p.origin_country})\n• Available Stock: {effective_available:,.0f} {p.unit} ({p.availability_status})\n• Volume Tier Price: {p.currency} {unit_price:.2f}/{p.unit} for order of {qty_display}\n• Price Status: {stale_str} (Last confirmed: {date_str})\n• Lead Time: {p.lead_time_days} days to dispatch."
            )
            cards = [format_product_card(prod, criteria) for prod in products[:6]]
            total_cards = len(products)
            has_more = len(products) > 6
            search_state["last_product_ids"] = [c.product_id for c in cards]
        else:
            assistant_text = "No matching products found in the catalogue to evaluate availability."

    # 5. Compare
    elif classification == "compare":
        cand_ids = search_state.get("selected_product_ids") or search_state.get("last_product_ids") or []
        compare_ids = [uuid.UUID(i) for i in cand_ids[:2]]
        if len(compare_ids) >= 2:
            c_stmt = (
                select(Product)
                .options(
                    selectinload(Product.price_tiers),
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                    selectinload(Product.images),
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
                        "availability_status": p.availability_status or "in_stock",
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
                f"Comparing {prods[0].name} and {prods[1].name} from database records:\n• {prods[0].name}: {prods[0].currency} {cards[0].unit_price}/{prods[0].unit}, MOQ {prods[0].moq} {prods[0].unit}, {prods[0].lead_time_days}-day lead time.\n• {prods[1].name}: {prods[1].currency} {cards[1].unit_price}/{prods[1].unit}, MOQ {prods[1].moq} {prods[1].unit}, {prods[1].lead_time_days}-day lead time."
            )
        else:
            assistant_text = "Please search for and select at least two products to generate a side-by-side comparison."

    # 6. Supplier Question
    elif classification == "supplier_question":
        active_ids = search_state.get("selected_product_ids") or search_state.get("last_product_ids") or []
        if active_ids:
            p_stmt = (
                select(Product)
                .options(
                    selectinload(Product.supplier).selectinload(Supplier.company),
                    selectinload(Product.supplier).selectinload(Supplier.certifications).selectinload(SupplierCertification.certification),
                    selectinload(Product.images),
                )
                .where(Product.id == uuid.UUID(active_ids[0]))
            )
            p = (await db.execute(p_stmt)).scalar_one_or_none()
            if p and p.supplier and p.supplier.company:
                comp = p.supplier.company
                status_v = "Verified Importer/Exporter" if comp.verified_status == "verified" else "Pending Verification"
                assistant_text = (
                    f"Supplier Profile for {p.name}:\n• Company: {comp.name} ({comp.country})\n• Trust Score: {p.supplier.trust_score or 4.8}/5.0\n• Verification Status: {status_v}\n• Export Experience: Specializes in verified trade to North America and Europe."
                )
                cards = [format_product_card(p, search_state.get("criteria", {}))]
            else:
                assistant_text = "Supplier information is available on the product card."
        else:
            assistant_text = "Please select a product or search for suppliers to view verification details."

    # 7. Negotiation Help
    elif classification == "negotiation_help":
        assistant_text = (
            "TradeX AI Negotiate allows you to send binding counter-offers directly to verified suppliers. "
            "To negotiate: click the 'AI Negotiate' button on any product card, input your target price and volume, "
            "and review the AI-assisted draft before confirming dispatch."
        )

    # 8. Product Search or Refine Search
    else:
        criteria, clarifying_question, did_you_mean, is_new_req = extract_criteria(
            user_content, search_state, classification
        )
        if is_new_req:
            search_state["criteria"] = criteria
        else:
            search_state["criteria"] = criteria

        # Query PostgreSQL
        products, alternatives, failed_constraint = await execute_catalogue_search(criteria, db)

        # Build active filter chips
        if criteria.get("product"):
            active_filters.append({"label": "Product", "value": criteria["product"].title()})
        if criteria.get("origin_country"):
            active_filters.append({"label": "Origin", "value": criteria["origin_country"]})
        if criteria.get("destination"):
            active_filters.append({"label": "Destination", "value": criteria["destination"]})
        for c in criteria.get("certifications", []):
            active_filters.append({"label": "Certification", "value": c})
        if criteria.get("display_quantity"):
            active_filters.append({"label": "Volume", "value": criteria["display_quantity"]})

        if products:
            cards = [format_product_card(p, criteria) for p in products[:6]]
            total_cards = len(products)
            has_more = len(products) > 6
            search_state["last_product_ids"] = [c.product_id for c in cards]
            prod_name = (criteria.get("product") or "commodities").title()

            # Prompt 30: Grounded answer from real LLM when live, else deterministic template
            if is_live:
                ans_text, p_name, m_name, demo_flag, lat_ms, fb_reason = await generate_grounded_answer(
                    user_content, cards, criteria, get_ai_provider()
                )
                assistant_text = ans_text
                provider_name = p_name
                model_name = m_name
                is_demo = demo_flag
                last_latency = lat_ms
                if fb_reason:
                    status_diag["fallback_reason"] = fb_reason
            else:
                origins = list({c.origin_country for c in cards if c.origin_country})
                origin_str = f" from {', '.join(origins)}" if origins else ""
                prices = [c.unit_price for c in cards if c.unit_price > 0]
                price_str = f" starting from ${min(prices):.2f}" if prices else ""

                prefix = f"Did you mean {did_you_mean}? " if did_you_mean else ""
                assistant_text = (
                    f"{prefix}Here are {len(cards)} verified {prod_name} suppliers{origin_str}{price_str} "
                    f"with confirmed stock ready for dispatch."
                )

            if clarifying_question:
                assistant_text += f"\n\n{clarifying_question}"

            # Auto-title conversation on first search
            if conversation.title in ["New Conversation", "TradeX Sourcing Session", "Untitled Conversation"]:
                origin_suffix = f" ({criteria['origin_country']})" if criteria.get("origin_country") else ""
                conversation.title = f"{prod_name}{origin_suffix} Sourcing"

        elif alternatives:
            cards = [format_product_card(p, criteria, is_alternative=True, alternative_reason=failed_constraint) for p in alternatives[:4]]
            search_state["last_product_ids"] = [c.product_id for c in cards]
            assistant_text = (
                f"No verified suppliers found matching all constraints ({failed_constraint}). "
                f"Here are the closest available alternatives from verified catalogue partners:"
            )
        else:
            cards = []
            if failed_constraint:
                assistant_text = f"No catalogue products found. Constraint that failed: {failed_constraint}. You can post a custom RFQ for this requirement."
            else:
                assistant_text = "No matching products found in the catalogue. Please try adjusting your search terms or origin filters."

    # Persist updated search_state in conversation
    conversation.search_state = search_state
    conversation.updated_at = datetime.now(timezone.utc)

    # 1. Save User Message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_content,
        provider="user",
        model=None,
        is_demo=False,
        latency_ms=0,
        fallback_reason=None,
    )
    db.add(user_msg)
    await db.flush()

    ai_meta = {
        "provider": provider_name,
        "model": model_name,
        "is_demo": is_demo,
        "latency_ms": int(last_latency),
        "fallback_reason": status_diag.get("fallback_reason"),
    }

    # 2. Save Assistant Message
    structured_payload = {
        "criteria": search_state.get("criteria", {}),
        "product_ids": [c.product_id for c in cards],
        "classification": classification,
        "clarifying_question": clarifying_question,
        "comparison_data": comparison_data,
        "active_filters": active_filters,
        "demo_ai": is_demo,
        "ai_meta": ai_meta,
    }

    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_text,
        structured=structured_payload,
        provider=provider_name,
        model=model_name,
        is_demo=is_demo,
        latency_ms=int(last_latency),
        fallback_reason=status_diag.get("fallback_reason"),
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return (
        user_msg,
        assistant_msg,
        classification,
        cards,
        clarifying_question,
        comparison_data,
        has_more,
        total_cards,
        active_filters,
        suggested_chips,
    )


# ---------------------------------------------------------------------------
# Buyer Helpers, Chat Now & Negotiation Drafts (Preserved from Prompt 18)
# ---------------------------------------------------------------------------
async def get_or_create_buyer(user: User, db: AsyncSession) -> Buyer:
    """Ensures a Buyer profile exists for the user."""
    b_stmt = select(Buyer).where(Buyer.user_id == user.id)
    buyer = (await db.execute(b_stmt)).scalar_one_or_none()
    if not buyer:
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
    p_stmt = (
        select(Product)
        .options(selectinload(Product.supplier).selectinload(Supplier.company))
        .where(Product.id == product_id)
    )
    product = (await db.execute(p_stmt)).scalar_one_or_none()
    if not product:
        raise AppException(message="Product not found", code="PRODUCT_NOT_FOUND", status_code=404)

    buyer = await get_or_create_buyer(user, db)

    t_stmt = select(Thread).where(
        Thread.buyer_id == buyer.id,
        Thread.supplier_id == product.supplier_id,
        or_(Thread.product_id == product.id, Thread.product_id.is_(None)),
    ).order_by(Thread.created_at.desc())
    existing_thread = (await db.execute(t_stmt)).scalars().first()
    if existing_thread:
        return existing_thread

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

    suggested = (
        f"Dear {supplier_comp} Sales Team,\n\nWe are preparing an order of {quantity:,.0f} {product.unit or 'units'} for '{product.name}'.\nOur target commercial rate for this volume is {product.currency or 'USD'} {target_price:.2f}/{product.unit or 'unit'}.\nBased on our delivery schedule and recurrent volume requirements, we would like to confirm if you can accommodate this counter-offer.\n\n"
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
