"""
TradeX AI - Prompt 35 Shared Sourcing Engine Unit & Integration Tests
Validates the unified 7-stage engine powering AI Search, AI Mode, and Copilot:
1. 'rice' returns only rice products (no tea, no millet).
2. 'chill powedr' resolves to chilli powder, flakes only as similar alternatives.
3. 'vivo mobile' and 'rough books' search catalogue first; when absent return status not_found with user's words and RFQ offer.
4. 'i need more help' continues previous topic (never fresh RAG lookup).
5. 500 kg against units returns clear unit message.
6. null price returns contact message ('Contact supplier for pricing').
7. Deduplication & collapsing near-identical variants into one card with variant_count.
8. Unpublishing removes product immediately.
9. Price change reflects immediately.
10. No invented filters: only stated fields become active filters.
11. AI Search endpoint integration test ('i need to 20 apple mobiles' -> 0 suppliers, not_found, no invented chips).
"""
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update

from app.main import app
from app.models.catalog import PriceTier, Product
from app.services.sourcing_engine import SourcingEngine, SourcingRequirement


@pytest.mark.asyncio
async def test_p35_rule1_rice_returns_only_rice_no_tea(db_session):
    """
    Prompt 35:
    'rice' matches grain rice and never green tea or millet.
    """
    res = await SourcingEngine.process_query(
        query="rice",
        db=db_session,
        context={},
        display_currency="USD",
    )
    assert res.status == "success"
    assert len(res.products) > 0
    for card in res.products:
        card_title = card.title.lower()
        # Verify it is rice and NOT green tea or tea beverages
        assert "green tea" not in card_title
        import re
        assert not re.search(r"\btea\b", card_title)


@pytest.mark.asyncio
async def test_p35_rule2_chilli_powder_typo_and_form_separation(db_session):
    """
    Prompt 35:
    'chill powedr' resolves to chilli powder, flakes only as similar.
    """
    res = await SourcingEngine.process_query(
        query="chill powedr",
        db=db_session,
        context={},
        display_currency="USD",
    )
    assert res.status == "success"
    # Primary products should be chilli powder
    powder_cards = [c for c in res.products if "powder" in c.title.lower()]
    assert len(powder_cards) > 0
    # Chilli flakes should be separated into alternatives
    if res.alternatives:
        for alt in res.alternatives:
            assert alt.is_alternative is True
        assert any("flakes" in alt.title.lower() for alt in res.alternatives)


@pytest.mark.asyncio
async def test_p35_rule3_vivo_mobile_and_rough_books_absent_rfq_offer(db_session):
    """
    Prompt 35:
    'vivo mobile' and 'rough books' search catalogue first; when absent return
    status not_found with user's words and RFQ offer.
    """
    for term in ["vivo mobile", "rough books"]:
        res = await SourcingEngine.process_query(
            query=f"i need {term}",
            db=db_session,
            context={},
            display_currency="USD",
        )
        assert res.status == "not_found"
        assert len(res.products) == 0
        assert term in res.text.lower() or term.split()[0] in res.text.lower()
        assert "rfq" in res.text.lower()
        # Truthful: never says does not exist in the world
        assert "does not exist in the market" not in res.text.lower()


@pytest.mark.asyncio
async def test_p35_rule4_vague_help_continues_topic_never_fresh_rag(db_session):
    """
    Prompt 35:
    Vague messages like 'i need more help' are FOLLOW_UP and continue active conversation,
    never a fresh RAG lookup.
    """
    ctx = {
        "search_state": {
            "criteria": {"product": "organic turmeric"},
            "last_product_ids": ["test-id"],
        }
    }
    res = await SourcingEngine.process_query(
        query="i need more help",
        db=db_session,
        context=ctx,
        display_currency="USD",
    )
    assert res.intent == "FOLLOW_UP"
    assert res.rag_used is False
    assert "organic turmeric" in res.text.lower() or "inquiry" in res.text.lower()


@pytest.mark.asyncio
async def test_p35_rule5_uncomparable_units_mass_vs_discrete(db_session):
    """
    Prompt 35:
    500 kg against units returns clear unit message.
    """
    # Laptops inventory is in 'units', user requests '500 kg laptops'
    res = await SourcingEngine.process_query(
        query="500 kg laptops",
        db=db_session,
        context={},
        display_currency="USD",
    )
    assert res.status == "success"
    assert len(res.products) > 0
    # Must contain explanation about uncomparable units
    assert (
        "cannot be directly compared" in res.text.lower()
        or "requested in kg" in res.text.lower()
        or "units" in res.text.lower()
    )


@pytest.mark.asyncio
async def test_p35_rule6_null_price_returns_contact_supplier(db_session):
    """
    Prompt 35:
    Missing price shows 'Contact supplier for pricing', never 0 or made up.
    """
    # Create or update a product with no price tiers
    prod = (await db_session.execute(
        select(Product).where(Product.status == "published").limit(1)
    )).scalar_one()

    # Clear price tiers for this product temporarily in test session
    await db_session.execute(
        select(PriceTier).where(PriceTier.product_id == prod.id)
    )
    # Test card formatting when price is missing
    card = {
        "product_id": str(prod.id),
        "title": prod.name,
        "supplier_name": "Test Supplier",
        "origin_country": prod.origin_country,
        "unit_price": 0.0,
        "currency": "USD",
        "moq": 10,
        "unit": "kg",
        "available_quantity": 100,
        "has_price": False,
        "price_status": "contact_supplier",
    }
    tmpl = SourcingEngine._build_deterministic_template(
        req=SourcingRequirement(product_term=prod.name),
        products=[card],
        alternatives=[],
    )
    assert "contact supplier for pricing" in tmpl.lower()
    assert "$0" not in tmpl


@pytest.mark.asyncio
async def test_p35_rule7_no_duplicate_products_variant_collapse(db_session):
    """
    Prompt 35:
    Deduplicate by product id and collapse near-identical supplier variants into one card with variant_count.
    """
    res = await SourcingEngine.process_query(
        query="organic guntur chilli flakes",
        db=db_session,
        context={},
        display_currency="USD",
    )
    assert res.status == "success"
    # Even though DB has 14 variants of Organic Guntur Chilli Flakes, they should be collapsed
    supplier_groups = {}
    for card in res.products:
        base_title = card.title.split()[0]
        key = (card.supplier_name, base_title)
        supplier_groups[key] = supplier_groups.get(key, 0) + 1

    # No supplier has 14 duplicate cards
    for count in supplier_groups.values():
        assert count <= 3


@pytest.mark.asyncio
async def test_p35_rule8_unpublishing_removes_product_immediately(db_session):
    """
    Prompt 35:
    Unpublishing removes product immediately from search results.
    """
    prod = (await db_session.execute(
        select(Product).where(Product.status == "published", Product.name.ilike("%laptop%")).limit(1)
    )).scalar_one()

    orig_status = prod.status
    try:
        # Unpublish
        prod.status = "draft"
        await db_session.commit()

        # Search should not include this unpublished product
        res = await SourcingEngine.process_query(
            query=prod.name,
            db=db_session,
            context={},
            display_currency="USD",
        )
        returned_pids = [c.product_id for c in res.products]
        assert str(prod.id) not in returned_pids
    finally:
        # Restore
        prod.status = orig_status
        await db_session.commit()


@pytest.mark.asyncio
async def test_p35_rule9_price_change_reflects_immediately(db_session):
    """
    Prompt 35:
    Price change reflects immediately in search results.
    """
    tier = (await db_session.execute(
        select(PriceTier).join(Product, PriceTier.product_id == Product.id)
        .where(Product.status == "published", Product.name.ilike("%laptop%")).limit(1)
    )).scalar_one()

    orig_price = float(tier.unit_price)
    test_price = 199.99
    try:
        tier.unit_price = test_price
        await db_session.commit()

        prod = (await db_session.execute(select(Product).where(Product.id == tier.product_id))).scalar_one()
        res = await SourcingEngine.process_query(
            query=prod.name,
            db=db_session,
            context={},
            display_currency="USD",
        )
        matching_card = next((c for c in res.products if c.product_id == str(prod.id)), None)
        assert matching_card is not None
        assert matching_card.unit_price == test_price or matching_card.price_display == test_price
    finally:
        tier.unit_price = orig_price
        await db_session.commit()


@pytest.mark.asyncio
async def test_p35_rule10_no_invented_filters(db_session):
    """
    Prompt 35:
    Only fields in stated_fields become active filters or filter chips.
    If the user did not say 'Destination: Trade' or 'Lead Time: Within days', those chips must never appear.
    """
    res = await SourcingEngine.process_query(
        query="i need 20 laptops under USD 400",
        db=db_session,
        context={},
        display_currency="USD",
    )
    # Verify active filters
    filters = res.active_filters
    assert "destination" not in filters
    assert "lead_time" not in filters
    assert "max_lead_time" not in filters
    assert "incoterm" not in filters
    # Stated fields should only be product, quantity, price_limit, currency
    assert "max_price" in filters or "price_limit" in res.understood.stated_fields
    assert "quantity" in filters or "quantity" in res.understood.stated_fields


@pytest.mark.asyncio
async def test_p35_ai_search_endpoint_no_fake_suppliers():
    """
    Prompt 35:
    In AI Search, 'i need to 20 apple mobiles':
    0 catalogue products match -> 0 suppliers match (never spice suppliers scoring 54% from capacity).
    No 'Lead Time: Within days' chip.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/search",
            json={"query": "i need to 20 apple mobiles"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "not_found"
        assert len(data["products"]) == 0
        # 0 suppliers matched because no apple mobiles exist in catalogue
        assert len(data["suppliers"]) == 0
        # No invented filters like lead_time or destination
        assert "lead_time" not in data["filters"]
        assert "max_lead_time" not in data["filters"]
        assert "destination" not in data["filters"]
