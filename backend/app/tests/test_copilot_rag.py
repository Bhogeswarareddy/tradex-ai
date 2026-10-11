import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.main import app
from app.models.ai_ops import KnowledgeChunk
from app.core.security import create_access_token
from app.models.identity import Company, User
from app.ai.rag.retriever import retrieve_knowledge_chunks


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found")
        return create_access_token({"sub": str(user.id), "role": user.role})



@pytest.mark.asyncio
async def test_knowledge_base_ingestion():
    """Verify that knowledge chunks are populated in the database."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(KnowledgeChunk).where(KnowledgeChunk.is_public == True))
        chunks = result.scalars().all()
        assert len(chunks) >= 15, f"Expected at least 15 chunks, got {len(chunks)}"


@pytest.mark.asyncio
async def test_rag_retrieval_hit_rate():
    """
    Evaluates RAG retrieval accuracy across 10 diverse international trade queries.
    Pass criteria: >= 80% of queries retrieve their expected knowledge guide in top 3.
    """
    test_queries = [
        ("What are the risk transfer rules under CIF vs FOB Incoterms 2020?", "incoterms_2020"),
        ("What is the HS code and EU tariff rate for organic turmeric powder?", "hs_code_classification"),
        ("How does the EU TRACES NT Certificate of Inspection COI work for organic spices?", "eu_organic_regulations"),
        ("What are the FDA foreign supplier verification program FSVP requirements?", "us_fda_food_safety"),
        ("What is the discrepancy rule under UCP 600 Letter of Credit Article 14?", "letters_of_credit_ucp600"),
        ("What is the difference between a clean ocean bill of lading and a sea waybill?", "bills_of_lading_guide"),
        ("How does ATLAS customs clearance work at the Port of Hamburg?", "customs_clearance_germany"),
        ("What risks are covered under Institute Cargo Clauses A vs C?", "marine_cargo_insurance"),
        ("What fumigation standards apply for ISPM 15 phytosanitary wood pallets?", "phytosanitary_certificates"),
        ("What is demurrage and detention for 20ft container shipping?", "container_shipping_fcl_lcl"),
    ]

    hits = 0
    total = len(test_queries)

    async with AsyncSessionLocal() as session:
        for query, expected_slug in test_queries:
            chunks = await retrieve_knowledge_chunks(query=query, db=session, top_k=3)
            retrieved_slugs = [c.guide_slug for c in chunks]
            if expected_slug in retrieved_slugs:
                hits += 1

    accuracy = hits / total
    assert accuracy >= 0.80, f"RAG hit rate was {accuracy * 100:.1f}%, expected >= 80% (hits: {hits}/{total})"


@pytest.mark.asyncio
async def test_multi_tenant_chunk_isolation():
    """Ensures private company knowledge chunks are never returned to unauthorized users."""
    async with AsyncSessionLocal() as session:
        comp_a = (await session.execute(select(Company).limit(1))).scalar_one_or_none()
        assert comp_a is not None, "At least one Company must exist in test database"
        company_a_id = comp_a.id
        company_b_id = uuid.uuid4()

        # Create a private knowledge chunk for Company A
        private_chunk = KnowledgeChunk(
            guide_slug="confidential_audit",
            title="Company A Internal Trade Audit",
            content="Proprietary supplier pricing agreement confidential to Company A only.",
            source_uri="/private/company_a/audit",
            is_public=False,
            company_id=company_a_id,
        )
        session.add(private_chunk)
        await session.commit()
        chunk_id = private_chunk.id

        try:
            # Query as Company B
            res_b = await retrieve_knowledge_chunks(
                query="Company A Internal Trade Audit",
                db=session,
                company_id=company_b_id,
            )
            assert not any(c.id == str(chunk_id) for c in res_b), "Company B saw Company A's private chunk!"

            # Query without company context
            res_anon = await retrieve_knowledge_chunks(
                query="Company A Internal Trade Audit",
                db=session,
                company_id=None,
            )
            assert not any(c.id == str(chunk_id) for c in res_anon), "Anonymous user saw private chunk!"

            # Query as Company A
            res_a = await retrieve_knowledge_chunks(
                query="Company A Internal Trade Audit",
                db=session,
                company_id=company_a_id,
            )
            assert any(c.id == str(chunk_id) for c in res_a), "Company A could not find its own chunk!"
        finally:
            await session.delete(private_chunk)
            await session.commit()


@pytest.mark.asyncio
async def test_copilot_chat_endpoint_with_sources():
    """Tests the /api/v1/ai/copilot/chat endpoint returning grounded response, citations, and actions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query trade topic
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "What is the HS code for turmeric powder?"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "response" in data
        assert "0910.30" in data["response"]
        assert len(data["suggested_actions"]) >= 1
        assert "sources" in data
        assert len(data["sources"]) >= 1


@pytest.mark.asyncio
async def test_copilot_guides_catalog():
    """Tests the /api/v1/ai/copilot/guides catalog endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/ai/copilot/guides")
        assert res.status_code == 200
        guides = res.json()
        assert len(guides) == 15
        assert any(g["slug"] == "incoterms_2020" for g in guides)


@pytest.mark.asyncio
async def test_copilot_greeting_behaviour():
    """1. Test that casual greeting gets a friendly conversational response without shipping text."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "hi"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "Hello!" in data["response"] or "TradeX Copilot" in data["response"]
        assert "demurrage" not in data["response"].lower()
        assert "container shipping logistics" not in data["response"].lower()
        assert len(data["suggested_actions"]) >= 2


@pytest.mark.asyncio
async def test_copilot_grounded_question_multiple_sources():
    """2. Test knowledge question with 2 or more grounded sources cited."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "What are the rules and requirements for CIF Hamburg organic spice imports?"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["sources"]) >= 2
        for src in data["sources"]:
            assert "title" in src
            assert "source_uri" in src
            assert src["relevance_score"] > 0


@pytest.mark.asyncio
async def test_copilot_question_with_no_evidence():
    """3. Test question with no evidence honestly states unknown without inventing citations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "What is the quantum teleportation frequency for Martian titanium imports?"},
        )
        assert res.status_code == 200
        data = res.json()
        resp_text = data["response"].lower()
        assert "could not find verified evidence" in resp_text or "unknown" in resp_text or "verify" in resp_text
        assert len(data["sources"]) == 0, "Must never invent citations when evidence does not exist"


@pytest.mark.asyncio
async def test_copilot_supplier_comparison_action():
    """4. Test suggestion action trigger: compare suppliers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/copilot/chat",
            json={"message": "Compare suppliers"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "Sri Bharat Spices" in data["response"]
        assert "NatureFarm" in data["response"]
        assert "Madhav Agro" in data["response"]
        assert len(data["suggested_actions"]) >= 1


@pytest.mark.asyncio
async def test_stopped_ollama_fallback_honesty():
    """5. Test unreachable/stopped Ollama provider gracefully falls back to Demo AI without crashing."""
    from app.ai.providers import OllamaProvider
    # Connect to invalid port where Ollama is definitely stopped
    stopped_ollama = OllamaProvider(base_url="http://127.0.0.1:54321", timeout_seconds=1.0)
    resp = await stopped_ollama.complete(
        system="Test system",
        messages=[{"role": "user", "content": "Organic Turmeric CIF Hamburg"}],
    )
    assert resp.fallback is True
    assert resp.is_mock is True
    assert "mock" in resp.model.lower() or "mock" in resp.provider.lower()


@pytest.mark.asyncio
async def test_missing_api_key_fallback():
    """6. Test missing API key gracefully falls back to Demo AI."""
    from app.ai.providers import OpenRouterProvider, GroqProvider
    openrouter_no_key = OpenRouterProvider(api_key="")
    resp1 = await openrouter_no_key.complete(system="", messages=[{"role": "user", "content": "test"}])
    assert resp1.fallback is True
    assert resp1.is_mock is True

    groq_no_key = GroqProvider(api_key="")
    resp2 = await groq_no_key.complete(system="", messages=[{"role": "user", "content": "test"}])
    assert resp2.fallback is True
    assert resp2.is_mock is True


@pytest.mark.asyncio
async def test_simulated_rate_limit_circuit_breaker():
    """7. Test simulated HTTP 429 rate limit trips circuit breaker and falls back honestly."""
    from app.ai.circuit_breaker import circuit_breaker
    circuit_breaker.reset()
    assert circuit_breaker.state.value == "CLOSED"

    # Record 3 simulated rate limits
    for _ in range(3):
        circuit_breaker.record_failure(error="HTTP 429 Too Many Requests: Rate limit exceeded", is_rate_limit=True)

    assert circuit_breaker.is_open() is True
    stats = circuit_breaker.get_stats()
    assert stats["rate_limit_errors"] == 3
    assert stats["is_tripped"] is True
    circuit_breaker.reset()


@pytest.mark.asyncio
async def test_admin_diagnostics_security():
    """8. Test admin diagnostics endpoint requires admin role and never leaks secret keys."""
    admin_token = await get_test_token("admin@tradex.ai")
    buyer_token = await get_test_token("bhogeswara@tradex.ai")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Non-admin gets 403 Forbidden
        buyer_res = await client.get(
            "/api/v1/ai/admin/diagnostics",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert buyer_res.status_code == 403

        # Admin gets full diagnostics
        admin_res = await client.get(
            "/api/v1/ai/admin/diagnostics",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_res.status_code == 200
        diag = admin_res.json()
        assert "provider" in diag
        assert "model" in diag
        assert "circuit_breaker" in diag
        assert "embedding_dim" in diag
        assert diag["embedding_dim"] == 1536
        # Ensure raw secret keys are NEVER returned in JSON
        for k, v in diag.items():
            assert "sk-" not in str(v)
            assert "gsk_" not in str(v)
            assert "AIza" not in str(v)

        # Admin tests live connection
        test_res = await client.post(
            "/api/v1/ai/admin/test-connection",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert test_res.status_code == 200
        conn_data = test_res.json()
        assert conn_data["status"] in ["connected", "failed"]

