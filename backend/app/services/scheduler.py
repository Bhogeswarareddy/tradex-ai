import logging
import os
from datetime import date, datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.db import AsyncSessionLocal
from app.models.content import Notification
from app.models.trade import RFQ, Quotation, Shipment

logger = logging.getLogger(__name__)

scheduler: AsyncIOScheduler | None = None

MARITIME_WAYPOINTS = [
    (13.08, 80.27, "Chennai Port, India"),
    (15.00, 67.00, "Arabian Sea (East)"),
    (12.50, 50.00, "Gulf of Aden"),
    (13.00, 45.00, "Bab-el-Mandeb Strait"),
    (20.00, 38.00, "Red Sea (North)"),
    (30.00, 32.50, "Suez Canal"),
    (32.00, 32.30, "Port Said, Egypt"),
    (34.50, 24.00, "Mediterranean Sea (East)"),
    (37.00, 15.00, "Mediterranean Sea (Central)"),
    (38.00, 3.00, "Mediterranean Sea (West)"),
    (36.10, -5.35, "Strait of Gibraltar"),
    (46.00, -5.00, "Bay of Biscay"),
    (51.00, 2.00, "North Sea (South)"),
    (53.55, 9.99, "Port of Hamburg, Germany"),
]


async def simulate_shipment_movements() -> int:
    """
    Advances active maritime shipments along predefined shipping waypoints
    from India to Europe. Runs every 1 minute when SHIPMENT_SIMULATOR=on.
    """
    updated_count = 0
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(Shipment).where(Shipment.status == "in_transit")
            res = await session.execute(stmt)
            shipments = res.scalars().all()

            for s in shipments:
                cur_lat = float(s.current_latitude or 13.08)
                cur_lng = float(s.current_longitude or 80.27)

                # Find closest waypoint index
                closest_idx = 0
                min_dist = float("inf")
                for idx, (w_lat, w_lng, _) in enumerate(MARITIME_WAYPOINTS):
                    d = (w_lat - cur_lat) ** 2 + (w_lng - cur_lng) ** 2
                    if d < min_dist:
                        min_dist = d
                        closest_idx = idx

                next_idx = closest_idx + 1
                if next_idx < len(MARITIME_WAYPOINTS):
                    n_lat, n_lng, n_loc = MARITIME_WAYPOINTS[next_idx]
                    s.current_latitude = n_lat
                    s.current_longitude = n_lng
                    s.current_location = n_loc
                else:
                    s.status = "arrived"
                    s.current_latitude = 53.55
                    s.current_longitude = 9.99
                    s.current_location = "Port of Hamburg, Germany"
                updated_count += 1

            if updated_count > 0:
                await session.commit()
                logger.info(f"Advanced {updated_count} shipments along maritime corridor.")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error simulating shipment movements: {e}")
    return updated_count


async def check_and_close_expired_rfqs() -> int:
    """
    Celery-free periodic worker that closes RFQs that have passed their deadline
    and notifies both the buyer and quoting suppliers.
    """
    closed_count = 0
    today = date.today()

    async with AsyncSessionLocal() as session:
        try:
            stmt = (
                select(RFQ)
                .options(
                    selectinload(RFQ.buyer),
                    selectinload(RFQ.quotations).selectinload(Quotation.supplier),
                )
                .where(
                    RFQ.status.in_(["active", "Active", "open", "evaluating"]),
                    RFQ.deadline < today,
                )
            )
            result = await session.execute(stmt)
            expired_rfqs = result.scalars().all()

            for rfq in expired_rfqs:
                rfq.status = "closed"
                closed_count += 1

                # Notify Buyer
                if rfq.buyer and rfq.buyer.user_id:
                    buyer_note = Notification(
                        user_id=rfq.buyer.user_id,
                        title=f"RFQ Deadline Reached: {rfq.rfq_number}",
                        message=f"Bidding has concluded for '{rfq.title}'. You have {len(rfq.quotations)} quotations ready for final award.",
                        link=f"/rfqs/{rfq.id}",
                    )
                    session.add(buyer_note)

                # Notify participating suppliers
                for quote in rfq.quotations:
                    if quote.supplier and quote.supplier.user_id:
                        supplier_note = Notification(
                            user_id=quote.supplier.user_id,
                            title=f"RFQ Concluded: {rfq.rfq_number}",
                            message=f"The deadline for RFQ {rfq.rfq_number} has closed. Quotations are under buyer review.",
                            link=f"/rfqs/{rfq.id}",
                        )
                        session.add(supplier_note)

            if closed_count > 0:
                await session.commit()
                logger.info(f"APScheduler closed {closed_count} expired RFQs.")

        except Exception as e:
            await session.rollback()
            logger.error(f"Error during expired RFQ check: {e}")

    return closed_count


def start_scheduler() -> AsyncIOScheduler:
    """Starts the APScheduler background worker."""
    global scheduler
    if scheduler is None:
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            check_and_close_expired_rfqs,
            "interval",
            minutes=10,
            id="rfq_deadline_monitor",
            replace_existing=True,
        )
        if os.getenv("SHIPMENT_SIMULATOR", "").lower() == "on":
            scheduler.add_job(
                simulate_shipment_movements,
                "interval",
                minutes=1,
                id="shipment_simulator",
                replace_existing=True,
            )
        scheduler.start()
        logger.info("APScheduler initialized for TradeX RFQ deadline & shipment tracking.")
    return scheduler


def shutdown_scheduler() -> None:
    """Cleanly shuts down the scheduler."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down successfully.")
        scheduler = None
