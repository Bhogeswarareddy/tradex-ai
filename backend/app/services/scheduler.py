import logging
from datetime import date, datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import AsyncSessionLocal
from app.models.content import Notification
from app.models.trade import RFQ, Quotation

logger = logging.getLogger(__name__)

scheduler: AsyncIOScheduler | None = None


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
        scheduler.start()
        logger.info("APScheduler initialized for TradeX RFQ deadline monitoring.")
    return scheduler


def shutdown_scheduler() -> None:
    """Cleanly shuts down the scheduler."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down successfully.")
        scheduler = None
