from fastapi import APIRouter

router = APIRouter(prefix="/shipments", tags=["Shipments"])


@router.get("/status")
async def shipments_status():
    return {"module": "shipments", "status": "initialized"}
