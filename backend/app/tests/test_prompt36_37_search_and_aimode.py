"""
Acceptance Test Suite for Prompt 36 (AI Search) & Prompt 37 (AI Mode)
"""
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from app.main import app
from app.models.identity import User
from app.services.sourcing_engine import SourcingEngine, SourcingRequirement
from app.ai.orchestrator import TradeXAIOrchestrator
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_p36_apple_mobiles_zero_products_zero_suppliers(db_session):
    """
    Prompt 36 Problem to fix:
    'i need to 20 apple mobiles' shows 'Matched Suppliers 8' and 'Catalog Products 0'
    with a spice supplier at 54% score.
    With Prompt 36 fix:
    If products are 0, suppliers MUST be 0.
    No spice suppliers appear.
    """
    buyer_user = (await db_session.execute(
        select(User).where(User.email.ilike("%buyer%")).limit(1)
    )).scalar_one_or_none()
    if not buyer_user:
        buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()

    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/ai/search",
            json={"query": "i need to 20 apple mobiles"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()

        # Catalogue products must be 0
        assert len(data["products"]) == 0
        # Suppliers must be 0 (distinct suppliers of matching products)
        assert len(data["suppliers"]) == 0
        assert data["status"] == "not_found"

        # Check honest AI telemetry
        meta = data.get("ai_meta")
        assert meta is not None
        assert "provider" in meta
        assert "model" in meta
        assert "is_demo" in meta


@pytest.mark.asyncio
async def test_p36_ai_search_no_invented_chips(db_session):
    """
    Prompt 36:
    Only the filters the buyer actually stated (no invented 'Lead Time' chip, no 'Destination: Trade').
    """
    buyer_user = (await db_session.execute(
        select(User).where(User.email.ilike("%buyer%")).limit(1)
    )).scalar_one_or_none()
    if not buyer_user:
        buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()

    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/ai/search",
            json={"query": "i need 20 laptops under USD 400"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        req = data["requirement"]

        # User did not mention destination or lead time
        assert req.get("destination_country") is None
        assert req.get("delivery_days") is None
        assert req.get("incoterm") is None

        # User stated product, quantity, max_budget
        assert "laptop" in (req.get("product") or "").lower()
        assert req.get("quantity") == 20
        assert req.get("max_budget") == 400.0 or req.get("max_budget") == 400


@pytest.mark.asyncio
async def test_p36_filter_recalculates_deterministically(db_session):
    """
    Prompt 36:
    Editing a chip re-filters without calling the AI endpoint again.
    Suppliers count equals number of distinct suppliers of matching products.
    """
    buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()
    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        filter_payload = {
            "requirement": {
                "product": "Basmati Rice",
                "quantity": 1000,
                "unit": "kg",
                "currency": "USD",
                "certifications": [],
                "other_constraints": [],
                "confidence": {},
            }
        }
        res = await ac.post(
            "/api/v1/ai/search/filter",
            json=filter_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()

        # Should match Basmati Rice products
        assert len(data["products"]) > 0
        assert all("rice" in p["name"].lower() for p in data["products"])

        # Suppliers should only be suppliers of those rice products
        assert len(data["suppliers"]) > 0
        supplier_ids_from_products = {p["supplier_id"] for p in data["products"] if p["supplier_id"]}
        for s in data["suppliers"]:
            assert s["id"] in supplier_ids_from_products


@pytest.mark.asyncio
async def test_p37_rough_books_truthful_no_match(db_session):
    """
    Prompt 37:
    'bro i need rough books' answers with catalogue search and truthful no-match,
    never returns knowledge-base fallback text.
    """
    turn = await TradeXAIOrchestrator.process_turn(
        query="bro i need rough books",
        conversation_context={},
        db=db_session,
        surface="ai_mode",
    )
    # Must NOT have returned trade knowledge base text
    assert "Trade Knowledge Base" not in turn.text
    assert "verified evidence in the Trade Knowledge Base" not in turn.text
    # Must truthfully state no matching products found in catalogue
    text_l = turn.text.lower()
    assert "could not find" in text_l or "no matching" in text_l or "found no matching" in text_l or "not found" in text_l or turn.mode == "not_found"
    # 0 cards returned
    assert len(turn.cards) == 0


@pytest.mark.asyncio
async def test_p37_conversation_titling_and_active_filters(db_session):
    """
    Prompt 37:
    Title each conversation from first real request (Chilli Powder, 500 kg).
    Active filters contain ONLY what user stated.
    """
    buyer_user = (await db_session.execute(
        select(User).where(User.email.ilike("%buyer%")).limit(1)
    )).scalar_one_or_none()
    if not buyer_user:
        buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()

    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create conversation
        conv_res = await ac.post(
            "/api/v1/ai-mode/conversations",
            json={"title": "Trade Sourcing Session"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert conv_res.status_code in [200, 201]
        conv_id = conv_res.json()["id"]

        # Post first message
        msg_res = await ac.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            json={"content": "i need 500 kg chilli powder"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert msg_res.status_code == 200
        msg_data = msg_res.json()

        # Active filters check: no invented Destination: Trade
        filters = msg_data.get("active_filters", [])
        for f in filters:
            assert f["label"].lower() != "destination" or f["value"].lower() not in ["trade", "tradex", "me"]
            assert f["label"].lower() != "lead time"

        # Check updated conversation title
        detail_res = await ac.get(
            f"/api/v1/ai-mode/conversations/{conv_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        title = detail_res.json()["title"]
        assert "Chilli" in title
        assert "500" in title
