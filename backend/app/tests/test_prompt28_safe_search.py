import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.main import app
from app.models.identity import User
from app.ai.provider import get_ai_status, get_ai_provider


@pytest.mark.asyncio
async def test_search_conversational_query_laptops():
    """Prompt 28: /products?q=i+want+laptop returns matching products without crashing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/products?q=i+want+laptop")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1
        names = [item["name"].lower() for item in data["items"]]
        assert any("laptop" in n or "notebook" in n for n in names)


@pytest.mark.asyncio
async def test_ai_search_tractors_missing_quantity():
    """Prompt 28: /ai/search with 'i want to tractors' handles missing volume/quantity cleanly."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/search",
            json={"query": "i want to tractors"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["query"] == "i want to tractors"
        req = data["requirement"]
        assert req["quantity"] is None or isinstance(req["quantity"], (int, float))
        assert "products" in data
        assert "ai_meta" in data
        assert data["ai_meta"] is not None
        assert "provider" in data["ai_meta"]
        assert "model" in data["ai_meta"]


@pytest.mark.asyncio
async def test_unified_ai_provider_status_groq():
    """Prompt 28: Verify unified Groq provider is configured and active in /ai/status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/ai/status")
        assert res.status_code == 200
        data = res.json()
        assert data["provider"] == "groq"
        assert data["model"] == "llama-3.3-70b-versatile"
        assert data["mode"] == "live"
        assert data["reachable"] is True
        assert "groq" in data["configured_providers"]


@pytest.mark.asyncio
async def test_copilot_chat_returns_ai_metadata():
    """Prompt 28: Copilot replies include ai_meta (provider, model, latency, is_demo)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "hi"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "response" in data
        assert "ai_meta" in data
        assert data["ai_meta"] is not None
        assert "provider" in data["ai_meta"]
        assert "model" in data["ai_meta"]
        assert "latency_ms" in data["ai_meta"]
        assert "is_demo" in data["ai_meta"]


@pytest.mark.asyncio
async def test_buyer_profile_name_bhogeswara_reddy():
    """Prompt 28: Confirm buyer profile name is restored to 'Bhogeswara Reddy'."""
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == "bhogeswara@tradex.ai"))).scalar_one_or_none()
        assert user is not None
        assert user.full_name == "Bhogeswara Reddy"
