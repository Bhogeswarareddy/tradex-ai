from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/status")
async def admin_status():
    return {"module": "admin", "status": "initialized"}
