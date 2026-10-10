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
