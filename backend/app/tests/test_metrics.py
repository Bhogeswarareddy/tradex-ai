import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_metrics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Generate some traffic first
        health_resp = await client.get("/health")
        assert health_resp.status_code == 200

        # Query metrics endpoint
        response = await client.get("/metrics")
        assert response.status_code == 200
        text = response.text

        # Verify key Prometheus metrics exist in payload
        assert "tradex_http_requests_total" in text
        assert "tradex_http_request_duration_seconds" in text
        assert "tradex_ai_calls_total" in text
        assert "tradex_active_ws_connections" in text
