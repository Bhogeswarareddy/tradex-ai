from fastapi import APIRouter

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


@router.get("/status")
async def rfqs_status():
    return {"module": "rfqs", "status": "initialized"}
