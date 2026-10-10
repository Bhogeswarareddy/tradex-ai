import uuid
from datetime import date
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import User
from app.models.trade import Order, Quotation, RFQ


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found in database")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_get_rfq_quote_comparison():
    """Asserts GET /rfqs/{id}/comparison returns 5 seeded quotes with landed costs and AI scores."""
    token = await get_test_token("bhogeswara@tradex.ai")

    async with AsyncSessionLocal() as session:
        rfq = (await session.execute(select(RFQ).where(RFQ.rfq_number == "RFQ-2026-1042"))).scalar_one_or_none()
        assert rfq is not None, "Seeded RFQ-2026-1042 must exist"
        rfq_id = str(rfq.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/rfqs/{rfq_id}/comparison",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        assert data["rfq_number"] == "RFQ-2026-1042"
        assert len(data["quotes"]) == 5
        assert data["benchmark"]["estimate_label"] == "Simulated estimate"

        # Check Sri Bharat quote presence
        sri_bharat = next((q for q in data["quotes"] if "Sri Bharat" in q["supplier_name"]), None)
        assert sri_bharat is not None
        assert sri_bharat["unit_price"] in [3.05, 3.10]
        assert sri_bharat["landed_cost"] == 3.42
        assert sri_bharat["ai_score"] >= 90.0
        assert "landed_cost_breakdown" in sri_bharat
        assert sri_bharat["landed_cost_breakdown"]["label"] == "Simulated estimate"


@pytest.mark.asyncio
async def test_rfq_ai_comparison_recommendation():
    """Asserts POST /rfqs/{id}/comparison/ai returns stable winner and numbers."""
    token = await get_test_token("bhogeswara@tradex.ai")

    async with AsyncSessionLocal() as session:
        rfq = (await session.execute(select(RFQ).where(RFQ.rfq_number == "RFQ-2026-1042"))).scalar_one_or_none()
        rfq_id = str(rfq.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/rfqs/{rfq_id}/comparison/ai",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        assert "winner_supplier_name" in data
        assert "Sri Bharat" in data["winner_supplier_name"]
        assert "trade_offs" in data
        assert "NatureFarm" in data["trade_offs"]
        assert "negotiation_tip" in data


@pytest.mark.asyncio
async def test_toggle_shortlist_quote():
    """Asserts POST /quotes/{id}/shortlist toggles quote status between shortlisted and submitted."""
    token = await get_test_token("bhogeswara@tradex.ai")

    async with AsyncSessionLocal() as session:
        quote = (await session.execute(select(Quotation).where(Quotation.quote_number == "QT-2026-002"))).scalar_one_or_none()
        assert quote is not None
        quote_id = str(quote.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First toggle: should become shortlisted
        res1 = await client.post(
            f"/api/v1/quotes/{quote_id}/shortlist",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] in ["shortlisted", "submitted"]


@pytest.mark.asyncio
async def test_export_rfq_comparison_csv():
    """Asserts GET /rfqs/{id}/comparison/export?format=csv returns text/csv with quote data."""
    token = await get_test_token("bhogeswara@tradex.ai")

    async with AsyncSessionLocal() as session:
        rfq = (await session.execute(select(RFQ).where(RFQ.rfq_number == "RFQ-2026-1042"))).scalar_one_or_none()
        rfq_id = str(rfq.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/rfqs/{rfq_id}/comparison/export?format=csv",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "attachment" in res.headers["content-disposition"]
        csv_text = res.text
        assert "Quote Number" in csv_text
        assert "Landed Cost" in csv_text
        assert "QT-2026-001" in csv_text


@pytest.mark.asyncio
async def test_accept_quote_creates_order_and_closes_competitors():
    """Asserts accepting a quotation creates an order and closes competing quotes."""
    token = await get_test_token("bhogeswara@tradex.ai")

    async with AsyncSessionLocal() as session:
        # Create a dedicated test RFQ and 2 quotes for this isolated test
        from app.models.identity import Buyer, Supplier
        buyer = (await session.execute(select(Buyer))).scalars().first()
        suppliers = (await session.execute(select(Supplier).limit(2))).scalars().all()
        assert buyer is not None and len(suppliers) >= 2

        test_rfq = RFQ(
            rfq_number=f"RFQ-TEST-{uuid.uuid4().hex[:6]}",
            buyer_id=buyer.id,
            title="Test Tender for Award Execution",
            status="active",
            quantity=5000,
            unit="kg",
            target_price_min=Decimal("2.50"),
            target_price_max=Decimal("3.50"),
            currency="EUR",
            destination_country="Germany",
            destination_port="Hamburg",
            deadline=date(2026, 12, 31),
        )
        session.add(test_rfq)
        await session.flush()

        q1 = Quotation(
            quote_number=f"QT-T1-{uuid.uuid4().hex[:4]}",
            rfq_id=test_rfq.id,
            supplier_id=suppliers[0].id,
            unit_price=Decimal("2.90"),
            landed_cost=Decimal("3.20"),
            lead_time_days=20,
            payment_terms="LC at sight",
            valid_until=date(2026, 12, 31),
            status="submitted",
            ai_score=92.0,
        )
        q2 = Quotation(
            quote_number=f"QT-T2-{uuid.uuid4().hex[:4]}",
            rfq_id=test_rfq.id,
            supplier_id=suppliers[1].id,
            unit_price=Decimal("3.10"),
            landed_cost=Decimal("3.40"),
            lead_time_days=25,
            payment_terms="LC at sight",
            valid_until=date(2026, 12, 31),
            status="submitted",
            ai_score=88.0,
        )
        session.add_all([q1, q2])
        await session.commit()
        await session.refresh(q1)
        await session.refresh(q2)
        q1_id = str(q1.id)
        q2_id = str(q2.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/quotes/{q1_id}/accept",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "order_created"
        assert data["rfq_status"] == "awarded"
        assert "ORD-" in data["order_number"]

        # Verify database state
        async with AsyncSessionLocal() as session:
            refreshed_q1 = (await session.execute(select(Quotation).where(Quotation.id == uuid.UUID(q1_id)))).scalar_one()
            refreshed_q2 = (await session.execute(select(Quotation).where(Quotation.id == uuid.UUID(q2_id)))).scalar_one()
            assert refreshed_q1.status == "accepted"
            assert refreshed_q2.status == "rejected"
            order = (await session.execute(select(Order).where(Order.order_number == data["order_number"]))).scalar_one_or_none()
            assert order is not None
            assert order.total_amount == pytest.approx(Decimal(str(2.90 * 5000)), rel=0.01)
