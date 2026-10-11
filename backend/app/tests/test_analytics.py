import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import User


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_analytics_date_range_validation():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid date range: from > to
        resp = await client.get(
            "/api/v1/analytics/market/top-products?from=2026-12-01&to=2026-01-01",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "error" in data
        assert "Invalid date range" in data["error"]["message"]


@pytest.mark.asyncio
async def test_analytics_top_products_returns_simulated_label():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/market/top-products",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) > 0
        assert items[0]["label"] == "Simulated market data"
        assert "product" in items[0]
        assert "total_volume" in items[0]


@pytest.mark.asyncio
async def test_analytics_rising_demand_contains_expected_growth():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/market/rising-demand",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 5
        # Verify growth percentages are tracked
        products = {it["product"]: it["growth_pct"] for it in items}
        assert "Organic Turmeric" in products
        assert products["Organic Turmeric"] > 35.0  # Around ~42%


@pytest.mark.asyncio
async def test_analytics_price_trends_with_sma():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/market/price-trends?product=Organic+Turmeric",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["label"] == "Simulated market data"
        assert len(data["points"]) > 0
        p = data["points"][-1]
        assert "avg_price" in p
        assert "sma_3m" in p
        assert "demand_index" in p


@pytest.mark.asyncio
async def test_analytics_destination_demand():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/market/destination-demand",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) > 0
        assert "destination" in items[0]
        assert "market_share_pct" in items[0]
        assert items[0]["label"] == "Simulated market data"


@pytest.mark.asyncio
async def test_platform_analytics_rbac():
    # Non-admin buyer should be forbidden (403)
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/platform/rfq-trends",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert resp.status_code == 403

    # Admin should succeed (200)
    admin_token = await get_test_token("admin@tradex.ai")
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/analytics/platform/rfq-trends",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["report"] == "platform_rfq_trends"

        # Check supplier activity
        resp2 = await client.get(
            "/api/v1/analytics/platform/supplier-activity",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp2.status_code == 200
        assert "total_active_suppliers" in resp2.json()


@pytest.mark.asyncio
async def test_buyer_spend_and_supplier_performance_role_awareness():
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    supplier_token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer accessing spend -> OK
        b_spend = await client.get(
            "/api/v1/analytics/buyer/spend",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert b_spend.status_code == 200
        assert "total_spend_eur" in b_spend.json()

        # Supplier accessing spend -> 403
        s_spend = await client.get(
            "/api/v1/analytics/buyer/spend",
            headers={"Authorization": f"Bearer {supplier_token}"},
        )
        assert s_spend.status_code == 403

        # Supplier accessing performance -> OK
        s_perf = await client.get(
            "/api/v1/analytics/supplier/performance",
            headers={"Authorization": f"Bearer {supplier_token}"},
        )
        assert s_perf.status_code == 200
        assert "on_time_delivery_rate" in s_perf.json()

        # Buyer accessing supplier performance -> 403
        b_perf = await client.get(
            "/api/v1/analytics/supplier/performance",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert b_perf.status_code == 403


@pytest.mark.asyncio
async def test_ai_insights_endpoint():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/analytics/insights",
            json={"product": "Organic Turmeric"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        assert len(data["insights"]) >= 3
        assert data["source"] == "Simulated market data"


@pytest.mark.asyncio
async def test_analytics_export_csv_and_pdf():
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # CSV Export
        csv_resp = await client.get(
            "/api/v1/analytics/export?report=market&format=csv",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers["content-type"]
        assert "Simulated market data" in csv_resp.text
        assert "Organic Turmeric" in csv_resp.text

        # PDF Export
        pdf_resp = await client.get(
            "/api/v1/analytics/export?report=market&format=pdf",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert pdf_resp.status_code == 200
        assert "application/pdf" in pdf_resp.headers["content-type"]
