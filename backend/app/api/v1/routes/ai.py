import re
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pydantic import BaseModel
from app.api.deps import get_current_user_optional, get_current_user, require_role
from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import rate_limit_ai
from app.ai.circuit_breaker import circuit_breaker
from app.models.content import CopilotConversation, CopilotMessage
from app.models.identity import Buyer, Supplier, User
from app.models.ai_ops import KnowledgeChunk
from app.ai.rag.retriever import retrieve_knowledge_chunks
from app.services.catalog_assistant import ask_catalog_assistant
from app.schemas.dashboard import (
    SuggestedPrompt,
    CopilotChatRequest,
    CopilotChatResponse,
)

router = APIRouter(prefix="/ai", tags=["AI"])

SUGGESTED_PROMPTS = [
    SuggestedPrompt(id="p1", prompt="Analyze this RFQ and suggest best suppliers", category="rfq"),
    SuggestedPrompt(id="p2", prompt="Compare landed cost for India to Germany", category="logistics"),
    SuggestedPrompt(id="p3", prompt="What documents are required for turmeric?", category="compliance"),
    SuggestedPrompt(id="p4", prompt="Show market demand trends for spices", category="insights"),
    SuggestedPrompt(id="p5", prompt="Find reliable freight forwarders", category="logistics"),
    SuggestedPrompt(id="p6", prompt="Check HS code for turmeric powder", category="tariff"),
]

GUIDE_SUMMARIES = [
    {"slug": "incoterms_2020", "title": "Incoterms® 2020 Rules", "category": "Logistics & Risk", "topics": ["FOB", "CIF", "EXW", "DDP", "DAP", "Risk Transfer"]},
    {"slug": "hs_code_classification", "title": "HS Code Classification & Tariffs", "category": "Customs", "topics": ["Spices", "Turmeric 0910.30", "GRI Rules", "Tariff Lines"]},
    {"slug": "eu_organic_regulations", "title": "EU Organic Regulations (EU 2018/848)", "category": "Compliance", "topics": ["TRACES NT", "COI", "APEDA", "ETO MRLs"]},
    {"slug": "us_fda_food_safety", "title": "US FDA FSMA & Food Safety", "category": "Compliance", "topics": ["FSVP", "Prior Notice", "Facility Registration", "US Agent"]},
    {"slug": "letters_of_credit_ucp600", "title": "Letters of Credit (UCP 600)", "category": "Trade Finance", "topics": ["LC at Sight", "Document Examination", "Discrepancies", "Irrevocable"]},
    {"slug": "bills_of_lading_guide", "title": "Ocean Bills of Lading & Sea Waybills", "category": "Shipping", "topics": ["Clean B/L", "To Order", "Negotiable Title", "Telex Release"]},
    {"slug": "customs_clearance_germany", "title": "German Customs Clearance (ATLAS)", "category": "Customs", "topics": ["Port of Hamburg", "EORI", "Import VAT 7%", "GKS Border Inspection"]},
    {"slug": "marine_cargo_insurance", "title": "Marine Cargo Insurance & ICC (A, B, C)", "category": "Insurance", "topics": ["Institute Cargo Clauses", "All Risks", "General Average", "Exclusions"]},
    {"slug": "phytosanitary_certificates", "title": "Phytosanitary Certificates & IPPC", "category": "Compliance", "topics": ["Quarantine", "Fumigation", "ISPM 15 Wood", "Pest Risk"]},
    {"slug": "halal_kosher_certification", "title": "Halal & Kosher Dietary Certifications", "category": "Certification", "topics": ["JAKIM", "ESMA", "Orthodox Union", "Cross-contamination"]},
    {"slug": "currency_hedging_cross_border", "title": "Currency Hedging & FX Management", "category": "Finance", "topics": ["Forwards", "Currency Options", "EUR/USD/INR Volatility", "Escrow"]},
    {"slug": "arbitration_dispute_resolution", "title": "Dispute Resolution & SIAC Arbitration", "category": "Legal", "topics": ["New York Convention", "SIAC", "GAFTA/FOSFA", "Independent Surveyors"]},
    {"slug": "container_shipping_fcl_lcl", "title": "Container Shipping: FCL vs LCL", "category": "Logistics", "topics": ["20ft vs 40ft HC", "Reefer", "Demurrage & Detention", "Desiccants"]},
    {"slug": "packaging_and_labeling_standards", "title": "Export Packaging & Palletization", "category": "Packaging", "topics": ["Multi-wall Kraft Bags", "ISPM 15 Pallets", "Shipping Marks"]},
    {"slug": "sustainability_and_esg_due_diligence", "title": "EU Deforestation (EUDR) & ESG", "category": "ESG", "topics": ["EUDR 2023/1115", "Geolocation Polygons", "Due Diligence Statement", "SEDEX SMETA"]},
]


class AiStatusResponseSchema(BaseModel):
    provider: str
    model: str
    reachable: bool
    last_latency: float
    mode: str
    status_badge: str = "Connected"
    configured_providers: List[str]
    priority: List[str]
    circuit_breaker: Optional[Dict[str, Any]] = None
    fallback_reason: Optional[str] = None
    status: str = "initialized"
    module: str = "ai"


class AiTestRequestSchema(BaseModel):
    prompt: Optional[str] = "Hello TradeX AI! Verify international trade inference engine."


class AiTestResponseSchema(BaseModel):
    provider: str
    model: str
    latency_ms: float
    reply: str
    status: str
    error: Optional[str] = None


@router.get("/status", response_model=AiStatusResponseSchema, summary="Get AI provider health, model info and diagnostics")
async def ai_status() -> AiStatusResponseSchema:
    from app.ai.provider import probe_ai_health
    data = await probe_ai_health()
    data["status"] = "initialized"
    data["module"] = "ai"
    return AiStatusResponseSchema(**data)


@router.post("/test", response_model=AiTestResponseSchema, summary="Test AI provider connection with live prompt")
async def ai_test_connection(
    payload: Optional[AiTestRequestSchema] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> AiTestResponseSchema:
    from app.ai.provider import get_ai_provider, get_ai_status
    test_prompt = payload.prompt if payload and payload.prompt else "Hello TradeX AI! Confirm live model connection."
    chain = get_ai_provider()
    t0 = time.time()
    try:
        resp = await chain.complete(
            system="You are TradeX AI, a professional B2B international trade intelligence assistant.",
            messages=[{"role": "user", "content": test_prompt}],
            max_tokens=150,
        )
        latency = (time.time() - t0) * 1000
        return AiTestResponseSchema(
            provider=resp.provider,
            model=resp.model,
            latency_ms=round(latency, 2),
            reply=resp.content.strip(),
            status="success",
        )
    except Exception as exc:
        latency = (time.time() - t0) * 1000
        status_info = get_ai_status()
        return AiTestResponseSchema(
            provider=status_info["provider"],
            model=status_info["model"],
            latency_ms=round(latency, 2),
            reply="",
            status="error",
            error=str(exc),
        )


@router.post("/copilot/suggested-prompts", response_model=List[SuggestedPrompt], summary="Get AI Trade Copilot suggested prompts")
async def get_suggested_prompts() -> List[SuggestedPrompt]:
    return SUGGESTED_PROMPTS


@router.get("/copilot/guides", summary="Get catalog of trade knowledge guides")
async def get_copilot_guides() -> List[Dict[str, Any]]:
    return GUIDE_SUMMARIES


@router.post("/copilot/chat", response_model=CopilotChatResponse, summary="Chat with AI Trade Copilot with RAG grounding", dependencies=[Depends(rate_limit_ai)])
@router.post("/chat", response_model=CopilotChatResponse, summary="Chat with AI Trade Copilot alias", dependencies=[Depends(rate_limit_ai)])
async def copilot_chat(
    request: CopilotChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CopilotChatResponse:
    from app.ai.orchestrator import TradeXAIOrchestrator

    # 1. Resolve multi-turn conversation and context
    conv = None
    search_state = {}
    if request.conversation_id and current_user:
        try:
            conv_uuid = uuid.UUID(request.conversation_id)
            conv = (
                await db.execute(
                    select(CopilotConversation)
                    .where(CopilotConversation.id == conv_uuid, CopilotConversation.user_id == current_user.id)
                )
            ).scalar_one_or_none()
            if conv and hasattr(conv, "search_state") and conv.search_state:
                search_state = dict(conv.search_state)
        except (ValueError, TypeError):
            conv = None

    context = {"search_state": search_state}

    # 2. Unified brain processing
    resp = await TradeXAIOrchestrator.process_turn(
        query=request.message,
        conversation_context=context,
        db=db,
        current_user=current_user,
        surface="copilot",
    )

    # 3. Persist conversation and messages
    conv_id = request.conversation_id
    if current_user:
        if not conv:
            conv = CopilotConversation(
                user_id=current_user.id,
                title=request.message[:60] if len(request.message) > 5 else "Trade Consultation",
            )
            if hasattr(conv, "search_state"):
                conv.search_state = resp.search_state
            db.add(conv)
            await db.flush()
        else:
            if hasattr(conv, "search_state"):
                conv.search_state = resp.search_state

        conv_id = str(conv.id)

        # Save user message
        db.add(CopilotMessage(
            conversation_id=conv.id,
            role="user",
            content=request.message,
        ))

        # Save assistant message
        db.add(CopilotMessage(
            conversation_id=conv.id,
            role="assistant",
            content=resp.text,
            sources=resp.sources,
            suggested_actions=[{"action": a} for a in resp.suggested_actions],
        ))
        await db.commit()

    return CopilotChatResponse(
        response=resp.text,
        suggested_actions=resp.suggested_actions,
        sources=resp.sources,
        conversation_id=conv_id,
        ai_meta=resp.ai_meta,
        rag_used=resp.rag_used,
        mode=resp.mode,
        cards=[c.model_dump() for c in resp.cards],
    )


@router.get("/copilot/conversations", summary="List user's Copilot conversations")
async def list_copilot_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    stmt = (
        select(CopilotConversation)
        .where(CopilotConversation.user_id == current_user.id)
        .order_by(desc(CopilotConversation.updated_at))
        .limit(30)
    )
    convs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


@router.get("/copilot/conversations/{conversation_id}", summary="Get messages in a Copilot conversation")
async def get_copilot_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    stmt = (
        select(CopilotConversation)
        .where(CopilotConversation.id == conversation_id, CopilotConversation.user_id == current_user.id)
        .options(selectinload(CopilotConversation.messages))
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": str(conv.id),
        "title": conv.title,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "sources": m.sources or [],
                "suggested_actions": m.suggested_actions or [],
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in conv.messages
        ],
    }


@router.delete("/copilot/conversations/{conversation_id}", summary="Delete a Copilot conversation")
async def delete_copilot_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    stmt = (
        select(CopilotConversation)
        .where(CopilotConversation.id == conversation_id, CopilotConversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.commit()
    return {"status": "deleted", "id": str(conversation_id)}


# ---------------------------------------------------------------------------
# Admin Diagnostics Endpoints (Prompt 9)
# ---------------------------------------------------------------------------

@router.get("/admin/diagnostics", summary="Get AI provider diagnostics, health, and circuit breaker status")
async def get_ai_admin_diagnostics(
    current_user: User = Depends(require_role("admin")),
) -> Dict[str, Any]:
    """Returns runtime AI provider configuration, model settings, and circuit breaker telemetry. Secrets are never exposed."""
    prov = (settings.AI_PROVIDER or "mock").lower()

    # Determine configured API key status without leaking secrets
    api_key_configured = False
    if prov == "openrouter":
        api_key_configured = bool(settings.OPENROUTER_API_KEY)
    elif prov == "groq":
        api_key_configured = bool(settings.GROQ_API_KEY)
    elif prov == "gemini":
        api_key_configured = bool(settings.GEMINI_API_KEY)
    elif prov == "anthropic":
        api_key_configured = bool(settings.ANTHROPIC_API_KEY)

    stats = circuit_breaker.get_stats()

    return {
        "provider": prov,
        "model": settings.AI_MODEL,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dim": settings.EMBEDDING_DIM,
        "ollama_base_url": settings.OLLAMA_BASE_URL if prov == "ollama" else None,
        "api_key_configured": api_key_configured,
        "timeout_seconds": settings.AI_TIMEOUT_SECONDS,
        "circuit_breaker": stats,
        "fallback_provider": "MockProvider (Demo AI)",
        "is_fallback_active": circuit_breaker.is_open() or prov in ["mock", "deterministic_fallback"],
    }


@router.post("/admin/test-connection", summary="Test live roundtrip connection to configured AI provider")
async def test_ai_connection(
    current_user: User = Depends(require_role("admin")),
) -> Dict[str, Any]:
    """Tests roundtrip text completion with the active AI provider. Never leaks API keys."""
    from app.ai.provider import get_ai_provider
    provider = get_ai_provider()
    t0 = time.time()
    try:
        resp = await provider.complete(
            system="You are a health probe test engine.",
            messages=[{"role": "user", "content": "Ping test"}],
            max_tokens=20,
        )
        latency = round((time.time() - t0) * 1000, 2)
        return {
            "status": "connected",
            "provider": resp.provider,
            "model": resp.model,
            "latency_ms": latency,
            "is_mock": resp.is_mock,
            "message": "AI provider connection test succeeded.",
        }
    except Exception as e:
        latency = round((time.time() - t0) * 1000, 2)
        circuit_breaker.record_failure(error=str(e), is_rate_limit="429" in str(e))
        return {
            "status": "failed",
            "provider": getattr(provider, "model_name", settings.AI_PROVIDER),
            "latency_ms": latency,
            "error": str(e),
            "message": "AI provider connection failed. Fallback to Demo AI is enabled.",
        }


class CatalogQueryRequest(BaseModel):
    query: str
    target_price: Optional[float] = None
    currency: Optional[str] = "USD"
    quantity: Optional[int] = None
    destination: Optional[str] = None
    certifications: Optional[List[str]] = []


@router.post("/catalog/query", summary="Grounded RAG catalog search and assistant pipeline")
async def query_catalog_assistant(
    payload: CatalogQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Executes Prompt 16 Grounded Catalog Assistant pipeline.
    Uses PostgreSQL as single source of truth for price, tiers, stock, certs.
    """
    supplier_id = None
    role = "buyer"
    if current_user:
        role = current_user.role or "buyer"
        if role.lower() == "supplier":
            s_res = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
            supplier = s_res.scalar_one_or_none()
            if supplier:
                supplier_id = supplier.id

    filters = {
        "target_price": payload.target_price,
        "currency": payload.currency,
        "quantity": payload.quantity,
        "destination": payload.destination,
        "certifications": payload.certifications,
    }

    result = await ask_catalog_assistant(
        query=payload.query,
        db=db,
        role=role,
        supplier_id=supplier_id,
        filters=filters,
    )
    return result
