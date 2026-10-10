"""
TradeX AI - Landed Cost Calculator & Quote Scoring Engine
Pure, deterministic, fully tested calculation of line-by-line landed cost and AI quote scores.
"""
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trade import (
    SimulatedFreightRate,
    SimulatedTariffDuty,
    SimulatedPortHandlingFee,
    SimulatedExchangeRate,
)


@dataclass
class CostBreakdownItem:
    category: str
    amount: float
    cost_per_kg: float
    percentage: float
    note: str = ""


@dataclass
class LandedCostEstimate:
    product_cost_total: float
    product_cost_per_kg: float
    freight_total: float
    freight_per_kg: float
    insurance_total: float
    insurance_per_kg: float
    duty_total: float
    duty_per_kg: float
    handling_total: float
    handling_per_kg: float
    inland_total: float
    inland_per_kg: float
    total_landed_cost: float
    landed_cost_per_kg: float
    currency: str = "EUR"
    label: str = "Simulated estimate"
    items: List[CostBreakdownItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "currency": self.currency,
            "product_cost_total": round(self.product_cost_total, 2),
            "product_cost_per_kg": round(self.product_cost_per_kg, 4),
            "freight_total": round(self.freight_total, 2),
            "freight_per_kg": round(self.freight_per_kg, 4),
            "insurance_total": round(self.insurance_total, 2),
            "insurance_per_kg": round(self.insurance_per_kg, 4),
            "duty_total": round(self.duty_total, 2),
            "duty_per_kg": round(self.duty_per_kg, 4),
            "handling_total": round(self.handling_total, 2),
            "handling_per_kg": round(self.handling_per_kg, 4),
            "inland_total": round(self.inland_total, 2),
            "inland_per_kg": round(self.inland_per_kg, 4),
            "total_landed_cost": round(self.total_landed_cost, 2),
            "landed_cost_per_kg": round(self.landed_cost_per_kg, 4),
            "breakdown": [
                {
                    "category": it.category,
                    "amount": round(it.amount, 2),
                    "cost_per_kg": round(it.cost_per_kg, 4),
                    "percentage": round(it.percentage, 1),
                    "note": it.note,
                }
                for it in self.items
            ],
        }


# Route defaults for pure, offline testability
FALLBACK_FREIGHT_RATES: Dict[str, float] = {
    "chennai_hamburg": 2400.0,
    "kochi_hamburg": 2200.0,
    "nhava sheva_hamburg": 2100.0,
    "mumbai_hamburg": 2100.0,
    "ho chi minh_hamburg": 2600.0,
    "chennai_rotterdam": 2350.0,
    "nhava sheva_new york": 3200.0,
    "default": 2400.0,
}

FALLBACK_DUTY_RATES: Dict[str, float] = {
    # Turmeric EU GSP exemption: 0%
    "0910.30_germany": 0.0,
    "0910.30_netherlands": 0.0,
    "0910.30_united states": 0.015,
    "0910.30_usa": 0.015,
    "0904.11_germany": 0.04,
    "5201.00_germany": 0.0,
}


def calculate_landed_cost(
    unit_price: float,
    quantity: float,
    currency: str = "EUR",
    origin_port: str = "Chennai",
    destination_port: str = "Hamburg",
    destination_country: str = "Germany",
    incoterm: str = "CIF",
    hs_code: Optional[str] = "0910.30",
    insurance_rate: Optional[float] = 0.0035,
    handling_fee_per_kg: Optional[float] = 0.035,
    customs_flat: Optional[float] = 150.0,
    inland_per_kg: Optional[float] = 0.03,
    freight_rate_override: Optional[float] = None,
    duty_rate_override: Optional[float] = None,
) -> LandedCostEstimate:
    """
    Pure Python calculation of line-by-line landed cost.
    Guarantees reproducible, deterministic output labeled 'Simulated estimate'.
    """
    qty = max(1.0, float(quantity))
    price = max(0.0, float(unit_price))
    product_total = price * qty
    product_per_kg = price

    route_key = f"{origin_port.lower()}_{destination_port.lower()}"
    duty_key = f"{(hs_code or '').strip().lower()}_{destination_country.lower()}"

    # 1. Freight
    # Standard 20FT container carries up to 20,000 kg (20 MT)
    container_count = max(1.0, qty / 20000.0)
    if freight_rate_override is not None:
        ocean_freight_total = freight_rate_override * container_count
    else:
        base_freight = FALLBACK_FREIGHT_RATES.get(route_key, FALLBACK_FREIGHT_RATES["default"])
        ocean_freight_total = base_freight * container_count

    ocean_freight_per_kg = ocean_freight_total / qty

    incoterm_upper = incoterm.upper().strip()
    if incoterm_upper in ["CIF", "DDP", "CFR"]:
        # Under CIF/DDP/CFR, supplier quote already embeds freight.
        # However, for landed cost line-by-line transparency, we estimate the freight portion
        # so total landed cost remains consistent with contract terms.
        freight_addon = 0.0
    elif incoterm_upper in ["FOB", "FAS"]:
        # Buyer pays freight on top of FOB price
        freight_addon = ocean_freight_total
    elif incoterm_upper == "EXW":
        # Buyer pays origin inland trucking (€400) + ocean freight
        origin_inland = 400.0 * container_count
        freight_addon = ocean_freight_total + origin_inland
    else:
        freight_addon = 0.0

    # 2. Insurance
    ins_rate = insurance_rate if insurance_rate is not None else 0.0035
    if incoterm_upper in ["CIF", "DDP"]:
        insurance_total = 0.0  # Included by seller
        reported_ins = product_total * ins_rate
    else:
        insurance_total = product_total * ins_rate
        reported_ins = insurance_total

    # 3. Import Duty & Tariffs
    if duty_rate_override is not None:
        effective_duty_rate = duty_rate_override
    elif hs_code and duty_key in FALLBACK_DUTY_RATES:
        effective_duty_rate = FALLBACK_DUTY_RATES[duty_key]
    elif not hs_code:
        # Edge case: missing HS code defaults to 0% duty with note
        effective_duty_rate = 0.0
    else:
        effective_duty_rate = 0.0

    # Duty applies on CIF value (Cost + Insurance + Freight)
    cif_value = product_total + (ocean_freight_total if incoterm_upper not in ["CIF", "DDP"] else 0.0)
    duty_total = cif_value * effective_duty_rate

    # 4. Port Terminal Handling (THC) & Customs Clearance
    thc_per_kg = handling_fee_per_kg if handling_fee_per_kg is not None else 0.035
    clearance_fee = customs_flat if customs_flat is not None else 150.0
    handling_total = (thc_per_kg * qty) + clearance_fee

    # 5. Inland Delivery / Final Destination Haulage
    inland_unit = inland_per_kg if inland_per_kg is not None else 0.03
    inland_total = inland_unit * qty

    # Calculate Total Landed Cost
    if incoterm_upper in ["CIF", "CFR"]:
        # Base product price already includes ocean freight
        total_landed = product_total + insurance_total + duty_total + handling_total + inland_total
    elif incoterm_upper == "DDP":
        # DDP already includes duty and delivery to warehouse
        total_landed = product_total + (handling_total * 0.2)  # nominal documentation
    else:
        total_landed = product_total + freight_addon + insurance_total + duty_total + handling_total + inland_total

    landed_per_kg = total_landed / qty

    # Construct line items
    items = [
        CostBreakdownItem(
            category="Product (Ex-Supplier)",
            amount=product_total,
            cost_per_kg=product_per_kg,
            percentage=(product_total / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"Supplier price @ {price:.2f} {currency}/kg ({incoterm_upper})",
        ),
        CostBreakdownItem(
            category="Ocean Freight",
            amount=ocean_freight_total,
            cost_per_kg=ocean_freight_per_kg,
            percentage=(ocean_freight_total / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"{origin_port} to {destination_port} ({'Included in CIF' if incoterm_upper in ['CIF', 'DDP'] else 'Buyer Port Allocation'})",
        ),
        CostBreakdownItem(
            category="Cargo Marine Insurance",
            amount=reported_ins,
            cost_per_kg=reported_ins / qty,
            percentage=(reported_ins / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"Marine risk coverage @ {ins_rate * 100:.2f}% of cargo value",
        ),
        CostBreakdownItem(
            category="Import Duty & Tariffs",
            amount=duty_total,
            cost_per_kg=duty_total / qty,
            percentage=(duty_total / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"HS {hs_code or 'N/A'}: {effective_duty_rate * 100:.1f}% duty to {destination_country}" + (" (GSP Exemption)" if effective_duty_rate == 0.0 else ""),
        ),
        CostBreakdownItem(
            category="Port Terminal Handling (THC)",
            amount=handling_total,
            cost_per_kg=handling_total / qty,
            percentage=(handling_total / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"{destination_port} port stevedoring & customs clearance",
        ),
        CostBreakdownItem(
            category="Inland Destination Haulage",
            amount=inland_total,
            cost_per_kg=inland_per_kg or 0.03,
            percentage=(inland_total / total_landed * 100.0) if total_landed > 0 else 0.0,
            note=f"Port container drayage to regional distribution center",
        ),
    ]

    return LandedCostEstimate(
        product_cost_total=product_total,
        product_cost_per_kg=product_per_kg,
        freight_total=ocean_freight_total,
        freight_per_kg=ocean_freight_per_kg,
        insurance_total=reported_ins,
        insurance_per_kg=reported_ins / qty,
        duty_total=duty_total,
        duty_per_kg=duty_total / qty,
        handling_total=handling_total,
        handling_per_kg=handling_total / qty,
        inland_total=inland_total,
        inland_per_kg=inland_total / qty,
        total_landed_cost=total_landed,
        landed_cost_per_kg=landed_per_kg,
        currency=currency,
        label="Simulated estimate",
        items=items,
    )


def compute_quote_ai_score(
    landed_cost: float,
    min_landed_cost: float,
    lead_time_days: int,
    min_lead_time_days: int,
    trust_score: float,
    has_certifications: bool = True,
    payment_terms: str = "LC at sight",
) -> float:
    """
    Computes deterministic AI score (0 to 100) using the exact prompt weights:
    - Landed cost: 40 points
    - Lead time: 20 points
    - Supplier reliability: 20 points
    - Certifications: 10 points
    - Payment terms: 10 points
    """
    # 1. Landed Cost (40 pts)
    # Lowest landed cost gets full 40 pts, higher costs get proportionally lower
    if landed_cost <= 0 or min_landed_cost <= 0:
        cost_pts = 40.0
    else:
        cost_pts = 40.0 * (min_landed_cost / max(min_landed_cost, landed_cost))
    cost_pts = min(40.0, max(0.0, cost_pts))

    # 2. Lead Time (20 pts)
    # Shortest lead time gets full 20 pts
    if lead_time_days <= 0 or min_lead_time_days <= 0:
        lead_pts = 20.0
    else:
        lead_pts = 20.0 * (min_lead_time_days / max(min_lead_time_days, lead_time_days))
    lead_pts = min(20.0, max(0.0, lead_pts))

    # 3. Supplier Reliability (20 pts)
    rel_pts = 20.0 * (min(100.0, max(0.0, trust_score)) / 100.0)

    # 4. Certifications (10 pts)
    cert_pts = 10.0 if has_certifications else 4.0

    # 5. Payment terms (10 pts)
    p_terms = (payment_terms or "").lower()
    if "100% irrevocable lc" in p_terms or "irrevocable lc" in p_terms:
        pay_pts = 10.0
    elif "lc at sight" in p_terms or "lc 60 days" in p_terms:
        pay_pts = 9.0
    elif "against bl" in p_terms or "tt" in p_terms:
        pay_pts = 8.5
    elif "advance" in p_terms and "100%" in p_terms:
        pay_pts = 4.0
    else:
        pay_pts = 8.0

    total_score = cost_pts + lead_pts + rel_pts + cert_pts + pay_pts
    return round(min(100.0, max(0.0, total_score)), 1)


async def get_simulated_db_rates(
    session: AsyncSession,
    origin_port: str,
    destination_port: str,
    destination_country: str,
    hs_code: Optional[str],
) -> Dict[str, Any]:
    """Fetch simulated rates from database if present, with graceful fallbacks."""
    result: Dict[str, Any] = {
        "freight_rate": None,
        "duty_rate": None,
        "handling_fee_per_kg": 0.035,
        "customs_flat": 150.0,
    }
    try:
        # Freight rate
        freight_stmt = select(SimulatedFreightRate).where(
            SimulatedFreightRate.origin_port.ilike(f"%{origin_port}%"),
            SimulatedFreightRate.destination_port.ilike(f"%{destination_port}%"),
        )
        freight_row = (await session.execute(freight_stmt)).scalars().first()
        if freight_row:
            result["freight_rate"] = float(freight_row.rate)

        # Duty rate
        if hs_code:
            clean_hs = hs_code.strip()
            duty_stmt = select(SimulatedTariffDuty).where(
                SimulatedTariffDuty.hs_code == clean_hs,
                SimulatedTariffDuty.destination_country.ilike(f"%{destination_country}%"),
            )
            duty_row = (await session.execute(duty_stmt)).scalars().first()
            if duty_row:
                result["duty_rate"] = float(duty_row.duty_rate)

        # Handling fee
        port_stmt = select(SimulatedPortHandlingFee).where(
            SimulatedPortHandlingFee.port_name.ilike(f"%{destination_port}%")
        )
        port_row = (await session.execute(port_stmt)).scalars().first()
        if port_row:
            result["handling_fee_per_kg"] = float(port_row.terminal_handling_per_kg)
            result["customs_flat"] = float(port_row.customs_clearance_flat)

    except Exception:
        # Fall back to deterministic in-memory constants
        pass

    return result
