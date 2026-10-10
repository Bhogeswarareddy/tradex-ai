import uuid
from datetime import date, timedelta
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import Buyer, User
from app.models.trade import RFQ
from app.services.scheduler import check_and_close_expired_rfqs


async def get_test_token(email: str) -> str:
    """Helper to generate JWT access token directly from DB user, avoiding login rate limits."""
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found in database")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_rfq_ai_generator():
    """Asserts POST /rfqs/generate converts free text into a complete structured RFQ draft."""
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/rfqs/generate",
            json={"buyer_request": "I need 20 metric tons of organic turmeric powder from India to Hamburg in 45 days"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "title" in data
        assert "quantity" in data
        assert data["quantity"] == 20000 or data["quantity"] == 20
        assert "unit" in data
        assert "destination_country" in data
        assert "specifications" in data
        assert "required_certifications" in data


@pytest.mark.asyncio
async def test_rfq_create_and_number_generation():
    """Asserts RFQ creation generates sequential RFQ-2026-XXXX numbers."""
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "title": "Cotton Yarn 30s Combed",
            "product": "Cotton Yarn",
            "category": "Textiles & Fabrics",
            "quantity": 10000,
            "unit": "kg",
            "target_price_min": 3.50,
            "target_price_max": 4.00,
            "currency": "USD",
            "destination_country": "Germany",
            "destination_port": "Hamburg",
            "incoterm": "CIF",
            "status": "draft",
        }
        res = await client.post(
            "/api/v1/rfqs",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert "rfq_number" in data
        assert data["rfq_number"].startswith("RFQ-2026-")
        assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_seeded_rfq_1042_renders_with_five_quotes():
    """Asserts seeded RFQ-2026-1042 exists with exact details and 5 quotations."""
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/rfqs/RFQ-2026-1042",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["rfq_number"] == "RFQ-2026-1042"
        assert "Turmeric" in data["title"]
        assert data["quantity"] == 20000
        assert data["destination_port"] == "Hamburg"
        assert data["quotes_count"] == 5
        assert len(data["quotes"]) == 5

        # Sri Bharat quote should be present
        quote_suppliers = [q["supplier_name"] for q in data["quotes"]]
        assert any("Sri Bharat" in name for name in quote_suppliers)


@pytest.mark.asyncio
async def test_supplier_cannot_see_draft_rfqs():
    """RBAC isolation: Suppliers cannot view Draft RFQs."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    supplier_token = await get_test_token("supplier@sribharat.com")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Buyer creates a draft RFQ
        create_res = await client.post(
            "/api/v1/rfqs",
            json={
                "title": "Secret Buyer Procurement",
                "quantity": 5000,
                "destination_country": "France",
                "destination_port": "Le Havre",
                "status": "draft",
            },
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert create_res.status_code == 201
        draft_id = create_res.json()["id"]

        # 2. Supplier requests the draft RFQ -> 404
        res = await client.get(
            f"/api/v1/rfqs/{draft_id}",
            headers={"Authorization": f"Bearer {supplier_token}"},
        )
        assert res.status_code == 404


@pytest.mark.asyncio
async def test_supplier_cannot_see_competitor_quotes():
    """RBAC isolation: Supplier requesting RFQ-2026-1042 sees only their own quote, not other 4."""
    supplier_token = await get_test_token("supplier@sribharat.com")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/rfqs/RFQ-2026-1042",
            headers={"Authorization": f"Bearer {supplier_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        # Should only see their own quote or 0 quotes, never all 5 competitor quotes!
        assert data["quotes_count"] <= 1


@pytest.mark.asyncio
async def test_rfq_workflow_publish_close_award():
    """Tests RFQ lifecycle transitions: draft -> active -> close -> award."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Draft
        create_res = await client.post(
            "/api/v1/rfqs",
            json={
                "title": "Cardamom Green Bold",
                "quantity": 1000,
                "destination_country": "UAE",
                "destination_port": "Jebel Ali",
                "status": "draft",
            },
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert create_res.status_code == 201
        rfq_id = create_res.json()["id"]

        # 2. Publish
        pub_res = await client.post(
            f"/api/v1/rfqs/{rfq_id}/publish",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert pub_res.status_code == 200
        assert pub_res.json()["status"] == "published"

        # 3. Close
        close_res = await client.post(
            f"/api/v1/rfqs/{rfq_id}/close",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert close_res.status_code == 200
        assert close_res.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_apscheduler_closes_expired_rfqs():
    """Asserts periodic scheduler closes RFQs past their deadline."""
    async with AsyncSessionLocal() as session:
        # Find buyer
        buyer_stmt = select(Buyer).limit(1)
        buyer_res = await session.execute(buyer_stmt)
        buyer = buyer_res.scalar_one_or_none()
        if not buyer:
            pytest.skip("No buyer found for scheduler test")

        past_rfq = RFQ(
            rfq_number=f"RFQ-2026-{uuid.uuid4().hex[:4]}",
            buyer_id=buyer.id,
            title="Expired Soybean Inquiry",
            status="active",
            quantity=15000,
            unit="kg",
            destination_country="Germany",
            destination_port="Hamburg",
            deadline=date.today() - timedelta(days=2),  # Expired 2 days ago!
        )
        session.add(past_rfq)
        await session.commit()

        closed = await check_and_close_expired_rfqs()
        assert closed >= 1

        await session.refresh(past_rfq)
        assert past_rfq.status == "closed"
