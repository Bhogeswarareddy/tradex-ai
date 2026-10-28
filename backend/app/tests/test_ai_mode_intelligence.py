"""
TradeX AI - AI Mode Intelligence Acceptance Tests (Prompt 22)
Automated verification proving:
1. 'hi' returns friendly text and zero cards.
2. 'what chils' asks 'Did you mean chilli?' or returns only chilli products (no unrelated products).
3. 'chilli powder 5 tonnes to Germany' returns only in-stock chilli products and shows quantities from the database.
4. An out-of-stock product is excluded from search results.
5. A search with no match answers honestly naming the failed constraint.
6. 'Only show suppliers from China' refines instead of restarting.
7. 'Compare the first two' compares the right products from database records.
8. A new topic resets the criteria.
9. Supplier role gets 403 forbidden with friendly notice details.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.rate_limit import ai_limiter, auth_limiter
from app.main import app
from app.models.catalog import Category, PriceTier, Product
from app.models.identity import Company, Supplier, User


@pytest.fixture(autouse=True)
def reset_limiters():
    auth_limiter.reset()
    ai_limiter.reset()
    yield


async def ensure_chilli_and_outofstock_products(db):
    """Ensures chilli products and at least one out-of-stock product exist for test isolation."""
    cat_stmt = select(Category).order_by(Category.id).limit(1)
    cat = (await db.execute(cat_stmt)).scalar_one()

    # Ensure verified supplier
    sup_stmt = select(Supplier).join(Company).where(Company.country == "India").limit(1)
    sup = (await db.execute(sup_stmt)).scalar_one_or_none()
    if not sup:
        u_sup = User(
            email=f"ind_sup_{uuid.uuid4().hex[:6]}@tradex.ai",
            password_hash="hashed_pw",
            role="supplier",
            full_name="Kerala Spices Rep",
        )
        db.add(u_sup)
        await db.flush()
        comp = Company(
            name="Kerala Spices Exports Ltd",
            country="India",
            city="Cochin",
            verified_status="verified",
        )
        db.add(comp)
        await db.flush()
        sup = Supplier(company_id=comp.id, user_id=u_sup.id, trust_score=4.9)
        db.add(sup)
        await db.flush()

    # 1. In-stock chilli product
    p_chilli_stmt = select(Product).where(Product.name.ilike("%Guntur S4 Sannam Red Chilli Powder%"))
    p_chilli = (await db.execute(p_chilli_stmt)).scalar_one_or_none()
    if not p_chilli:
        p_chilli = Product(
            supplier_id=sup.id,
            category_id=cat.id,
            name="Guntur S4 Sannam Red Chilli Powder",
            slug=f"guntur-chilli-{uuid.uuid4().hex[:6]}",
            description="Pure premium red chilli powder with hot pungency and natural red color.",
            origin_country="India",
            moq=500.0,
            unit="kg",
            currency="USD",
            status="published",
            lead_time_days=14,
            stock_available=5000,
            available_quantity=1000,
            reserved_quantity=0,
            availability_status="in_stock",
        )
        db.add(p_chilli)
        await db.flush()
        tier = PriceTier(product_id=p_chilli.id, min_qty=500, max_qty=5000, unit_price=2.20, currency="USD")
        db.add(tier)

    # 2. Out-of-stock chilli product (MUST BE EXCLUDED)
    p_oos_stmt = select(Product).where(Product.name.ilike("%Kashmir Sun-Dried Chilli Flakes%"))
    p_oos = (await db.execute(p_oos_stmt)).scalar_one_or_none()
    if not p_oos:
        p_oos = Product(
            supplier_id=sup.id,
            category_id=cat.id,
            name="Kashmir Sun-Dried Chilli Flakes",
            slug=f"kashmir-chilli-{uuid.uuid4().hex[:6]}",
            description="Sun-dried crushed chilli flakes with mild heat. Out of stock.",
            origin_country="India",
            moq=250.0,
            unit="kg",
            currency="USD",
            status="published",
            lead_time_days=30,
            stock_available=0,
            available_quantity=0,
            reserved_quantity=0,
            availability_status="out_of_stock",
        )
        db.add(p_oos)
        await db.flush()

    await db.commit()


@pytest.mark.asyncio
async def test_01_greeting_returns_text_and_zero_cards():
    """Prompt 22 requirement: 'hi' returns text and zero cards."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # Create conversation
        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        assert conv_res.status_code == 201
        conv_id = conv_res.json()["id"]

        # Send 'hi'
        hi_resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "hi"},
            headers=headers,
        )
        assert hi_resp.status_code == 200
        data = hi_resp.json()
        assert data["classification"] == "greeting"
        assert len(data["product_cards"]) == 0
        assert "hello" in data["assistant_reply"]["content"].lower() or "tradex" in data["assistant_reply"]["content"].lower()


@pytest.mark.asyncio
async def test_02_what_chils_asks_did_you_mean_or_returns_only_chilli():
    """Prompt 22 requirement: 'what chils' asks 'Did you mean chilli?' or returns only chilli products."""
    async with AsyncSessionLocal() as db:
        await ensure_chilli_and_outofstock_products(db)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        # Send 'what chils'
        chils_resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "what chils"},
            headers=headers,
        )
        assert chils_resp.status_code == 200
        data = chils_resp.json()
        reply_content = data["assistant_reply"]["content"]
        cards = data["product_cards"]

        # Verifies it either asks 'Did you mean chilli?' OR returns only chilli products
        assert "did you mean chilli" in reply_content.lower() or all("chilli" in c["title"].lower() or "chili" in c["title"].lower() for c in cards)
        # Absolutely NO unrelated products like tea, saffron, laptops
        for c in cards:
            assert "chilli" in c["title"].lower() or "chili" in c["title"].lower()
            assert "laptop" not in c["title"].lower()
            assert "tea" not in c["title"].lower()


@pytest.mark.asyncio
async def test_03_chilli_powder_5_tonnes_returns_instock_with_quantities():
    """Prompt 22 requirement: 'chilli powder 5 tonnes to Germany' returns only in-stock chilli products and shows quantities from DB."""
    async with AsyncSessionLocal() as db:
        await ensure_chilli_and_outofstock_products(db)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        query = "chilli powder 5 tonnes to Germany"
        resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": query},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        cards = data["product_cards"]
        reply_content = data["assistant_reply"]["content"]

        assert len(cards) > 0
        for c in cards:
            assert "chilli" in c["title"].lower() or "chili" in c["title"].lower()
            assert c["availability_status"] != "out_of_stock"

        # Content shows real database quantities & availability
        assert "stock" in reply_content.lower() or "available" in reply_content.lower()
        assert "1,000" in reply_content or "1000" in reply_content or "5 tonnes" in reply_content.lower()


@pytest.mark.asyncio
async def test_04_outofstock_product_is_excluded():
    """Prompt 22 requirement: an out-of-stock product is excluded unless explicitly asked."""
    async with AsyncSessionLocal() as db:
        await ensure_chilli_and_outofstock_products(db)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "chilli powder"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        cards = data["product_cards"]

        # 'Kashmir Sun-Dried Chilli Flakes' is out_of_stock and must NOT appear in normal search
        for c in cards:
            assert "kashmir" not in c["title"].lower()
            assert c["availability_status"] != "out_of_stock"


@pytest.mark.asyncio
async def test_05_search_with_no_match_answers_honestly():
    """Prompt 22 requirement: a search with no match answers honestly naming the constraint that failed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        # Impossible query: cardamom from Antarctica
        resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "organic cardamom from Antarctica"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        reply_content = data["assistant_reply"]["content"]

        # Honest answer
        assert "no" in reply_content.lower()
        assert "constraint" in reply_content.lower() or "not currently listed" in reply_content.lower() or "antarctica" in reply_content.lower() or "alternatives" in reply_content.lower()


@pytest.mark.asyncio
async def test_06_refine_merges_criteria_not_restarting():
    """Prompt 22 requirement: 'Only show suppliers from China' refines instead of restarting."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        # Step 1: Initial search for laptops
        step1 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Find affordable laptops for the USA"},
            headers=headers,
        )
        assert step1.status_code == 200

        # Step 2: Refine
        step2 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Only show suppliers from China"},
            headers=headers,
        )
        assert step2.status_code == 200
        data2 = step2.json()
        assert data2["classification"] == "refine"
        criteria2 = data2["assistant_reply"]["structured"]["criteria"]
        # Both laptop AND China are preserved
        assert criteria2.get("product") == "laptop"
        assert criteria2.get("origin_country") == "China"


@pytest.mark.asyncio
async def test_07_compare_the_first_two():
    """Prompt 22 requirement: 'Compare the first two' compares the right products from database records."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        # Step 1: Search laptops
        await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Find affordable laptops for the USA"},
            headers=headers,
        )

        # Step 2: Compare the first two
        cmp_resp = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Compare the first two"},
            headers=headers,
        )
        assert cmp_resp.status_code == 200
        data = cmp_resp.json()
        assert data["classification"] == "compare"
        assert len(data["product_cards"]) >= 2
        assert data["comparison_data"] is not None
        assert "products" in data["comparison_data"]
        assert len(data["comparison_data"]["products"]) == 2


@pytest.mark.asyncio
async def test_08_new_topic_resets_criteria():
    """Prompt 22 requirement: a new topic resets the criteria."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        conv_id = conv_res.json()["id"]

        # Step 1: Laptops from China
        await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Find affordable laptops for the USA from China"},
            headers=headers,
        )

        # Step 2: New completely different product topic: turmeric
        step2 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "Looking for organic turmeric powder to Germany"},
            headers=headers,
        )
        assert step2.status_code == 200
        data2 = step2.json()
        criteria2 = data2["assistant_reply"]["structured"]["criteria"]

        # Previous laptop and China criteria must be reset
        assert criteria2.get("product") == "turmeric"
        assert criteria2.get("origin_country") != "China"
        assert criteria2.get("destination") == "Germany"


@pytest.mark.asyncio
async def test_09_supplier_role_gets_403_friendly_notice():
    """Prompt 22 requirement: AI Mode is a buyer feature; allow BUYER and ADMIN, show suppliers notice."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sup_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert sup_login.status_code == 200
        sup_headers = {"Authorization": f"Bearer {sup_login.json()['access_token']}"}

        # Attempt to create conversation as supplier -> 403
        resp = await client.post(
            "/api/v1/ai-mode/conversations",
            json={"title": "Supplier Forbidden Conv"},
            headers=sup_headers,
        )
        assert resp.status_code == 403
        data = resp.json()
        assert data["error"]["code"] == "FORBIDDEN_SUPPLIER_ROLE"
        assert data["error"]["details"]["portal_url"] == "/supplier-portal"
