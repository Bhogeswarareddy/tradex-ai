"""
TradeX AI: Background Indexing & RAG Queue Worker (Prompt 16)
Processes index_jobs with retries, exponential backoff, and max 5 attempts.
"""
import asyncio
import logging
import signal
import sys
from typing import Optional

from app.core.db import AsyncSessionLocal
from app.services.indexer import process_pending_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [worker] %(message)s",
)
logger = logging.getLogger("tradex.worker")

_stop_event = asyncio.Event()


def handle_shutdown(sig, frame):
    logger.info(f"Received signal {sig}. Initiating graceful shutdown...")
    _stop_event.set()


async def run_worker_loop(poll_interval: float = 2.0, once: bool = False):
    """Continuous polling loop for processing index jobs."""
    logger.info("TradeX Search & RAG Indexing Worker started.")
    
    while not _stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                processed = await process_pending_jobs(db, limit=10)
                if processed > 0:
                    logger.info(f"Processed {processed} indexing job(s).")
        except Exception as exc:
            logger.error(f"Error in indexing worker loop: {exc}", exc_info=True)

        if once:
            break

        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=poll_interval)
        except asyncio.TimeoutError:
            pass

    logger.info("TradeX Indexing Worker stopped cleanly.")


def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    once = "--once" in sys.argv
    asyncio.run(run_worker_loop(poll_interval=2.0, once=once))


if __name__ == "__main__":
    main()
