import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_ops import SystemSetting

DEFAULT_MATCHING_WEIGHTS: Dict[str, float] = {
    "product_relevance": 25.0,
    "certifications": 15.0,
    "moq_fit": 10.0,
    "capacity": 10.0,
    "delivery": 10.0,
    "price": 15.0,
    "reliability": 15.0,
}

SYSTEM_SETTING_WEIGHTS_KEY = "matching_weights"


def parse_numeric_capacity(capacity_str: Optional[str]) -> float:
    """Parses capacity strings like '80 MT/month' into kg or units."""
    if not capacity_str:
        return 0.0
    val_str = re.sub(r"[^\d.]", "", capacity_str)
    try:
        val = float(val_str)
    except ValueError:
        return 0.0

    lower = capacity_str.lower()
    if "mt" in lower or "metric ton" in lower or "tons" in lower:
        return val * 1000.0  # Convert to kg
    return val


def normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Validates and ensures weights maintain correct factor proportions."""
    result = dict(DEFAULT_MATCHING_WEIGHTS)
    for k, v in weights.items():
        if k in result:
            result[k] = max(0.0, float(v))
    total = sum(result.values())
    if total <= 0:
        return dict(DEFAULT_MATCHING_WEIGHTS)
    return result


async def get_matching_weights(session: AsyncSession) -> Dict[str, float]:
    """Retrieves weights from system_settings or returns default weights."""
    stmt = select(SystemSetting).where(SystemSetting.key == SYSTEM_SETTING_WEIGHTS_KEY)
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()
    if setting and setting.value and isinstance(setting.value, dict):
        return normalize_weights(setting.value)
    return dict(DEFAULT_MATCHING_WEIGHTS)


async def set_matching_weights(session: AsyncSession, weights: Dict[str, float]) -> Dict[str, float]:
    """Saves updated weights into system_settings."""
    normalized = normalize_weights(weights)
    stmt = select(SystemSetting).where(SystemSetting.key == SYSTEM_SETTING_WEIGHTS_KEY)
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()
    if not setting:
        setting = SystemSetting(
            key=SYSTEM_SETTING_WEIGHTS_KEY,
            value=normalized,
            description="Configurable weights for the AI Supplier Matching Engine",
        )
        session.add(setting)
    else:
        setting.value = normalized
    await session.commit()
    return normalized


def calculate_supplier_match(
    supplier: Dict[str, Any],
    requirement: Dict[str, Any],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Pure Python, deterministic calculation scoring a supplier from 0 to 100 against trade requirements.
    
    Factors:
    1. Product relevance (25 pts)
    2. Certifications (15 pts)
    3. MOQ fit (10 pts)
    4. Capacity (10 pts)
    5. Delivery (10 pts)
    6. Price (15 pts)
    7. Reliability (15 pts)
    """
    w = normalize_weights(weights or DEFAULT_MATCHING_WEIGHTS)
    total_w = sum(w.values()) or 100.0

    breakdown: Dict[str, float] = {}
    reasons: List[str] = []
    risks: List[str] = []

    req_product = (requirement.get("product") or "").strip().lower()
    req_category = (requirement.get("category") or "").strip().lower()
    req_hs = (requirement.get("hs_code") or "").strip()
    req_qty = float(requirement.get("quantity") or 0.0)
    req_unit = requirement.get("unit") or "kg"
    req_certs = [c.strip().lower() for c in requirement.get("certifications", []) if c]
    req_dest = (requirement.get("destination_country") or "").strip().lower()
    req_deadline = float(requirement.get("delivery_days") or requirement.get("lead_time_days") or 45.0)
    req_target_min = requirement.get("target_price_min")
    req_target_max = requirement.get("target_price_max")

    # 1. Product Relevance (max w['product_relevance'])
    prod_w = w["product_relevance"]
    supp_products = supplier.get("products", [])
    supp_main_prods = [p.lower() for p in supplier.get("main_products", [])]
    supp_categories = [c.lower() for c in supplier.get("categories", [])]
    supp_hs_codes = [h for h in supplier.get("hs_codes", []) if h]

    relevance_score = 0.0
    matched_prod_name = None
    req_words = {w for w in re.findall(r"\w+", req_product) if len(w) > 2}

    # Check products
    for p in supp_products:
        p_name = (p.get("name") or "").lower()
        p_cat = (p.get("category_name") or "").lower()
        p_hs = (p.get("hs_code") or "").strip()
        p_words = {w for w in re.findall(r"\w+", p_name) if len(w) > 2}
        common = req_words.intersection(p_words)

        if req_product and (req_product in p_name or p_name in req_product or common):
            matched_prod_name = p.get("name")
            relevance_score += prod_w * (0.6 if (req_product in p_name or p_name in req_product) else 0.5)
            break
        if req_category and (req_category in p_cat or p_cat in req_category):
            relevance_score += prod_w * 0.4
            break

    if not matched_prod_name:
        for mp in supp_main_prods:
            mp_words = {w for w in re.findall(r"\w+", mp) if len(w) > 2}
            common = req_words.intersection(mp_words)
            if req_product and (req_product in mp or mp in req_product or common):
                matched_prod_name = mp
                relevance_score += prod_w * (0.5 if (req_product in mp or mp in req_product) else 0.4)
                break

    # Category match
    if req_category and any(req_category in sc for sc in supp_categories):
        relevance_score += prod_w * 0.3

    # HS code match
    if req_hs:
        if any(req_hs.startswith(sh[:4]) or sh.startswith(req_hs[:4]) for sh in supp_hs_codes):
            relevance_score += prod_w * 0.2
            reasons.append(f"HS code {req_hs} aligns with verified catalog listings")
    else:
        # If no HS code specified, allocate points to keyword relevance
        relevance_score += prod_w * 0.2

    relevance_pts = min(prod_w, relevance_score)
    breakdown["product_relevance"] = round(relevance_pts, 2)
    if relevance_pts >= prod_w * 0.6:
        reasons.append(f"Established catalog offerings matching {requirement.get('product', 'commodity')}")
    else:
        risks.append(f"Limited verified catalog listings for {requirement.get('product', 'commodity')}")

    # 2. Certifications (max w['certifications'])
    cert_w = w["certifications"]
    supp_certs = [c.lower() for c in supplier.get("certifications", [])]

    if not req_certs:
        # Buyer specified no required certifications
        breakdown["certifications"] = round(cert_w, 2)
        reasons.append("No specialized certifications required by buyer")
    else:
        matched_certs = []
        missing_certs = []
        for rc in req_certs:
            if any(rc in sc or sc in rc for sc in supp_certs):
                matched_certs.append(rc)
            else:
                missing_certs.append(rc)

        cert_ratio = len(matched_certs) / len(req_certs)
        cert_pts = cert_w * cert_ratio
        breakdown["certifications"] = round(cert_pts, 2)

        if matched_certs:
            reasons.append(f"Holds required {', '.join(c.upper() for c in matched_certs)}")
        if missing_certs:
            risks.append(f"Missing certification(s): {', '.join(c.upper() for c in missing_certs)}")

    # 3. MOQ Fit (max w['moq_fit'])
    moq_w = w["moq_fit"]
    supp_moq = float(supplier.get("min_moq") or supplier.get("moq") or 0.0)

    if req_qty <= 0 or supp_moq <= 0 or supp_moq <= req_qty:
        breakdown["moq_fit"] = round(moq_w, 2)
        if supp_moq > 0 and req_qty > 0:
            reasons.append(f"Supplier MOQ ({int(supp_moq):,} {req_unit}) fits your order ({int(req_qty):,} {req_unit})")
    else:
        # MOQ exceeds order quantity
        overshoot_ratio = (supp_moq - req_qty) / supp_moq
        moq_pts = max(0.0, (1.0 - overshoot_ratio) * moq_w)
        breakdown["moq_fit"] = round(moq_pts, 2)
        risks.append(f"Supplier MOQ of {int(supp_moq):,} {req_unit} exceeds your order quantity of {int(req_qty):,} {req_unit}")

    # 4. Capacity (max w['capacity'])
    cap_w = w["capacity"]
    cap_str = supplier.get("capacity_per_month")
    supp_cap = parse_numeric_capacity(cap_str)

    if supp_cap <= 0 or req_qty <= 0:
        # Neutral baseline
        breakdown["capacity"] = round(cap_w * 0.85, 2)
    elif supp_cap >= req_qty:
        breakdown["capacity"] = round(cap_w, 2)
        reasons.append(f"Monthly production capacity ({cap_str}) comfortably covers order volume")
    else:
        # Order exceeds capacity
        cap_ratio = supp_cap / req_qty
        breakdown["capacity"] = round(cap_w * cap_ratio, 2)
        risks.append(f"Order scale ({int(req_qty):,} {req_unit}) exceeds monthly facility capacity ({cap_str})")

    # 5. Delivery & Route Logistics (max w['delivery'])
    del_w = w["delivery"]
    supp_lead_time = float(supplier.get("lead_time_days") or supplier.get("response_time_hours", 24) or 30.0)
    supp_export_countries = [c.lower() for c in supplier.get("export_countries", [])]

    # Split: 60% lead time vs deadline, 40% export route familiarity
    time_pts = 0.0
    if supp_lead_time <= req_deadline:
        time_pts = del_w * 0.6
        reasons.append(f"Production lead time of {int(supp_lead_time)} days fits within {int(req_deadline)}-day deadline")
    else:
        time_deficit = (supp_lead_time - req_deadline) / max(req_deadline, 1.0)
        time_pts = max(0.0, del_w * 0.6 * (1.0 - min(1.0, time_deficit)))
        risks.append(f"Lead time of {int(supp_lead_time)} days exceeds requested {int(req_deadline)} days")

    route_pts = 0.0
    if req_dest:
        if any(req_dest in ec or ec in req_dest for ec in supp_export_countries):
            route_pts = del_w * 0.4
            reasons.append(f"Established shipping routes to {requirement.get('destination_country')}")
        else:
            route_pts = del_w * 0.2
    else:
        route_pts = del_w * 0.4

    breakdown["delivery"] = round(time_pts + route_pts, 2)

    # 6. Price Competitiveness (max w['price'])
    price_w = w["price"]
    supp_price = supplier.get("indicative_price")
    if supp_price is None and supp_products:
        prices = [float(p.get("price_min") or 0.0) for p in supp_products if p.get("price_min")]
        if prices:
            supp_price = min(prices)

    if supp_price is None or req_target_max is None or float(req_target_max) <= 0:
        # Missing price -> neutral 60% points
        breakdown["price"] = round(price_w * 0.6, 2)
    else:
        s_price = float(supp_price)
        t_max = float(req_target_max)
        t_min = float(req_target_min or 0.0)

        if s_price <= t_max:
            breakdown["price"] = round(price_w, 2)
            reasons.append(f"Price tier (${s_price:.2f}) matches target budget")
        else:
            excess = (s_price - t_max) / t_max
            p_pts = max(0.0, price_w * (1.0 - min(1.0, excess * 2.0)))
            breakdown["price"] = round(p_pts, 2)
            risks.append(f"Indicative price (${s_price:.2f}) is above target maximum of ${t_max:.2f}")

    # 7. Reliability & Track Record (max w['reliability'])
    rel_w = w["reliability"]
    on_time = float(supplier.get("on_time_rate") or 90.0) / 100.0
    trust = float(supplier.get("trust_score") or 85.0) / 100.0
    rating = float(supplier.get("rating") or 4.5) / 5.0
    years = float(supplier.get("years_in_business") or 5.0)
    year_factor = min(1.0, years / 10.0)

    composite_rel = (on_time * 0.35) + (trust * 0.35) + (rating * 0.15) + (year_factor * 0.15)
    rel_pts = rel_w * composite_rel
    breakdown["reliability"] = round(rel_pts, 2)
    reasons.append(f"Verified exporter: {supplier.get('trust_score', 95)} trust score, {int(on_time*100)}% on-time delivery")

    # Final Total Scaled to 0-100
    raw_total = sum(breakdown.values())
    scaled_score = (raw_total / total_w) * 100.0
    final_score = round(max(0.0, min(100.0, scaled_score)), 1)

    return {
        "score": final_score,
        "breakdown": breakdown,
        "reasons": reasons[:3],  # Top 3 clear reasons
        "all_reasons": reasons,
        "risks": risks,
        "rank": 0,  # Populated after ranking
    }


def rank_suppliers_for_requirement(
    suppliers: List[Dict[str, Any]],
    requirement: Dict[str, Any],
    weights: Optional[Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    """Scores and ranks a list of suppliers against trade requirements."""
    ranked = []
    for s in suppliers:
        result = calculate_supplier_match(s, requirement, weights=weights)
        s_copy = dict(s)
        s_copy.update(result)
        ranked.append(s_copy)

    # Sort descending by score, tiebreak by trust_score, then on_time_rate
    ranked.sort(
        key=lambda x: (
            x["score"],
            x.get("trust_score", 0),
            x.get("on_time_rate", 0),
        ),
        reverse=True,
    )

    for i, item in enumerate(ranked, 1):
        item["rank"] = i

    return ranked
