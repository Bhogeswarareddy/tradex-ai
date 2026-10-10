from fastapi import APIRouter

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("/status")
async def messages_status():
    return {"module": "messages", "status": "initialized"}
