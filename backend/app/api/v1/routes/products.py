from fastapi import APIRouter

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/status")
async def products_status():
    return {"module": "products", "status": "initialized"}
