import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.core.db import AsyncSessionLocal
from app.models.identity import User
from sqlalchemy import select


@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
async def admin_token():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.role == "admin").limit(1))).scalar_one_or_none()
        if not user:
            user = (await session.execute(select(User).limit(1))).scalar_one()
        return create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})


@pytest.mark.asyncio
async def test_palette_search(async_client, admin_token):
    res = await async_client.get(
        "/api/v1/ai/palette/search?q=phone",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "products" in data
    assert "suppliers" in data
    assert "rfqs" in data
    assert "orders" in data


@pytest.mark.asyncio
async def test_landed_cost_calculator(async_client, admin_token):
    payload = {
        "product_price": 5.5,
        "quantity": 1000,
        "currency": "USD",
        "origin_country": "India",
        "destination_country": "Germany",
        "incoterm": "FOB",
        "hs_code": "1006.30",
    }
    res = await async_client.post(
        "/api/v1/landed-cost/calculate",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_landed_cost" in data
    assert "landed_cost_per_kg" in data
    assert "breakdown" in data


@pytest.mark.asyncio
async def test_supplier_scorecard(async_client, admin_token):
    res = await async_client.get(
        "/api/v1/analytics/supplier/scorecard",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "quote_win_rate_pct" in data
    assert "on_time_delivery_rate_pct" in data
    assert "benchmark_comparison" in data


@pytest.mark.asyncio
async def test_csv_exports(async_client, admin_token):
    res = await async_client.get(
        "/api/v1/products/export/csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")

    res_orders = await async_client.get(
        "/api/v1/orders/export/csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_orders.status_code == 200
    assert "text/csv" in res_orders.headers.get("content-type", "")
