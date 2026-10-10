import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import User
from app.models.content import Thread, Message, Notification
from app.models.trade import Quotation


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found in database")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_list_threads_and_messages():
    """Asserts GET /threads lists user threads with unread counts and message history."""
    token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/threads", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200, res.text
        threads = res.json()
        assert len(threads) >= 1

        t0 = threads[0]
        thread_id = t0["id"]

        # Fetch messages in this thread
        msg_res = await client.get(
            f"/api/v1/threads/{thread_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert msg_res.status_code == 200, msg_res.text
        msg_data = msg_res.json()
        assert "messages" in msg_data
        assert len(msg_data["messages"]) >= 1


@pytest.mark.asyncio
async def test_thread_permission_denied_for_non_participant():
    """Asserts non-participant user gets 403 Forbidden accessing a private negotiation thread."""
    # Create a non-participant user
    async with AsyncSessionLocal() as session:
        thread = (await session.execute(select(Thread))).scalars().first()
        assert thread is not None
        thread_id = str(thread.id)

        other_user = User(
            email=f"intruder_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="fakehash",
            role="buyer",
            is_active=True,
        )
        session.add(other_user)
        await session.commit()
        await session.refresh(other_user)
        other_token = create_access_token({"sub": str(other_user.id), "role": other_user.role})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/threads/{thread_id}/messages",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code == 403, "Non-participant user must receive 403 Forbidden"


@pytest.mark.asyncio
async def test_post_message_and_mark_read():
    """Asserts POST /threads/{id}/messages creates a message and POST /threads/{id}/read marks it as read."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    supp_token = await get_test_token("supplier@sribharat.com")

    async with AsyncSessionLocal() as session:
        thread = (await session.execute(select(Thread))).scalars().first()
        thread_id = str(thread.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Supplier sends message to Buyer
        res = await client.post(
            f"/api/v1/threads/{thread_id}/messages",
            json={"body": "Hello! The quality analysis certificate is ready for review.", "message_type": "text"},
            headers={"Authorization": f"Bearer {supp_token}"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "sent"

        # Buyer marks thread as read
        read_res = await client.post(
            f"/api/v1/threads/{thread_id}/read",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_counter_offer_round_and_acceptance():
    """
    Asserts complete counter-offer round:
    1. Buyer submits counter-offer (price 3.00)
    2. Supplier submits counter-offer (price 3.05)
    3. Buyer accepts 3.05 -> quote unit price updated to 3.05 and offer marked accepted
    """
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    supp_token = await get_test_token("supplier@sribharat.com")

    async with AsyncSessionLocal() as session:
        quote = (await session.execute(select(Quotation).where(Quotation.quote_number == "QT-2026-001"))).scalar_one_or_none()
        assert quote is not None
        quote_id = str(quote.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Buyer counters at €3.00
        res1 = await client.post(
            f"/api/v1/quotes/{quote_id}/counter",
            json={"price": 3.00, "quantity": 20000, "lead_time_days": 25, "note": "Target price for volume order"},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert res1.status_code == 200, res1.text
        data1 = res1.json()
        assert data1["status"] == "offer_created"
        thread_id = data1["thread_id"]

        # Step 2: Supplier counters at €3.05 in the thread
        res2 = await client.post(
            f"/api/v1/quotes/{quote_id}/counter",
            json={"price": 3.05, "quantity": 20000, "lead_time_days": 25, "note": "Best compromise rate"},
            headers={"Authorization": f"Bearer {supp_token}"},
        )
        assert res2.status_code == 200, res2.text
        offer2_msg_id = res2.json()["message_id"]

        # Step 3: Buyer accepts the €3.05 counter-offer
        accept_res = await client.post(
            f"/api/v1/negotiations/{offer2_msg_id}/accept",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert accept_res.status_code == 200, accept_res.text
        accept_data = accept_res.json()
        assert accept_data["status"] == "accepted"
        assert accept_data["offer_price"] == 3.05

        # Verify Quotation in database was updated
        async with AsyncSessionLocal() as session:
            refreshed_quote = (await session.execute(select(Quotation).where(Quotation.id == uuid.UUID(quote_id)))).scalar_one()
            assert float(refreshed_quote.unit_price) == 3.05


@pytest.mark.asyncio
async def test_ai_negotiation_assist_endpoint():
    """Asserts POST /ai/negotiation/assist returns structured counter terms and draft message."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/negotiation/assist",
            params={"target_price": 3.00, "current_quote_price": 3.10},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert "recommended_counter_price" in data
        assert "draft_message_to_counterparty" in data
        assert "compromise_terms" in data


@pytest.mark.asyncio
async def test_notifications_endpoints():
    """Asserts notifications listing and mark-all-read operations."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get notifications
        res = await client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {buyer_token}"})
        assert res.status_code == 200, res.text
        data = res.json()
        assert "notifications" in data
        assert "total_unread" in data

        # Mark all read
        read_res = await client.post("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {buyer_token}"})
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "ok"
