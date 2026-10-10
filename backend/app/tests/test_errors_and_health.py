import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_api_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        # Health returns 200 with JSON structure
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "environment" in data
        assert "database" in data
        assert "uptime_seconds" in data
        assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_unknown_route_returns_standard_error_shape():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/unknown-route-endpoint")
        assert response.status_code == 404
        data = response.json()
        # Enforcing standard error shape: {error: {code, message, details}}
        assert "error" in data
        error = data["error"]
        assert "code" in error
        assert "message" in error
        assert "details" in error
        assert error["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_sub_routers_mount_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        routes = [
            "auth", "users", "products", "suppliers", "rfqs",
            "quotes", "orders", "shipments", "documents",
            "messages", "ai", "analytics", "admin"
        ]
        for r in routes:
            res = await client.get(f"/api/v1/{r}/status")
            assert res.status_code == 200
            data = res.json()
            assert data["module"] == r
            assert data["status"] == "initialized"
