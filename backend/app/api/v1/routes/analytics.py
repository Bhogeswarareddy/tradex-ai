from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/status")
async def analytics_status():
    return {"module": "analytics", "status": "initialized"}
