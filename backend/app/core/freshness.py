"""
TradeX AI: Data Freshness Evaluation Service (Prompt 15)
Calculates freshness states: 'current', 'unconfirmed', or 'stale'
"""
from datetime import datetime, timezone
from typing import Optional, Tuple
from app.core.config import settings


def compute_freshness(
    confirmed_at: Optional[datetime],
    stale_days: int,
) -> Tuple[str, Optional[int]]:
    """
    Returns (status, days_ago).
    status: 'unconfirmed' if confirmed_at is None
            'stale' if days_ago > stale_days
            'current' otherwise
    """
    if not confirmed_at:
        return "unconfirmed", None

    now = datetime.now(timezone.utc)
    if confirmed_at.tzinfo is None:
        confirmed_at = confirmed_at.replace(tzinfo=timezone.utc)

    delta = now - confirmed_at
    days_ago = max(0, delta.days)

    if days_ago > stale_days:
        return "stale", days_ago
    return "current", days_ago


def get_product_freshness_metadata(product) -> dict:
    price_status, price_days = compute_freshness(product.price_confirmed_at, settings.STALE_PRICE_DAYS)
    avail_status, avail_days = compute_freshness(product.inventory_confirmed_at, settings.STALE_INVENTORY_DAYS)

    return {
        "price_status": price_status,
        "price_confirmed_at": product.price_confirmed_at.isoformat() if product.price_confirmed_at else None,
        "price_confirmed_days_ago": price_days,
        "price_badge": f"Price confirmed {price_days} days ago" if price_status == "current" else (
            "Price stale (needs reconfirmation)" if price_status == "stale" else "Price unconfirmed"
        ),
        "availability_status_confirmed": avail_status,
        "inventory_confirmed_at": product.inventory_confirmed_at.isoformat() if product.inventory_confirmed_at else None,
        "inventory_confirmed_days_ago": avail_days,
        "availability_badge": f"Availability confirmed {avail_days} days ago" if avail_status == "current" else (
            "Availability stale" if avail_status == "stale" else "Availability unconfirmed"
        ),
    }
