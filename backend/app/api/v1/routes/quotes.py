from fastapi import APIRouter

router = APIRouter(prefix="/quotes", tags=["Quotations"])


@router.get("/status")
async def quotes_status():
    return {"module": "quotes", "status": "initialized"}
