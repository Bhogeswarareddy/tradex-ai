from fastapi import APIRouter

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/status")
async def orders_status():
    return {"module": "orders", "status": "initialized"}
