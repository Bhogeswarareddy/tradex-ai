from fastapi import APIRouter

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/status")
async def ai_status():
    return {"module": "ai", "status": "initialized"}
