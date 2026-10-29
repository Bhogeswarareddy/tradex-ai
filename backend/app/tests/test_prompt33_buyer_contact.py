import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.identity import Company, Supplier, User, Buyer
from app.models.catalog import Product, Category
from app.models.content import Thread, Message
from sqlalchemy import select


@pytest.mark.asyncio
async def test_prompt33_recipient_search_sri_and_privacy():
    """Prompt 33: Recipient search for 'sri' returns Sri Bharat Spices Pvt Ltd,

    includes company details and verified flag, never exposes email/phone.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register a test buyer
        email = f"buyer_search_{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Password123!",
                "full_name": "Procurement Lead",
                "role": "buyer",
                "company_name": "Global Traders Inc",
                "country": "Germany",
            },
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Search with q='sri'
        res = await client.get("/api/v1/recipients?q=sri", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1

        sri_found = next((r for r in data if "Sri Bharat" in r["company_name"]), None)
        assert sri_found is not None, "Sri Bharat Spices Pvt Ltd must be returned when searching 'sri'"
        assert sri_found["country"] == "India"
        assert sri_found["verified"] is True
        assert "company_id" in sri_found and sri_found["company_id"] is not None
        assert "participant_id" in sri_found

        # Privacy test: verify email and phone are strictly NOT present in the response
        for item in data:
            assert "email" not in item, "Supplier email must never be exposed"
            assert "phone" not in item, "Supplier phone must never be exposed"
            assert "phone_number" not in item, "Supplier phone number must never be exposed"


@pytest.mark.asyncio
async def test_prompt33_chat_now_idempotency_and_product_link():
    """Prompt 33: Chat Now with product_id and company_id creates/reuses thread idempotently."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        buyer_email = f"buyer_chat_{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": buyer_email,
                "password": "Password123!",
                "full_name": "Direct Buyer",
                "role": "buyer",
                "company_name": "Euro Import Co",
                "country": "France",
            },
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Find Sri Bharat Spices company & a published product
        async with AsyncSessionLocal() as db:
            sri_comp = (
                await db.execute(select(Company).where(Company.name.ilike("%Sri Bharat%")))
            ).scalars().first()
            assert sri_comp is not None

            supplier = (
                await db.execute(select(Supplier).where(Supplier.company_id == sri_comp.id))
            ).scalars().first()
            assert supplier is not None

            prod = (
                await db.execute(
                    select(Product).where(
                        Product.supplier_id == supplier.id,
                        Product.status == "published",
                    )
                )
            ).scalars().first()
            assert prod is not None
            product_id = prod.id

        # 1. First Chat Now click: passes product_id and supplier's company_id
        payload = {
            "recipient_id": str(sri_comp.id),  # Passing company_id as specified
            "product_id": str(product_id),
            "subject": f"Inquiry regarding {prod.name}",
            "initial_message": "Hello, I am interested in ordering this product in bulk.",
            "context_type": "product",
            "context_id": str(product_id),
        }
        res1 = await client.post("/api/v1/threads", json=payload, headers=headers)
        assert res1.status_code == 201
        data1 = res1.json()
        thread_id1 = data1["thread_id"]
        assert thread_id1 is not None

        # 2. Second Chat Now click: identical call must reuse the existing thread
        res2 = await client.post("/api/v1/threads", json=payload, headers=headers)
        assert res2.status_code in [200, 201]
        data2 = res2.json()
        thread_id2 = data2["thread_id"]
        assert thread_id1 == thread_id2, "Chat Now must be idempotent and reuse the same thread"
        assert data2.get("is_existing") is True


@pytest.mark.asyncio
async def test_prompt33_supplier_counterparty_message_visibility():
    """Prompt 33: A buyer sends a message and the supplier sees it in their thread."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register Buyer
        buyer_email = f"buyer_vis_{uuid.uuid4().hex[:8]}@example.com"
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={
                "email": buyer_email,
                "password": "Password123!",
                "full_name": "Visible Buyer",
                "role": "buyer",
                "company_name": "Vision Goods",
                "country": "Italy",
            },
        )
        token_b = reg_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Login as Sri Bharat Spices supplier
        login_s = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert login_s.status_code == 200
        token_s = login_s.json()["access_token"]
        headers_s = {"Authorization": f"Bearer {token_s}"}

        # Buyer starts thread to Sri Bharat Spices
        async with AsyncSessionLocal() as db:
            sri_comp = (
                await db.execute(select(Company).where(Company.name.ilike("%Sri Bharat%")))
            ).scalars().first()
            assert sri_comp is not None

        unique_msg = f"Commercial negotiation inquiry #{uuid.uuid4().hex[:6]}"
        thread_res = await client.post(
            "/api/v1/threads",
            json={
                "recipient_id": str(sri_comp.id),
                "subject": "Bulk Spice Procurement",
                "initial_message": unique_msg,
                "context_type": "product",
            },
            headers=headers_b,
        )
        assert thread_res.status_code == 201
        thread_id = thread_res.json()["thread_id"]

        # Supplier lists threads and checks visibility
        sup_threads_res = await client.get("/api/v1/threads", headers=headers_s)
        assert sup_threads_res.status_code == 200
        sup_threads = sup_threads_res.json()
        matching_thread = next((t for t in sup_threads if t["id"] == thread_id), None)
        assert matching_thread is not None, "Supplier must see the newly created thread"

        # Supplier reads messages in the thread
        msgs_res = await client.get(f"/api/v1/threads/{thread_id}/messages", headers=headers_s)
        assert msgs_res.status_code == 200
        msgs_data = msgs_res.json()
        assert any(unique_msg in m["body"] for m in msgs_data["messages"])


@pytest.mark.asyncio
async def test_prompt33_anti_spam_and_rate_limiting():
    """Prompt 33: Unauthorized supplier returns 403, missing recipient returns 404,

    and buyer rate limiting triggers 429 when exceeding 15 threads/hour.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Supplier anti-spam check: supplier cannot initiate cold message to unlinked buyer
        sup_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert sup_login.status_code == 200
        token_s = sup_login.json()["access_token"]
        headers_s = {"Authorization": f"Bearer {token_s}"}

        random_buyer_id = str(uuid.uuid4())
        # With non-existent or unlinked buyer
        cold_res = await client.post(
            "/api/v1/threads",
            json={
                "recipient_id": random_buyer_id,
                "subject": "Cold Outreach",
                "initial_message": "Unsolicited offer",
            },
            headers=headers_s,
        )
        assert cold_res.status_code in [403, 404]

        # 2. Inexistent supplier returns 404 for buyer
        buyer_email = f"buyer_spam_{uuid.uuid4().hex[:8]}@example.com"
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={
                "email": buyer_email,
                "password": "Password123!",
                "full_name": "Spam Tester",
                "role": "buyer",
                "company_name": "Spam Corp",
                "country": "USA",
            },
        )
        token_b = reg_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        bad_res = await client.post(
            "/api/v1/threads",
            json={
                "recipient_id": str(uuid.uuid4()),
                "subject": "Missing Supplier",
                "initial_message": "Hello",
            },
            headers=headers_b,
        )
        assert bad_res.status_code == 404
        err_msg = bad_res.json().get("error", {}).get("message") or bad_res.json().get("detail", "")
        assert "No eligible supplier contact found" in err_msg

        # 3. Rate limiting: buyer creating > 15 threads in an hour triggers HTTP 429
        # Get Sri Bharat supplier id
        async with AsyncSessionLocal() as db:
            sri_comp = (
                await db.execute(select(Company).where(Company.name.ilike("%Sri Bharat%")))
            ).scalars().first()

        rate_limited = False
        for i in range(17):
            res = await client.post(
                "/api/v1/threads",
                json={
                    "recipient_id": str(sri_comp.id),
                    "subject": f"Thread #{i} - {uuid.uuid4().hex[:6]}",
                    "initial_message": f"Message test #{i}",
                },
                headers=headers_b,
            )
            if res.status_code == 429:
                rate_limited = True
                rl_msg = res.json().get("error", {}).get("message") or res.json().get("detail", "")
                assert "Rate limit exceeded" in rl_msg
                break

        assert rate_limited, "Buyer must be rate-limited with HTTP 429 after 15 new threads in an hour"
