import asyncio
import logging
import math
from datetime import date
from typing import List

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models.market import MarketSeries

logger = logging.getLogger(__name__)

COMMODITIES_CONFIG = [
    {
        "product": "Organic Turmeric",
        "category": "Spices",
        "growth_pct": 0.42,  # +42%
        "base_demand": 100.0,
        "base_price": 2.45,
        "base_volume": 520.0,
        "destinations": ["Germany", "USA", "Netherlands", "UAE", "United Kingdom"],
        "season_peak_month": 3,  # March harvest
    },
    {
        "product": "Basmati Rice",
        "category": "Grains",
        "growth_pct": 0.35,  # +35%
        "base_demand": 100.0,
        "base_price": 1.15,
        "base_volume": 1450.0,
        "destinations": ["Saudi Arabia", "UAE", "United Kingdom", "Germany", "USA"],
        "season_peak_month": 11,  # November harvest
    },
    {
        "product": "Cotton Fibre",
        "category": "Textiles",
        "growth_pct": 0.28,  # +28%
        "base_demand": 100.0,
        "base_price": 1.88,
        "base_volume": 980.0,
        "destinations": ["Vietnam", "Bangladesh", "Germany", "Turkey", "USA"],
        "season_peak_month": 12,  # December harvest
    },
    {
        "product": "Precision Auto Components",
        "category": "Engineering",
        "growth_pct": 0.24,  # +24%
        "base_demand": 100.0,
        "base_price": 15.20,
        "base_volume": 12400.0,
        "destinations": ["Germany", "USA", "Japan", "South Korea", "United Kingdom"],
        "season_peak_month": 6,  # Mid-year automotive retooling
    },
    {
        "product": "White Sesame Seeds",
        "category": "Oilseeds",
        "growth_pct": 0.19,  # +19%
        "base_demand": 100.0,
        "base_price": 1.98,
        "base_volume": 380.0,
        "destinations": ["Netherlands", "Germany", "USA", "Japan", "Greece"],
        "season_peak_month": 10,  # October harvest
    },
]


def generate_market_records() -> List[MarketSeries]:
    """Generates 24 months of monthly time-series records (Nov 2024 to Oct 2026)."""
    records = []

    # 24 months sequence: 2024-11 to 2026-10
    months = []
    # 2024 Nov, Dec
    for m in range(11, 13):
        months.append(date(2024, m, 1))
    # 2025 Jan to Dec
    for m in range(1, 13):
        months.append(date(2025, m, 1))
    # 2026 Jan to Oct
    for m in range(1, 11):
        months.append(date(2026, m, 1))

    total_months = len(months)  # 24

    for comm in COMMODITIES_CONFIG:
        for idx, month_dt in enumerate(months):
            # Linear trend component: 0 to 1 over the 24 months
            t = idx / (total_months - 1)
            trend_factor = 1.0 + (comm["growth_pct"] * t)

            # Seasonal wave component based on month difference from peak
            month_num = month_dt.month
            peak = comm["season_peak_month"]
            seasonal_offset = math.cos((month_num - peak) * 2 * math.pi / 12) * 0.08

            for dest in comm["destinations"]:
                # Country-specific variation
                dest_seed = (hash(dest) % 7) * 0.02

                demand_idx = round(comm["base_demand"] * trend_factor * (1.0 + seasonal_offset + dest_seed), 2)
                price_val = round(comm["base_price"] * (1.0 + comm["growth_pct"] * 0.7 * t + seasonal_offset * 0.5), 2)
                vol_val = round((comm["base_volume"] / len(comm["destinations"])) * trend_factor * (1.0 + seasonal_offset * 1.2), 2)

                records.append(
                    MarketSeries(
                        product=comm["product"],
                        category=comm["category"],
                        destination=dest,
                        date=month_dt,
                        demand_index=demand_idx,
                        avg_price=price_val,
                        volume=vol_val,
                    )
                )

    return records


async def seed_market_series(db: AsyncSession) -> int:
    """Populates 24 months of market data into the market_series table."""
    # Check if records already exist
    count = (await db.execute(select(func.count(MarketSeries.id)))).scalar() or 0
    if count >= 600:
        logger.info(f"Market series already populated ({count} records).")
        return count

    # Clean and re-seed
    await db.execute(delete(MarketSeries))
    records = generate_market_records()
    db.add_all(records)
    await db.commit()
    logger.info(f"Seeded {len(records)} time-series market records across 24 months.")
    return len(records)


async def main():
    async with AsyncSessionLocal() as session:
        count = await seed_market_series(session)
        print(f"Successfully populated {count} market_series time-series rows.")


if __name__ == "__main__":
    asyncio.run(main())
