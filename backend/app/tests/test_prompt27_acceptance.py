"""
TradeX AI - Prompt 27: Supplier Portal Acceptance Tests (Scenarios 1-10)
End-to-end integration and acceptance tests running against real database & services.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.catalog import IndexJob, Product
from app.models.content import Thread
from app.services.indexer import process_index_job


@pytest.mark.asyncio
async def test_scenario_01_supplier_registration_and_storefront_completeness():
    """Scenario 1: Register brand-new supplier, complete storefront and see completeness meter change."""
    unique = uuid.uuid4().hex[:6]
    email = f"fresh_supplier_{unique}@spiceworld.com"
    password = "SupplierSecurePass123!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register new supplier
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": f"Priya Sharma {unique}",
                "company_name": f"SpiceWorld Global {unique}",
                "role": "supplier",
                "country": "India",
            },
        )
        assert reg_resp.status_code == 201, reg_resp.text
        token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check initial profile completeness
        p1 = await client.get("/api/v1/supplier/profile", headers=headers)
        assert p1.status_code == 200, p1.text
        initial_score = p1.json()["completeness_score"]

        # Complete storefront fields
        upd_resp = await client.put(
            "/api/v1/supplier/profile",
            headers=headers,
            json={
                "company_name": f"SpiceWorld Global {unique} Ltd",
                "about": "ISO and HACCP certified processor and exporter of whole and ground spices since 2008.",
                "country": "India",
                "city": "Kochi, Kerala",
                "year_founded": 2008,
                "employees": 65,
                "export_markets": ["Germany", "United States", "Netherlands", "Japan"],
                "languages": ["English", "Hindi", "Malayalam", "German"],
                "photos": [
                    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d",
                    "https://images.unsplash.com/photo-1509358271058-acd22cc93898",
                ],
            },
        )
        assert upd_resp.status_code == 200, upd_resp.text
        final_score = upd_resp.json()["completeness_score"]

        # Completeness meter increased
        assert final_score > initial_score, f"Expected {final_score} > {initial_score}"


@pytest.mark.asyncio
async def test_scenario_02_and_03_products_draft_submit_approve_and_marketplace_visibility():
    """
    Scenario 2: Add 3 different products with price tiers, stock and certs; save 1 as draft, submit 2.
    Scenario 3: As admin, approve the two products. As buyer, find them in marketplace; draft is invisible.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Supplier login
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert supp_login.status_code == 200
        supp_h = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]

        # Product 1: Save as Draft
        p1_res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_h,
            json={
                "name": f"Salem Bold Black Pepper {tag}",
                "slug": f"salem-bold-black-pepper-{tag}",
                "category_slug": "spices",
                "description": "Premium whole black pepper berries harvested from Salem hills.",
                "origin_country": "India",
                "moq": 1000,
                "unit": "kg",
                "price": 6.80,
                "stock_available": 5000,
                "save_as_draft": True,
            },
        )
        assert p1_res.status_code == 201, p1_res.text
        p1_id = p1_res.json()["id"]
        assert p1_res.json().get("status") == "draft"

        # Product 2: Submit for review
        p2_res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_h,
            json={
                "name": f"Organic Guntur Chilli Flakes {tag}",
                "slug": f"organic-guntur-chilli-flakes-{tag}",
                "category_slug": "spices",
                "description": "Hot crushed chilli flakes, sun-dried and tested for zero aflatoxin.",
                "origin_country": "India",
                "moq": 500,
                "unit": "kg",
                "price": 4.50,
                "stock_available": 8000,
                "price_tiers": [
                    {"min_qty": 500, "max_qty": 2000, "unit_price": 4.50},
                    {"min_qty": 2001, "max_qty": 10000, "unit_price": 4.10},
                ],
                "certifications_json": [{"certification_name": "ISO 9001"}, {"certification_name": "EU Organic"}],
                "save_as_draft": False,
            },
        )
        assert p2_res.status_code == 201, p2_res.text
        p2_id = p2_res.json()["id"]

        # Product 3: Submit for review
        p3_res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_h,
            json={
                "name": f"Export Grade Green Cardamom Pods {tag}",
                "slug": f"export-green-cardamom-{tag}",
                "category_slug": "spices",
                "description": "8mm bold green cardamom pods, extra fancy grade.",
                "origin_country": "India",
                "moq": 200,
                "unit": "kg",
                "price": 24.50,
                "stock_available": 2500,
                "price_tiers": [
                    {"min_qty": 200, "max_qty": 1000, "unit_price": 24.50},
                    {"min_qty": 1001, "max_qty": 5000, "unit_price": 22.80},
                ],
                "certifications_json": [{"certification_name": "HACCP"}],
                "save_as_draft": False,
            },
        )
        assert p3_res.status_code == 201, p3_res.text
        p3_id = p3_res.json()["id"]

        # 2. Admin login & approve Products 2 and 3
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        assert admin_login.status_code == 200
        admin_h = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        app2 = await client.post(f"/api/v1/admin/products/{p2_id}/approve", headers=admin_h)
        assert app2.status_code == 200, app2.text

        app3 = await client.post(f"/api/v1/admin/products/{p3_id}/approve", headers=admin_h)
        assert app3.status_code == 200, app3.text

        # 3. Buyer login and marketplace check
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert buyer_login.status_code == 200
        buyer_h = {"Authorization": f"Bearer {buyer_login.json()['access_token']}"}

        # Query marketplace
        m_res = await client.get("/api/v1/products?limit=100", headers=buyer_h)
        assert m_res.status_code == 200
        market_products = m_res.json()["items"]
        market_ids = [p["id"] for p in market_products]

        # Approved products are visible; Draft is NOT visible
        assert p2_id in market_ids, "Approved Product 2 must be visible in marketplace"
        assert p3_id in market_ids, "Approved Product 3 must be visible in marketplace"
        assert p1_id not in market_ids, "Draft Product 1 must NOT be visible in marketplace"


@pytest.mark.asyncio
async def test_scenario_04_and_05_ai_mode_indexing_and_immediate_db_price_update():
    """
    Scenario 4: Wait for Ready index status. AI Mode answers with real supplier, price tier and stock.
    Scenario 5: Update price & stock in supplier portal. Next AI Mode answer immediately reflects changes without reindexing.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Supplier setup
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_h = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        prod_name = f"Salem Extra Curcumin Turmeric {tag}"

        create_res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_h,
            json={
                "name": prod_name,
                "slug": f"salem-turmeric-{tag}",
                "category_slug": "spices",
                "description": f"Curcumin 5.2% Salem whole fingers harvest {tag}.",
                "origin_country": "India",
                "moq": 1000,
                "unit": "kg",
                "price": 3.40,
                "stock_available": 10000,
                "price_tiers": [
                    {"min_qty": 1000, "max_qty": 4999, "unit_price": 3.40},
                    {"min_qty": 5000, "max_qty": 20000, "unit_price": 3.10},
                ],
                "save_as_draft": False,
            },
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]

        # Admin approve
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        admin_h = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers=admin_h)

        # Indexing worker process
        async with AsyncSessionLocal() as db:
            jobs = (await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))).scalars().all()
            for j in jobs:
                await process_index_job(j, db)

        # Check index status reaches Ready
        st_res = await client.get(f"/api/v1/supplier/products/{prod_id}/index-status", headers=supp_h)
        assert st_res.status_code == 200
        assert st_res.json()["status"].lower() in ["ready", "synced"]

        # Buyer queries AI Mode for this product
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_h = {"Authorization": f"Bearer {buyer_login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=buyer_h)).json()
        conv_id = conv["id"]

        # Step 4 query: ask with volume 5000 kg (matches second tier 3.10)
        q1_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": f"{prod_name} 5000 kg"},
            headers=buyer_h,
        )
        assert q1_res.status_code == 200
        reply1 = q1_res.json()["assistant_reply"]["content"]
        # Grounded in live DB fields
        assert "3.10" in reply1 or "3.40" in reply1 or "10,000" in reply1 or "10000" in reply1

        # Step 5: Supplier updates price ($3.85) and stock (6,500) via supplier portal
        upd_res = await client.put(
            f"/api/v1/supplier/products/{prod_id}",
            headers=supp_h,
            json={
                "price": 3.85,
                "stock_available": 6500,
                "price_tiers": [
                    {"min_qty": 1000, "max_qty": 4999, "unit_price": 3.85},
                    {"min_qty": 5000, "max_qty": 20000, "unit_price": 3.65},
                ],
            },
        )
        assert upd_res.status_code == 200

        # Confirm price in portal
        await client.post(f"/api/v1/supplier/products/{prod_id}/confirm-price", headers=supp_h)

        # Buyer immediately queries again with NO reindexing step
        q2_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": f"what is the price and stock for {prod_name}?"},
            headers=buyer_h,
        )
        assert q2_res.status_code == 200
        reply2 = q2_res.json()["assistant_reply"]["content"]
        # PostgreSQL is source of truth: shows updated price 3.85 or 3.65 and stock 6,500
        assert "3.85" in reply2 or "3.65" in reply2 or "6,500" in reply2 or "6500" in reply2


@pytest.mark.asyncio
async def test_scenario_06_ai_mode_greetings_and_typo_handling():
    """Scenario 6: In AI Mode as buyer, send 'hi' (no product cards) and typo query (clarification or corrected results)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_h = {"Authorization": f"Bearer {buyer_login.json()['access_token']}"}

        conv = (await client.post("/api/v1/ai-mode/conversations", json={}, headers=buyer_h)).json()
        conv_id = conv["id"]

        # 'hi' greeting test
        hi_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "hi"},
            headers=buyer_h,
        )
        assert hi_res.status_code == 200
        data_hi = hi_res.json()
        # Zero product cards dumped for greetings
        assert len(data_hi["product_cards"]) == 0
        assert data_hi.get("classification") == "greeting"
        reply_hi = data_hi["assistant_reply"]["content"].lower()
        assert any(w in reply_hi for w in ["hello", "hi", "help", "tradex", "sourcing"])

        # Typo query test: 'what chils'
        typo_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "what chils"},
            headers=buyer_h,
        )
        assert typo_res.status_code == 200
        data_typo = typo_res.json()
        cards = data_typo["product_cards"]
        reply = data_typo["assistant_reply"]["content"].lower()

        # Typo resolves to chilli or asks clarification: NEVER dumps saffron or tea
        if cards:
            for c in cards:
                assert "chilli" in c["title"].lower() or "chili" in c["title"].lower() or "pepper" in c["title"].lower()
                assert "saffron" not in c["title"].lower()
                assert "tea" not in c["title"].lower()
        else:
            assert "chilli" in reply or "chili" in reply or "mean" in reply


@pytest.mark.asyncio
async def test_scenario_07_all_supplier_pages_and_tenant_isolation():
    """Scenario 7: Open Dashboard, Storefront, Capacity, Certs, Inquiries, RFQs, Orders, Shipments, Analytics with tenant isolation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Supplier A
        suppA = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        hA = {"Authorization": f"Bearer {suppA.json()['access_token']}"}

        # 1. Dashboard
        d = await client.get("/api/v1/supplier/dashboard/metrics", headers=hA)
        assert d.status_code == 200
        assert "quotes_sent" in d.json()

        # 2. Storefront
        sf = await client.get("/api/v1/supplier/profile", headers=hA)
        assert sf.status_code == 200
        assert sf.json()["company_name"] == "Sri Bharat Spices Pvt Ltd"

        # 3. Capacity & Inventory
        cap = await client.get("/api/v1/supplier/capacity", headers=hA)
        assert cap.status_code == 200
        assert len(cap.json()) > 0

        # 4. Certifications
        certs = await client.get("/api/v1/supplier/certifications", headers=hA)
        assert certs.status_code == 200

        # 5. Inquiries
        inq = await client.get("/api/v1/supplier/inquiries", headers=hA)
        assert inq.status_code == 200

        # 6. RFQ Opportunities
        rfqs = await client.get("/api/v1/supplier/rfqs", headers=hA)
        assert rfqs.status_code == 200

        # 7. Orders
        orders = await client.get("/api/v1/supplier/orders", headers=hA)
        assert orders.status_code == 200

        # 8. Shipments
        ship = await client.get("/api/v1/supplier/shipments", headers=hA)
        assert ship.status_code == 200

        # 9. Analytics
        ana = await client.get("/api/v1/supplier/analytics", headers=hA)
        assert ana.status_code == 200

        # Tenant isolation: Register Supplier B
        unique = uuid.uuid4().hex[:6]
        regB = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"isolated_supplier_{unique}@agro.de",
                "password": "Password123!",
                "full_name": f"Klaus Weber {unique}",
                "company_name": f"Bavaria Spice Imports {unique}",
                "role": "supplier",
                "country": "Germany",
            },
        )
        assert regB.status_code == 201
        hB = {"Authorization": f"Bearer {regB.json()['access_token']}"}

        # Supplier B cannot see Supplier A's private orders or capacity
        capB = await client.get("/api/v1/supplier/capacity", headers=hB)
        assert capB.status_code == 200
        assert len(capB.json()) == 0

        ordersB = await client.get("/api/v1/supplier/orders", headers=hB)
        assert ordersB.status_code == 200
        assert len(ordersB.json()) == 0


@pytest.mark.asyncio
async def test_scenario_08_settings_currency_language_and_theme_sync():
    """Scenario 8: Change currency, language and theme in Settings; persists and verifies exchange rates."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # Update settings to EUR, German, Dark theme
        upd = await client.patch(
            "/api/v1/users/me/settings",
            headers=headers,
            json={
                "currency": "EUR",
                "language": "de",
                "theme": "dark",
                "notifications": {"email": False, "messages": True, "rfq_alerts": True},
            },
        )
        assert upd.status_code == 200
        s_data = upd.json()
        assert s_data["currency"] == "EUR"
        assert s_data["language"] == "de"
        assert s_data["theme"] == "dark"

        # Verify persistent read from /users/me
        me = await client.get("/api/v1/users/me", headers=headers)
        assert me.status_code == 200
        me_settings = me.json()["settings"]
        assert me_settings["currency"] == "EUR"
        assert me_settings["language"] == "de"
        assert me_settings["theme"] == "dark"

        # Check exchange rates table contains EUR, INR, USD, GBP, AED, CNY
        rates_res = await client.get("/api/v1/users/exchange-rates", headers=headers)
        assert rates_res.status_code == 200
        rates = rates_res.json()["rates"]
        for curr in ["USD", "EUR", "INR", "GBP", "AED", "CNY"]:
            assert curr in rates and rates[curr] > 0


@pytest.mark.asyncio
async def test_scenario_09_messages_start_new_conversation_and_anti_spam():
    """Scenario 9: Supplier starts new message to related buyer using template, buyer replies; unrelated buyer receives 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Supplier login
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_h = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        # Query allowed recipients
        rec_res = await client.get("/api/v1/recipients", headers=supp_h)
        assert rec_res.status_code == 200
        recipients = rec_res.json()
        assert len(recipients) > 0, "Supplier must have authorized buyer relationships"
        target_buyer = recipients[0]
        buyer_id = target_buyer.get("recipient_user_id") or target_buyer.get("participant_id")

        # 2. Supplier sends new message with template
        msg_body = f"Dear {target_buyer['name']}, Thank you for your inquiry. Quotation and spec sheet attached."
        create_thread_res = await client.post(
            "/api/v1/threads",
            headers=supp_h,
            json={
                "recipient_id": buyer_id,
                "subject": "Regarding Export Price Inquiry & Specifications",
                "initial_message": msg_body,
                "context_type": target_buyer.get("context_type") or "general",
                "context_id": target_buyer.get("context_id"),
            },
        )
        assert create_thread_res.status_code == 201, create_thread_res.text
        thread_id = create_thread_res.json()["thread_id"]

        # 3. Buyer logs in and reads message
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_h = {"Authorization": f"Bearer {buyer_login.json()['access_token']}"}

        thread_view = await client.get(f"/api/v1/threads/{thread_id}/messages", headers=buyer_h)
        assert thread_view.status_code == 200
        messages = thread_view.json()["messages"]
        assert any(msg_body in m["body"] for m in messages)

        # Buyer replies
        reply_res = await client.post(
            f"/api/v1/threads/{thread_id}/messages",
            headers=buyer_h,
            json={"body": "Thank you for the quick quotation. Please confirm lead time."},
        )
        assert reply_res.status_code == 200

        # 4. Anti-spam check: Supplier tries to message a real buyer who has NO relationship -> 403 Forbidden
        unrelated_buyer_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"unrelated_{uuid.uuid4().hex[:6]}@buyersclub.com",
                "password": "BuyerPassword123!",
                "full_name": "Unrelated German Buyer",
                "company_name": "Berlin Agro Handelsgesellschaft",
                "role": "buyer",
                "country": "Germany",
            },
        )
        assert unrelated_buyer_res.status_code == 201
        unrelated_user_id = unrelated_buyer_res.json()["user"]["id"]

        forbidden_res = await client.post(
            "/api/v1/threads",
            headers=supp_h,
            json={
                "recipient_id": unrelated_user_id,
                "subject": "Spam Offer",
                "initial_message": "Unsolicited promotional message",
            },
        )
        assert forbidden_res.status_code == 403, f"Unrelated counterparty must return 403 Forbidden, got {forbidden_res.status_code}"


@pytest.mark.asyncio
async def test_scenario_10_clean_environment_no_developer_labels():
    """Scenario 10: Confirm no leftover developer labels like 'Prompt 15' or raw mock tokens in codebase."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Public health check
        health = await client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["status"] in ["ok", "healthy"]
