"""
TradeX AI - Prompt 31 Unit & Integration Tests
Validates Unified Conversational Orchestrator (TradeXAIOrchestrator):
1. Greeting & small talk (no search, no cards, no RAG)
2. Product discovery ('show affordable laptops under USD 400', 'i want laptop')
3. Authoritative price, stock & MOQ inspection ('Availability is unconfirmed')
4. Trade compliance & documents (RAG threshold >= 0.55 with citations)
5. Out of catalogue query ('OPPO mobile phones' -> truthful no-match + RFQ offer)
6. 5-step follow-up conversation sequence
7. Provider metadata & footer
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.ai.orchestrator import TradeXAIOrchestrator
from app.models.catalog import Product


@pytest.mark.asyncio
async def test_rule1_greeting_no_cards_no_rag(db_session):
    resp = await TradeXAIOrchestrator.process_turn(
        query="hi there",
        conversation_context={},
        db=db_session,
    )
    assert resp.mode == "greeting"
    assert resp.rag_used is False
    assert len(resp.cards) == 0
    assert len(resp.sources) == 0
    assert "Hello!" in resp.text
    assert "Live AI:" in resp.text or "Demo AI" in resp.text


@pytest.mark.asyncio
async def test_rule2_product_discovery_laptops(db_session):
    resp = await TradeXAIOrchestrator.process_turn(
        query="show affordable laptops under USD 400",
        conversation_context={},
        db=db_session,
    )
    assert resp.mode == "catalogue_search"
    assert resp.rag_used is False
    assert len(resp.cards) > 0
    # Every returned card should be a laptop and strictly <= 400
    for card in resp.cards:
        assert any(k in card.title.lower() for k in ["laptop", "notebook", "ultrabook", "probook"])
        if not card.is_alternative:
            assert card.unit_price <= 400.0 or (card.price_display and card.price_display <= 400.0)


@pytest.mark.asyncio
async def test_rule3_stock_and_moq_inquiry(db_session):
    # First get laptops to populate last_product_ids
    init_resp = await TradeXAIOrchestrator.process_turn(
        query="laptops",
        conversation_context={},
        db=db_session,
    )
    assert len(init_resp.cards) >= 1
    state = init_resp.search_state

    # Query MOQ of the first item
    moq_resp = await TradeXAIOrchestrator.process_turn(
        query="what is the MOQ of the first item?",
        conversation_context={"search_state": state},
        db=db_session,
    )
    assert moq_resp.mode == "product_inquiry"
    assert "Minimum Order Quantity (MOQ)" in moq_resp.text or "MOQ" in moq_resp.text

    # Query stock of the first item
    stock_resp = await TradeXAIOrchestrator.process_turn(
        query="is it in stock?",
        conversation_context={"search_state": state},
        db=db_session,
    )
    assert stock_resp.mode == "product_inquiry"
    assert ("in stock" in stock_resp.text.lower()) or ("availability is unconfirmed" in stock_resp.text.lower())


@pytest.mark.asyncio
async def test_rule4_rag_compliance_knowledge(db_session):
    resp = await TradeXAIOrchestrator.process_turn(
        query="What are the seller responsibilities under CIF Incoterms 2020?",
        conversation_context={},
        db=db_session,
    )
    assert resp.mode == "rag"
    assert resp.rag_used is True
    assert len(resp.sources) > 0
    # Verify relevance threshold >= 0.55
    for src in resp.sources:
        assert src["relevance_score"] >= 0.55


@pytest.mark.asyncio
async def test_rule7_not_in_catalogue_oppo_rfq_offer(db_session):
    resp = await TradeXAIOrchestrator.process_turn(
        query="I want to buy OPPO mobile phones",
        conversation_context={},
        db=db_session,
    )
    assert resp.mode == "not_found"
    assert resp.rag_used is False
    # Exact prompt rule: says "I couldn't find any <term> in the current TradeX catalogue"
    assert "couldn't find any" in resp.text.lower()
    assert "oppo" in resp.text.lower()
    assert "rfq" in resp.text.lower()
    # Does NOT say product does not exist in the world
    assert "does not exist in the market" not in resp.text.lower()


@pytest.mark.asyncio
async def test_5_step_follow_up_conversation_sequence(db_session):
    ctx = {"search_state": {}}

    # Step 1: "affordable laptops for the USA"
    r1 = await TradeXAIOrchestrator.process_turn("affordable laptops for the USA", ctx, db_session)
    ctx["search_state"] = r1.search_state
    assert len(r1.cards) > 0
    assert r1.search_state["criteria"].get("destination") == "USA"

    # Step 2: "only from China"
    r2 = await TradeXAIOrchestrator.process_turn("only from China", ctx, db_session)
    ctx["search_state"] = r2.search_state
    assert r2.search_state["criteria"].get("origin_country") == "China"
    assert r2.search_state["criteria"].get("product") == "laptop"

    # Step 3: "compare the first two"
    r3 = await TradeXAIOrchestrator.process_turn("compare the first two", ctx, db_session)
    ctx["search_state"] = r3.search_state
    assert len(r3.cards) >= 1

    # Step 4: "what is the MOQ of the second?"
    r4 = await TradeXAIOrchestrator.process_turn("what is the MOQ of the second?", ctx, db_session)
    assert r4.mode == "product_inquiry"
    assert "MOQ" in r4.text

    # Step 5: "is it in stock?"
    r5 = await TradeXAIOrchestrator.process_turn("is it in stock?", ctx, db_session)
    assert r5.mode == "product_inquiry"
    assert ("in stock" in r5.text.lower()) or ("availability is unconfirmed" in r5.text.lower())


@pytest.mark.asyncio
async def test_stock_question_with_and_without_stock_record(db_session):
    """
    Prompt 31 Rule 3:
    Read authoritative product record. If there is no stock record (or 0 available),
    explicitly say 'Availability is unconfirmed.'
    When stock is available, say 'In stock (<qty> units)'.
    """
    # 1. Product with confirmed stock
    p_with_stock = (await db_session.execute(
        select(Product).where(Product.status == "published", Product.available_quantity > 0).limit(1)
    )).scalar_one_or_none()

    if p_with_stock:
        ctx_with = {"search_state": {"last_product_ids": [str(p_with_stock.id)]}}
        r_stock = await TradeXAIOrchestrator.process_turn("is it in stock?", ctx_with, db_session)
        assert r_stock.mode == "product_inquiry"
        assert "in stock" in r_stock.text.lower()
        assert "availability is unconfirmed" not in r_stock.text.lower()

    # 2. Product without stock record (0 stock / out_of_stock)
    p_no_stock = (await db_session.execute(
        select(Product).where(
            Product.status == "published",
        ).order_by(Product.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    assert p_no_stock is not None
    p_no_stock.available_quantity = 0
    p_no_stock.stock_available = 0
    p_no_stock.availability_status = "out_of_stock"
    await db_session.commit()

    ctx_no = {"search_state": {"last_product_ids": [str(p_no_stock.id)]}}
    r_no_stock = await TradeXAIOrchestrator.process_turn("is it in stock?", ctx_no, db_session)
    assert r_no_stock.mode == "product_inquiry"
    assert "availability is unconfirmed" in r_no_stock.text.lower()


@pytest.mark.asyncio
async def test_question_with_no_evidence(db_session):
    """
    Prompt 31 Rule 4:
    A knowledge question with no evidence below threshold returns an honest statement
    that no verified evidence exists in the Trade Knowledge Base.
    """
    resp = await TradeXAIOrchestrator.process_turn(
        query="Can extraterrestrial aliens fly to Pluto under Narnia treaty regulations?",
        conversation_context={},
        db=db_session,
    )
    assert resp.rag_used is False
    assert len(resp.sources) == 0
    assert "could not find verified evidence in the trade knowledge base" in resp.text.lower()
    assert "does not exist in the market" not in resp.text.lower()


@pytest.mark.asyncio
async def test_laptop_request_in_ai_mode_and_copilot_same_result():
    """
    Prompt 31 Core Acceptance:
    A laptop request in AI Mode and in the Copilot yields the SAME product result
    from the single shared orchestrator, and Copilot never claims 'I could not find
    verified evidence in the Trade Knowledge Base' for products.
    """
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Copilot call
        copilot_res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "show affordable laptops under USD 400"},
        )
        assert copilot_res.status_code == 200
        copilot_data = copilot_res.json()
        assert "could not find verified evidence" not in copilot_data["response"].lower()
        assert len(copilot_data["cards"]) > 0
        copilot_pids = [c["product_id"] for c in copilot_data["cards"]]

        # 2. Buyer login for AI Mode
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        conv_res = await client.post("/api/v1/ai-mode/conversations", json={}, headers=headers)
        assert conv_res.status_code == 201
        conv_id = conv_res.json()["id"]

        # 3. AI Mode call
        aimode_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "show affordable laptops under USD 400"},
            headers=headers,
        )
        assert aimode_res.status_code == 200
        aimode_data = aimode_res.json()
        aimode_pids = [c["product_id"] for c in aimode_data["product_cards"]]

        # 4. Consistency check: Both Copilot and AI Mode returned the same products
        assert copilot_pids == aimode_pids
        assert len(aimode_pids) > 0


@pytest.mark.asyncio
async def test_provider_failure_honest_fallback(db_session):
    """
    Prompt 31 Footer & Fallback:
    Every reply records provider, model, is_demo, latency_ms, fallback_reason
    and shows 'Live AI: <model>' or 'Demo AI (reason)'.
    """
    resp = await TradeXAIOrchestrator.process_turn(
        query="hi",
        conversation_context={},
        db=db_session,
    )
    assert resp.ai_meta is not None
    assert "provider" in resp.ai_meta
    assert "model" in resp.ai_meta
    assert "is_demo" in resp.ai_meta

    if resp.ai_meta["is_demo"]:
        assert "Demo AI" in resp.text
    else:
        assert "Live AI:" in resp.text

