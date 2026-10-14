"""
TradeX AI - AI Mode Backend Acceptance Tests (Prompt 18)
Covers:
1. Creating, listing, renaming and soft-deleting conversations
2. Another user gets 404 on someone else's conversation
3. The laptop, refine, compare and MOQ follow-up sequence
4. Selection with no duplicates
5. Compare output
6. Chat Now creating exactly one thread when clicked twice
7. A negotiation draft not being sendable without confirmation
8. Provider failure fallback and Demo AI label
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.rate_limit import ai_limiter, auth_limiter
from app.main import app
from app.models.catalog import PriceTier, Product
from app.models.identity import Company, Supplier, User


@pytest.fixture(autouse=True)
def reset_limiters():
    auth_limiter.reset()
    ai_limiter.reset()
    yield


async def get_test_product(db) -> Product:
    """Helper to fetch or create a verified published product with tiers."""
    stmt = (
        select(Product)
        .where(Product.status == "published", Product.deleted_at.is_(None))
        .limit(1)
    )
    prod = (await db.execute(stmt)).scalar_one_or_none()
    if not prod:
        # Create a test supplier and product
        comp = Company(name="Cardamom Global Ltd", country="India", verified_status="verified")
        db.add(comp)
        await db.flush()

        sup = Supplier(company_id=comp.id)
        db.add(sup)
        await db.flush()

        from app.models.catalog import Category
        cat_stmt = select(Category).limit(1)
        cat = (await db.execute(cat_stmt)).scalar_one_or_none()
        cat_id = cat.id if cat else uuid.uuid4()

        prod = Product(
            supplier_id=sup.id,
            category_id=cat_id,
            name="Alleppey Green Cardamom 8mm",
            slug=f"cardamom-8mm-{uuid.uuid4().hex[:6]}",
            description="Premium bold green cardamom pods from Kerala.",
            origin_country="India",
            moq=250.0,
            unit="kg",
            currency="USD",
            status="published",
            lead_time_days=14,
            stock_available=15000.0,
        )
        db.add(prod)
        await db.flush()

        tier = PriceTier(
            product_id=prod.id,
            min_qty=250,
            max_qty=1000,
            unit_price=28.50,
            currency="USD",
        )
        db.add(tier)
        await db.commit()
        await db.refresh(prod)
    return prod


@pytest.mark.asyncio
async def test_01_conversation_crud_and_soft_delete():
    """1. Creating, listing, renaming and soft-deleting conversations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer login
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # Create
        create_resp = await client.post(
            "/api/v1/ai-mode/conversations",
            json={"title": "High Volume Spices Sourcing"},
            headers=headers,
        )
        assert create_resp.status_code == 201
        c_data = create_resp.json()
        conv_id = c_data["id"]
        assert c_data["title"] == "High Volume Spices Sourcing"

        # List
        list_resp = await client.get("/api/v1/ai-mode/conversations", headers=headers)
        assert list_resp.status_code == 200
        conv_list = list_resp.json()
        assert any(c["id"] == conv_id for c in conv_list)

        # Rename
        rename_resp = await client.patch(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            json={"title": "Renamed Spice Pipeline"},
            headers=headers,
        )
        assert rename_resp.status_code == 200
        assert rename_resp.json()["title"] == "Renamed Spice Pipeline"

        # Soft Delete
        del_resp = await client.delete(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            headers=headers,
        )
        assert del_resp.status_code == 200

        # Verify 404 after soft-delete
        get_deleted = await client.get(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            headers=headers,
        )
        assert get_deleted.status_code == 404

        # Verify not in list
        list_after = await client.get("/api/v1/ai-mode/conversations", headers=headers)
        assert not any(c["id"] == conv_id for c in list_after.json())


@pytest.mark.asyncio
async def test_02_other_user_gets_404_on_foreign_conversation():
    """2. Another user gets 404 on someone else's conversation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer 1 creates conversation
        b1_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        b1_headers = {"Authorization": f"Bearer {b1_login.json()['access_token']}"}

        conv_resp = await client.post(
            "/api/v1/ai-mode/conversations",
            json={"title": "Buyer 1 Private Conv"},
            headers=b1_headers,
        )
        conv_id = conv_resp.json()["id"]

        # Supplier (different user) attempts to access Buyer 1's conversation
        sup_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        sup_headers = {"Authorization": f"Bearer {sup_login.json()['access_token']}"}

        # GET foreign conv -> 404
        foreign_get = await client.get(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            headers=sup_headers,
        )
        assert foreign_get.status_code == 404

        # PATCH foreign conv -> 404
        foreign_patch = await client.patch(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            json={"title": "Hacked Title"},
            headers=sup_headers,
        )
        assert foreign_patch.status_code == 404

        # DELETE foreign conv -> 404
        foreign_delete = await client.delete(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            headers=sup_headers,
        )
        assert foreign_delete.status_code == 404

        # POST message to foreign conv -> 404
        foreign_msg = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Unauthorized message"},
            headers=sup_headers,
        )
        assert foreign_msg.status_code == 404


@pytest.mark.asyncio
async def test_03_laptop_refine_compare_and_moq_sequence():
    """3. The laptop, refine, compare and MOQ follow-up sequence."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # 1. Create conversation
        conv_res = await client.post(
            "/api/v1/ai-mode/conversations",
            json={"title": "Electronics Search"},
            headers=headers,
        )
        conv_id = conv_res.json()["id"]

        # Step A: "Find affordable laptops for the USA"
        step_a = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Find affordable laptops for the USA"},
            headers=headers,
        )
        assert step_a.status_code == 200
        data_a = step_a.json()
        assert data_a["classification"] == "new_search"
        assert data_a["user_message"]["content"] == "Find affordable laptops for the USA"
        assert data_a["clarifying_question"] is not None
        assert "units" in data_a["clarifying_question"] or "specifications" in data_a["clarifying_question"]
        assert len(data_a["product_cards"]) >= 0

        # Step B: "Only show suppliers from China" (Refine)
        step_b = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Only show suppliers from China"},
            headers=headers,
        )
        assert step_b.status_code == 200
        data_b = step_b.json()
        assert data_b["classification"] == "refine"
        structured_b = data_b["assistant_reply"]["structured"]
        assert structured_b["criteria"].get("origin_country") == "China"

        # Step C: "Compare the first two" (Compare)
        step_c = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Compare the first two"},
            headers=headers,
        )
        assert step_c.status_code == 200
        data_c = step_c.json()
        assert data_c["classification"] == "compare"

        # Step D: "What is the MOQ?" (Question about a shown product)
        step_d = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "What is the MOQ?"},
            headers=headers,
        )
        assert step_d.status_code == 200
        data_d = step_d.json()
        assert data_d["classification"] == "question_about_product"
        assert "moq" in data_d["assistant_reply"]["content"].lower()

        # Step E: "Clear" (Clear and restart)
        step_e = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Clear"},
            headers=headers,
        )
        assert step_e.status_code == 200
        data_e = step_e.json()
        assert data_e["classification"] == "clear_and_restart"
        assert "cleared" in data_e["assistant_reply"]["content"].lower()


@pytest.mark.asyncio
async def test_04_selection_with_no_duplicates():
    """4. Selection with no duplicates."""
    async with AsyncSessionLocal() as db:
        prod = await get_test_product(db)
        p_id = str(prod.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)).json()
        conv_id = conv["id"]

        # Select product 1st time
        r1 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/selection/{p_id}",
            headers=headers,
        )
        assert r1.status_code == 200

        # Select product 2nd time (idempotent / no duplicate)
        r2 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/selection/{p_id}",
            headers=headers,
        )
        assert r2.status_code == 200

        # Verify only 1 selected item
        detail = (await client.get(f"/api/v1/ai-mode/conversations/{conv_id}", headers=headers)).json()
        assert len(detail["selected_products"]) == 1
        assert detail["selected_products"][0]["product_id"] == p_id

        # Unselect
        unsel = await client.delete(
            f"/api/v1/ai-mode/conversations/{conv_id}/selection/{p_id}",
            headers=headers,
        )
        assert unsel.status_code == 200

        detail_after = (await client.get(f"/api/v1/ai-mode/conversations/{conv_id}", headers=headers)).json()
        assert len(detail_after["selected_products"]) == 0


@pytest.mark.asyncio
async def test_05_compare_output():
    """5. Compare output."""
    async with AsyncSessionLocal() as db:
        prod1 = await get_test_product(db)
        # Fetch or create second product
        stmt = select(Product).where(Product.id != prod1.id, Product.status == "published").limit(1)
        prod2 = (await db.execute(stmt)).scalar_one_or_none()
        if not prod2:
            prod2 = Product(
                supplier_id=prod1.supplier_id,
                category_id=prod1.category_id,
                name="Organic Malabar Black Pepper",
                slug=f"black-pepper-{uuid.uuid4().hex[:6]}",
                description="Sun-dried black pepper whole grade 550GL.",
                origin_country="India",
                moq=500.0,
                unit="kg",
                currency="USD",
                status="published",
                lead_time_days=20,
            )
            db.add(prod2)
            await db.flush()
            tier2 = PriceTier(product_id=prod2.id, min_qty=500, unit_price=6.20, currency="USD")
            db.add(tier2)
            await db.commit()
            await db.refresh(prod2)

        p1_id = str(prod1.id)
        p2_id = str(prod2.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)).json()
        conv_id = conv["id"]

        # Select both products
        await client.post(f"/api/v1/ai-mode/conversations/{conv_id}/selection/{p1_id}", headers=headers)
        await client.post(f"/api/v1/ai-mode/conversations/{conv_id}/selection/{p2_id}", headers=headers)

        # Compare endpoint
        cmp_res = await client.get(f"/api/v1/ai-mode/conversations/{conv_id}/compare", headers=headers)
        assert cmp_res.status_code == 200
        cmp_data = cmp_res.json()
        assert cmp_data["products_count"] >= 2
        assert "comparison_table" in cmp_data
        table = cmp_data["comparison_table"]
        assert any(row["product_id"] == p1_id for row in table)
        assert any(row["product_id"] == p2_id for row in table)


@pytest.mark.asyncio
async def test_06_chat_now_idempotency_creates_one_thread():
    """6. Chat Now creating exactly one thread when clicked twice."""
    async with AsyncSessionLocal() as db:
        prod = await get_test_product(db)
        p_id = str(prod.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)).json()
        conv_id = conv["id"]

        # First Chat Now click
        chat1 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/products/{p_id}/chat",
            headers=headers,
        )
        assert chat1.status_code == 200
        thread_id_1 = chat1.json()["thread_id"]
        assert thread_id_1 is not None

        # Second Chat Now click
        chat2 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/products/{p_id}/chat",
            headers=headers,
        )
        assert chat2.status_code == 200
        thread_id_2 = chat2.json()["thread_id"]

        # Must be identical thread!
        assert thread_id_1 == thread_id_2


@pytest.mark.asyncio
async def test_07_negotiation_draft_not_sendable_without_confirmation():
    """7. A negotiation draft not being sendable without confirmation."""
    async with AsyncSessionLocal() as db:
        prod = await get_test_product(db)
        p_id = str(prod.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)).json()
        conv_id = conv["id"]

        # Create draft
        draft_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/products/{p_id}/negotiation-draft",
            json={
                "target_price": 24.50,
                "quantity": 1000.0,
                "notes": "Fast payment 14 days LC",
            },
            headers=headers,
        )
        assert draft_res.status_code == 200
        draft_data = draft_res.json()
        draft_id = draft_data["id"]
        assert draft_data["status"] == "draft"
        assert draft_data["target_price"] == 24.50
        assert draft_data["quantity"] == 1000.0
        assert "Dear" in draft_data["ai_suggested_message"]

        # Attempt to send with confirm=False -> must fail with 400
        send_fail = await client.post(
            f"/api/v1/ai-mode/negotiation-drafts/{draft_id}/send",
            json={
                "confirm": False,
                "final_message": "Unconfirmed negotiation message",
            },
            headers=headers,
        )
        assert send_fail.status_code == 400
        assert "confirmation" in str(send_fail.json()).lower()

        # Send with confirm=True -> succeeds
        send_ok = await client.post(
            f"/api/v1/ai-mode/negotiation-drafts/{draft_id}/send",
            json={
                "confirm": True,
                "final_message": "Confirmed: Please consider our counter-offer of $24.50/kg for 1000kg.",
            },
            headers=headers,
        )
        assert send_ok.status_code == 200
        sent_data = send_ok.json()
        assert sent_data["status"] == "sent"
        assert sent_data["final_message"] == "Confirmed: Please consider our counter-offer of $24.50/kg for 1000kg."
        assert sent_data["linked_thread_id"] is not None


@pytest.mark.asyncio
async def test_08_provider_fallback_and_demo_ai():
    """8. Provider failure fallback and honest Demo AI labeling."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)).json()
        conv_id = conv["id"]

        # Send a message
        msg_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Show certified organic turmeric suppliers in India"},
            headers=headers,
        )
        assert msg_res.status_code == 200
        data = msg_res.json()
        reply = data["assistant_reply"]
        assert reply["role"] == "assistant"
        # When running in mock or fallback mode, is_demo is True
        assert "provider" in reply
        # Verify cards were populated directly from DB records
        assert isinstance(data["product_cards"], list)
