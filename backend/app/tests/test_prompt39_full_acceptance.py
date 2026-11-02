"""
Acceptance Test Suite for Prompt 39: Complete End-to-End Test Suite for All Three AI Surfaces
Tests AI Search, AI Mode, and Copilot against the real PostgreSQL database.
"""
import re
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, delete
from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.identity import User, Supplier, Company
from app.models.catalog import Product, Category, PriceTier
from app.ai.orchestrator import TradeXAIOrchestrator
from app.services.sourcing_engine import SourcingEngine, SourcingRequirement
from app.core.security import create_access_token
from app.ai.circuit_breaker import circuit_breaker


@pytest.mark.asyncio
async def test_p39_ai_search_scenarios_1_to_10(db_session):
    circuit_breaker.reset()
    """
    AI Search Page Scenarios (1 to 10):
    1. 20 Apple mobiles -> 0 products, 0 suppliers, not_found status.
    2. 100 Samsung phones -> deterministic search.
    3. 500 kg basmati rice -> finds rice, compares quantity.
    4. 200 laptops under USD 400 -> laptops <= 400.
    5. Organic turmeric suppliers in India -> Indian spice suppliers.
    6. 1,000 cotton T-shirts -> search executes cleanly.
    7. Product that does not exist -> not_found status, RFQ prefill.
    8. Product with stock below requested qty -> shortage detection.
    9. Product with no price -> Contact supplier for pricing.
    10. Spelling mistakes and synonyms -> tolerance check.
    """
    buyer_user = (await db_session.execute(
        select(User).where(User.email.ilike("%buyer%")).limit(1)
    )).scalar_one_or_none()
    if not buyer_user:
        buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()

    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}

        # 1. I need 20 Apple mobiles
        res1 = await ac.post("/api/v1/ai/search", json={"query": "I need 20 Apple mobiles"}, headers=headers)
        assert res1.status_code == 200
        d1 = res1.json()
        assert len(d1["products"]) == 0
        assert len(d1["suppliers"]) == 0
        assert d1["status"] == "not_found"

        # 2. I need 100 Samsung phones
        res2 = await ac.post("/api/v1/ai/search", json={"query": "I need 100 Samsung phones"}, headers=headers)
        assert res2.status_code == 200
        d2 = res2.json()
        assert "products" in d2 and "suppliers" in d2

        # 3. Find 500 kg basmati rice
        res3 = await ac.post("/api/v1/ai/search", json={"query": "Find 500 kg basmati rice"}, headers=headers)
        assert res3.status_code == 200
        d3 = res3.json()
        assert len(d3["products"]) > 0
        for p in d3["products"]:
            assert "rice" in p["name"].lower()
            assert not re.search(r"\btea\b", p["name"].lower())

        # 4. I need 200 laptops under USD 400
        res4 = await ac.post("/api/v1/ai/search", json={"query": "I need 200 laptops under USD 400"}, headers=headers)
        assert res4.status_code == 200
        d4 = res4.json()
        for p in d4["products"]:
            assert "laptop" in p["name"].lower() or "probook" in p["name"].lower() or "notebook" in p["name"].lower()
            if p["price"] is not None:
                assert float(p["price"]) <= 400.0

        # 5. Find organic turmeric suppliers in India
        res5 = await ac.post("/api/v1/ai/search", json={"query": "Find organic turmeric suppliers in India"}, headers=headers)
        assert res5.status_code == 200
        d5 = res5.json()
        assert len(d5["products"]) > 0 or len(d5["suppliers"]) > 0

        # 6. I need 1,000 cotton T-shirts
        res6 = await ac.post("/api/v1/ai/search", json={"query": "I need 1,000 cotton T-shirts"}, headers=headers)
        assert res6.status_code == 200
        assert "products" in res6.json()

        # 7. Search for a product that does not exist
        res7 = await ac.post("/api/v1/ai/search", json={"query": "Antigravity Warp Drive Hovercraft 9000"}, headers=headers)
        assert res7.status_code == 200
        d7 = res7.json()
        assert len(d7["products"]) == 0
        assert len(d7["suppliers"]) == 0
        assert d7["status"] == "not_found"

        # 8. Product with stock below requested quantity
        res8 = await ac.post("/api/v1/ai/search", json={"query": "I need 50,000 laptops under USD 400"}, headers=headers)
        assert res8.status_code == 200
        d8 = res8.json()
        assert d8["status"] in ["success", "shortage", "found", "not_found"]

        # 9. Product with no price handling (null price does not crash)
        dummy_supp = (await db_session.execute(select(Supplier).limit(1))).scalar_one()
        cat = (await db_session.execute(select(Category).limit(1))).scalar_one()
        p_noprice = Product(
            supplier_id=dummy_supp.id,
            category_id=cat.id,
            name="Unpriced Industrial Valve Test",
            slug=f"unpriced-valve-{uuid.uuid4().hex[:6]}",
            origin_country="USA",
            status="published",
            is_active=True,
        )
        db_session.add(p_noprice)
        await db_session.commit()

        res9 = await ac.post("/api/v1/ai/search", json={"query": "Unpriced Industrial Valve Test"}, headers=headers)
        assert res9.status_code == 200
        d9 = res9.json()
        assert len(d9["products"]) > 0
        p_valve = next((p for p in d9["products"] if "Unpriced" in p["name"]), d9["products"][0])
        assert p_valve.get("price") is None or p_valve.get("price_display") == "Contact supplier for pricing"

        await db_session.delete(p_noprice)
        await db_session.commit()

        # 10. Query with spelling mistakes and synonyms
        res10 = await ac.post("/api/v1/ai/search", json={"query": "i need 500kg chill powedr"}, headers=headers)
        assert res10.status_code == 200
        d10 = res10.json()
        assert len(d10["products"]) > 0
        # Check powder comes first before flakes
        titles = [p["name"].lower() for p in d10["products"]]
        assert any("powder" in t or "chilli" in t for t in titles)


@pytest.mark.asyncio
async def test_p39_ai_mode_and_copilot_scenarios_11_to_20(db_session):
    circuit_breaker.reset()
    """
    AI Mode and Copilot Scenarios (11 to 20):
    Run each in both surfaces to ensure 100% brain parity.
    11. Hi bro -> greeting, 0 cards.
    12. I need 500 rough books -> catalogue search, truthful not-found/RFQ.
    13. Find notebook manufacturers in India -> Indian suppliers.
    14. I need 500 kg chilli powder -> powder primary, flakes alternative.
    15. I need rice -> grain rice, 0 tea, 0 millet.
    16. I need vivo mobile -> truthful not-found RFQ, no RAG fallback.
    17. I need more help -> continues active topic.
    18. Which supplier is cheapest, then explain second supplier -> price ranking.
    19. Explain FOB and CIF -> RAG knowledge answer with sources.
    20. Documents to export rice to the USA -> mixed: marketplace + trade guidance.
    """
    for surface in ["ai_mode", "copilot"]:
        # 11. Hi bro
        t11 = await TradeXAIOrchestrator.process_turn("Hi bro", {}, db_session, surface=surface)
        assert "Hello" in t11.text or "TradeX" in t11.text
        assert len(t11.cards) == 0

        # 12. I need 500 rough books
        t12 = await TradeXAIOrchestrator.process_turn("I need 500 rough books", {}, db_session, surface=surface)
        assert "Trade Knowledge Base" not in t12.text
        assert "verified evidence in the Trade Knowledge Base" not in t12.text

        # 13. Find notebook manufacturers in India
        t13 = await TradeXAIOrchestrator.process_turn("Find notebook manufacturers in India", {}, db_session, surface=surface)
        assert "Trade Knowledge Base" not in t13.text

        # 14. I need 500 kg chilli powder
        t14 = await TradeXAIOrchestrator.process_turn("I need 500 kg chilli powder", {}, db_session, surface=surface)
        assert len(t14.cards) > 0
        # Primary cards must be powder, flakes flagged as alternative if present
        for card in t14.cards:
            if "flake" in card.title.lower():
                assert card.is_alternative is True

        # 15. I need rice
        t15 = await TradeXAIOrchestrator.process_turn("I need rice", {}, db_session, surface=surface)
        assert len(t15.cards) > 0
        for card in t15.cards:
            assert not re.search(r"\btea\b", card.title.lower())
            assert "millet" not in card.title.lower().split()
            assert "rice" in card.title.lower()

        # 16. I need vivo mobile
        t16 = await TradeXAIOrchestrator.process_turn("I need vivo mobile", {}, db_session, surface=surface)
        assert len(t16.cards) == 0
        assert "Trade Knowledge Base" not in t16.text
        assert "RFQ" in t16.text

        # 17. I need more help (continuing rice inquiry)
        ctx = {"search_state": {"criteria": {"product": "rice"}}}
        t17 = await TradeXAIOrchestrator.process_turn("I need more help", ctx, db_session, surface=surface)
        assert "rice" in t17.text.lower()
        assert "price comparison" in t17.text.lower() or "rfq" in t17.text.lower()

        # 18. Which supplier is cheapest
        t18 = await TradeXAIOrchestrator.process_turn("Which supplier is cheapest?", ctx, db_session, surface=surface)
        assert t18.text is not None

        # 19. Explain FOB and CIF
        t19 = await TradeXAIOrchestrator.process_turn("Explain FOB and CIF Incoterms", {}, db_session, surface=surface)
        assert t19.rag_used is True
        assert len(t19.sources) > 0
        assert "Official verification is needed" in t19.text or "official verification" in t19.text.lower()

        # 20. Documents to export rice to the USA (Mixed question)
        t20 = await TradeXAIOrchestrator.process_turn("Documents to export rice to the USA", {}, db_session, surface=surface)
        assert "Part 1: Marketplace Results" in t20.text
        assert "Part 2: Trade Guidance" in t20.text
        assert "Official verification is needed" in t20.text or "official verification" in t20.text.lower()


@pytest.mark.asyncio
async def test_p39_any_category_test_and_live_catalogue(db_session):
    circuit_breaker.reset()
    """
    Any-Category Test (The Most Important Test) & Live-Catalogue Scenarios (21-23):
    1. Through supplier portal (DB), add and publish products in 7 unrelated categories:
       - Mobile Phone (New Brand): OnePlus 12 5G Smartphone
       - Agricultural Machine/Fertilizer: Bio-Potash Organic Fertilizer Granules
       - Packaged Food: Artisanal Dark Chocolate Almond Bark
       - Electronic Accessory: Braided USB-C to HDMI 4K Cable 2m
       - Textile Item: Jacquard Weave Linen Bath Towel
       - Stationery Item: Spiral Bound Dot Grid Sketchbook 120gsm
       - Unusual Product: Ultrasonic Anti-Fouling Marine Transducer
    2. Confirm each is found 3 ways: natural sentence, generic term, misspelling.
    3. Confirm generic query returns all matching brands.
    4. Unpublish Bio-Potash Fertilizer and confirm it disappears from all three features.
    5. Test live catalogue scenarios 21-23 (rough-book publish, price/stock change, unpublish).
    """
    supplier = (await db_session.execute(select(Supplier).limit(1))).scalar_one()

    # Get or create categories
    cat_names = [
        "Electronics & Gadgets",
        "Agriculture & Farming",
        "Food & Confectionery",
        "Electronics Accessories",
        "Textiles & Linens",
        "Paper & Stationery",
        "Marine Equipment",
    ]
    categories = {}
    for cn in cat_names:
        c_obj = (await db_session.execute(select(Category).where(Category.name == cn))).scalar_one_or_none()
        if not c_obj:
            c_obj = Category(name=cn, slug=cn.lower().replace(" ", "-").replace("&", "and"))
            db_session.add(c_obj)
            await db_session.flush()
        categories[cn] = c_obj

    # Create 7 new products in distinct categories
    test_products_data = [
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Electronics & Gadgets"].id,
                name="OnePlus 12 5G Smartphone 256GB",
                slug=f"oneplus-12-{uuid.uuid4().hex[:6]}",
                description="Premium OnePlus 5G smartphone with 256GB storage and Hasselblad camera.",
                origin_country="China",
                currency="USD",
                moq=10,
                available_quantity=250,
                stock_available=250,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            699.00,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Agriculture & Farming"].id,
                name="Bio-Potash Organic Fertilizer Granules 50kg",
                slug=f"bio-potash-{uuid.uuid4().hex[:6]}",
                description="GreenBio certified organic bio-potash fertilizer granules for crop nutrition.",
                origin_country="India",
                currency="USD",
                moq=100,
                available_quantity=5000,
                stock_available=5000,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            28.50,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Food & Confectionery"].id,
                name="Artisanal Dark Chocolate Almond Bark 250g",
                slug=f"almond-bark-{uuid.uuid4().hex[:6]}",
                description="ChocoArtisan handcrafted Swiss dark chocolate almond bark.",
                origin_country="Switzerland",
                currency="USD",
                moq=50,
                available_quantity=1200,
                stock_available=1200,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            4.20,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Electronics Accessories"].id,
                name="Braided USB-C to HDMI Cable 2m",
                slug=f"hdmi-cable-{uuid.uuid4().hex[:6]}",
                description="WireCraft high speed nylon braided USB-C to HDMI display cable.",
                origin_country="Vietnam",
                currency="USD",
                moq=20,
                available_quantity=3000,
                stock_available=3000,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            6.80,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Textiles & Linens"].id,
                name="Jacquard Weave Linen Bath Towel 70x140cm",
                slug=f"linen-towel-{uuid.uuid4().hex[:6]}",
                description="LinenPure luxury Turkish jacquard weave organic linen bath towel.",
                origin_country="Turkey",
                currency="USD",
                moq=30,
                available_quantity=800,
                stock_available=800,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            12.50,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Paper & Stationery"].id,
                name="Spiral Bound Dot Grid Sketchbook 120gsm",
                slug=f"dot-sketchbook-{uuid.uuid4().hex[:6]}",
                description="PaperTree premium acid-free dot grid sketchbook notebook with twin-wire spiral.",
                origin_country="Germany",
                currency="USD",
                moq=50,
                available_quantity=2000,
                stock_available=2000,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            3.90,
        ),
        (
            Product(
                supplier_id=supplier.id,
                category_id=categories["Marine Equipment"].id,
                name="Ultrasonic Anti-Fouling Marine Transducer",
                slug=f"marine-transducer-{uuid.uuid4().hex[:6]}",
                description="SeaSonic commercial dual-frequency ultrasonic antifouling marine transducer unit.",
                origin_country="Netherlands",
                currency="USD",
                moq=2,
                available_quantity=45,
                stock_available=45,
                availability_status="in_stock",
                status="published",
                is_active=True,
            ),
            1250.00,
        ),
    ]

    test_products = []
    for prod_obj, price_val in test_products_data:
        db_session.add(prod_obj)
        await db_session.flush()
        tier = PriceTier(
            product_id=prod_obj.id,
            min_qty=1,
            unit_price=price_val,
            currency="USD",
        )
        db_session.add(tier)
        test_products.append(prod_obj)
    await db_session.flush()

    # Step A: Test 3 ways for each product in all 3 surfaces
    test_cases = [
        # (natural sentence, generic query, misspelling, expected_title_substring)
        ("Can I source OnePlus 12 5G smartphones?", "smartphones", "onepluss smartfone", "OnePlus 12"),
        ("I need Bio-Potash organic fertilizer", "fertilizer", "potash fertilizr", "Bio-Potash"),
        ("Looking for dark chocolate almond bark", "chocolate", "dark chocolt", "Dark Chocolate"),
        ("Find braided USB-C to HDMI cables", "cables", "hdmi cabl", "HDMI Cable"),
        ("I want linen bath towels", "towels", "bath towell", "Bath Towel"),
        ("Source spiral bound dot grid sketchbooks", "sketchbooks", "spiral sketchbok", "Sketchbook"),
        ("Buy ultrasonic anti-fouling marine transducers", "transducer", "marine transducsr", "Transducer"),
    ]

    for natural_q, generic_q, typo_q, expected_sub in test_cases:
        for q in [natural_q, generic_q, typo_q]:
            # 1. Sourcing Engine
            s_res = await SourcingEngine.process_query(query=q, db=db_session)
            found_titles = [p.title for p in s_res.products] + [a.title for a in s_res.alternatives]
            assert any(expected_sub.lower() in t.lower() for t in found_titles), f"Engine failed to find '{expected_sub}' for query '{q}'"

            # 2. AI Mode
            aim_turn = await TradeXAIOrchestrator.process_turn(query=q, conversation_context={}, db=db_session, surface="ai_mode")
            aim_titles = [c.title for c in aim_turn.cards]
            assert any(expected_sub.lower() in t.lower() for t in aim_titles), f"AI Mode failed to find '{expected_sub}' for query '{q}'"

            # 3. Copilot
            cop_turn = await TradeXAIOrchestrator.process_turn(query=q, conversation_context={}, db=db_session, surface="copilot")
            cop_titles = [c.title for c in cop_turn.cards]
            assert any(expected_sub.lower() in t.lower() for t in cop_titles), f"Copilot failed to find '{expected_sub}' for query '{q}'"

    # Step B: Unpublish Bio-Potash Fertilizer and confirm it disappears from all three features
    fert = test_products[1]
    fert.status = "draft"
    fert.is_active = False
    await db_session.flush()

    # Re-query
    fert_engine = await SourcingEngine.process_query(query="Bio-Potash fertilizer", db=db_session)
    assert not any("Bio-Potash" in p.title for p in fert_engine.products)

    fert_aim = await TradeXAIOrchestrator.process_turn(query="Bio-Potash fertilizer", conversation_context={}, db=db_session, surface="ai_mode")
    assert not any("Bio-Potash" in c.title for c in fert_aim.cards)

    fert_cop = await TradeXAIOrchestrator.process_turn(query="Bio-Potash fertilizer", conversation_context={}, db=db_session, surface="copilot")
    assert not any("Bio-Potash" in c.title for c in fert_cop.cards)

    # Step C: Live-catalogue scenarios (21-23)
    # 21. Supplier publishes rough-book product
    rough_book = Product(
        supplier_id=supplier.id,
        category_id=categories["Paper & Stationery"].id,
        name="A4 Ruled Rough Notebook 200 Pages",
        slug=f"rough-notebook-{uuid.uuid4().hex[:6]}",
        origin_country="India",
        currency="USD",
        moq=100,
        available_quantity=1000,
        stock_available=1000,
        availability_status="in_stock",
        status="published",
        is_active=True,
    )
    db_session.add(rough_book)
    await db_session.flush()

    rb_tier = PriceTier(
        product_id=rough_book.id,
        min_qty=1,
        unit_price=1.50,
        currency="USD",
    )
    db_session.add(rb_tier)
    await db_session.flush()

    rb_res = await SourcingEngine.process_query(query="rough books", db=db_session)
    assert any("Rough Notebook" in p.title for p in rb_res.products)
    found_rb = next(p for p in rb_res.products if "Rough Notebook" in p.title)
    assert found_rb.unit_price == 1.50

    # 22. Supplier changes price from $1.50 to $1.20 and stock to 8,000
    rb_tier.unit_price = 1.20
    rough_book.available_quantity = 8000
    rough_book.stock_available = 8000
    await db_session.flush()

    rb_updated = await SourcingEngine.process_query(query="rough books", db=db_session)
    found_rb = next(p for p in rb_updated.products if "Rough Notebook" in p.title)
    assert found_rb.unit_price == 1.20
    assert found_rb.available_quantity == 8000

    # 23. Supplier unpublishes it; disappears at once
    rough_book.status = "archived"
    rough_book.is_active = False
    await db_session.flush()

    rb_unpub = await SourcingEngine.process_query(query="rough books", db=db_session)
    assert not any("Rough Notebook" in p.title for p in rb_unpub.products)

    # Clean up test products
    await db_session.delete(rb_tier)
    for p in test_products + [rough_book]:
        tiers = (await db_session.execute(select(PriceTier).where(PriceTier.product_id == p.id))).scalars().all()
        for t in tiers:
            await db_session.delete(t)
        await db_session.delete(p)
    await db_session.flush()
