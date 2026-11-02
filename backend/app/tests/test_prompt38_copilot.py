"""
Acceptance Test Suite for Prompt 38 (AI Trade Copilot)
"""
import pytest
import re
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from app.main import app
from app.models.identity import User
from app.ai.orchestrator import TradeXAIOrchestrator
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_p38_copilot_rice_accuracy_and_count(db_session):
    """
    Prompt 38:
    'i need rice': applies Prompt 35 product-type check so green tea and millet never appear.
    Result count in text matches cards actually shown, and offers 'Show more'.
    """
    turn = await TradeXAIOrchestrator.process_turn(
        query="i need rice",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert len(turn.cards) > 0
    # Green tea and millet must never appear
    for card in turn.cards:
        assert not re.search(r"\btea\b", card.title.lower())
        assert not re.search(r"\bmillet\b", card.title.lower())
        assert "rice" in card.title.lower()

    # Result count in text matches shown cards (3 listings)
    assert "Here are 3 verified" in turn.text or f"Here are {len(turn.cards)} verified" in turn.text
    if len(turn.cards) > 3:
        assert "Show more" in turn.suggested_actions
        assert "Showing 3 of" in turn.text

    assert turn.rag_used is False


@pytest.mark.asyncio
async def test_p38_copilot_routing_laptop_and_vivo(db_session):
    """
    Prompt 38:
    'i want laptop' searches real catalogue.
    'i need vivo mobile' searches real catalogue, truthful no-match RFQ, NEVER Trade Knowledge Base fallback.
    """
    # 1. Laptop
    turn_laptop = await TradeXAIOrchestrator.process_turn(
        query="i want laptop",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert len(turn_laptop.cards) > 0
    assert any("laptop" in c.title.lower() or "probook" in c.title.lower() or "notebook" in c.title.lower() for c in turn_laptop.cards)
    assert turn_laptop.rag_used is False

    # 2. Vivo mobile
    turn_vivo = await TradeXAIOrchestrator.process_turn(
        query="i need vivo mobile",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert len(turn_vivo.cards) == 0
    assert "Trade Knowledge Base" not in turn_vivo.text
    assert "verified evidence in the Trade Knowledge Base" not in turn_vivo.text
    assert "RFQ" in turn_vivo.text
    assert turn_vivo.rag_used is False


@pytest.mark.asyncio
async def test_p38_copilot_follow_up_continuity(db_session):
    """
    Prompt 38:
    'i need more help' continues the last topic and asks what the buyer needs next
    ('Do you want quantities, a price comparison or an RFQ for rice?').
    """
    context = {
        "search_state": {
            "criteria": {
                "product": "rice",
                "quantity": 1000,
                "unit": "kg",
            }
        }
    }
    turn = await TradeXAIOrchestrator.process_turn(
        query="i need more help",
        conversation_context=context,
        db=db_session,
        surface="copilot",
    )
    assert "Trade Knowledge Base" not in turn.text
    assert "continuing with your inquiry on" in turn.text.lower() or "rice" in turn.text.lower()
    assert "price comparison" in turn.text.lower() or "rfq" in turn.text.lower()
    assert any("rice" in act.lower() for act in turn.suggested_actions)
    assert turn.rag_used is False


@pytest.mark.asyncio
async def test_p38_copilot_mixed_question_two_separated_parts(db_session):
    """
    Prompt 38:
    Mixed questions ('500 kg rice from India to USA, what documents?')
    return two clearly separated parts: marketplace results and trade guidance,
    and say official verification is needed.
    """
    turn = await TradeXAIOrchestrator.process_turn(
        query="500 kg rice from India to USA, what documents?",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert "Part 1: Marketplace Results" in turn.text
    assert "Part 2: Trade Guidance" in turn.text
    assert "Official verification is needed" in turn.text or "official verification" in turn.text.lower()
    assert "1006.30" in turn.text or "phytosanitary" in turn.text.lower() or "commercial invoice" in turn.text.lower()


@pytest.mark.asyncio
async def test_p38_copilot_knowledge_and_no_evidence_distinction(db_session):
    """
    Prompt 38:
    Knowledge question uses RAG with real citations, labels general guidance, official verification needed.
    'I could not find verified evidence in the Trade Knowledge Base' appears ONLY for genuine knowledge question with no matching document.
    """
    # 1. Genuine knowledge question with matching guide
    turn_cif = await TradeXAIOrchestrator.process_turn(
        query="What is the risk transfer point under CIF Incoterms 2020?",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert turn_cif.rag_used is True
    assert len(turn_cif.sources) > 0
    assert "Official verification is needed" in turn_cif.text or "official verification" in turn_cif.text.lower()

    # 2. Genuine knowledge question with NO matching document
    turn_alien = await TradeXAIOrchestrator.process_turn(
        query="What is the quantum teleportation frequency for Martian titanium imports?",
        conversation_context={},
        db=db_session,
        surface="copilot",
    )
    assert "could not find verified evidence in the trade knowledge base" in turn_alien.text.lower()


@pytest.mark.asyncio
async def test_p38_copilot_history_api(db_session):
    """
    Prompt 38:
    Copilot history endpoints: listing, detail, rename, delete.
    """
    buyer_user = (await db_session.execute(
        select(User).where(User.email.ilike("%buyer%")).limit(1)
    )).scalar_one_or_none()
    if not buyer_user:
        buyer_user = (await db_session.execute(select(User).limit(1))).scalar_one()

    token = create_access_token({"sub": str(buyer_user.id)})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Send chat message
        chat_res = await ac.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "i need 500 kg basmati rice"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        conv_id = chat_data["conversation_id"]
        assert conv_id is not None

        # 2. List conversations
        list_res = await ac.get(
            "/api/v1/ai/copilot/conversations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_res.status_code == 200
        conv_list = list_res.json()
        target = next((c for c in conv_list if c["id"] == conv_id), None)
        assert target is not None
        assert "Rice" in target["title"]

        # 3. Rename conversation
        rename_res = await ac.patch(
            f"/api/v1/ai/copilot/conversations/{conv_id}",
            json={"title": "Indian Basmati Rice Export Inquiry"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert rename_res.status_code == 200
        assert rename_res.json()["title"] == "Indian Basmati Rice Export Inquiry"

        # 4. Get conversation detail
        detail_res = await ac.get(
            f"/api/v1/ai/copilot/conversations/{conv_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert len(detail_data["messages"]) >= 2

        # 5. Delete conversation
        del_res = await ac.delete(
            f"/api/v1/ai/copilot/conversations/{conv_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_res.status_code == 200
