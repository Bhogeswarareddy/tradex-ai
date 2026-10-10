from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/status")
async def documents_status():
    return {"module": "documents", "status": "initialized"}
