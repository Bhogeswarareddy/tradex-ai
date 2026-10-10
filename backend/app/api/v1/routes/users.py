from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status")
async def users_status():
    return {"module": "users", "status": "initialized"}
