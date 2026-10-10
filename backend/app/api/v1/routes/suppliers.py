from fastapi import APIRouter

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/status")
async def suppliers_status():
    return {"module": "suppliers", "status": "initialized"}
