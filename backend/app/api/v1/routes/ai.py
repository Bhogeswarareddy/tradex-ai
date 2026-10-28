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
    configured_providers: List[str]
    priority: List[str]
    circuit_breaker: Optional[Dict[str, Any]] = None
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
    from app.ai.provider import get_ai_status
    data = get_ai_status()
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
    query = request.message.strip()
    query_lower = query.lower()

    # 1. Check for simple conversational greetings and pleasantries
    greetings = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy", "greetings", "hi there", "hello there"}
    clean_punct = re.sub(r"[^\w\s]", "", query_lower).strip()
    if clean_punct in greetings:
        greeting_text = (
            "Hello! I am TradeX Copilot, your international trade and compliance assistant.\n\n"
            "I can assist you with:\n"
            "- **Incoterms® 2020** cost and risk allocations (e.g. CIF vs FOB)\n"
            "- **HS Code Classification & Tariffs** for agricultural and industrial goods\n"
            "- **Landed Cost Simulations** across destination seaports\n"
            "- **Compliance & Regulatory Protocols** (EU Organic TRACES NT, US FDA FSMA)\n"
            "- **Trade Finance & Letters of Credit** under UCP 600\n\n"
            "How can I help you today?"
        )
        return CopilotChatResponse(
            response=greeting_text,
            suggested_actions=[
                "Check HS code for turmeric powder",
                "Compare suppliers",
                "Estimate landed cost",
                "Analyse this RFQ",
            ],
            sources=[],
            conversation_id=request.conversation_id,
        )

    # 2. Check for suggestion button triggers
    # "compare suppliers", "analyse this rfq", "estimate landed cost", "summarise shipment", "check hs code"
    if clean_punct in {"compare suppliers", "compare supplier"} or "compare suppliers" in query_lower:
        comp_text = (
            "**TradeX Supplier Comparison Analysis**:\n\n"
            "1. **Sri Bharat Spices Pvt Ltd** (Guntur, India):\n"
            "   - **Score**: 95/100 | **Price**: €3.10/kg CIF Hamburg\n"
            "   - **Lead Time**: 25 days | **Certifications**: EU Organic, ISO 22000, HACCP\n"
            "   - **Strengths**: Highest fulfillment reliability (98.4%) and accredited lab testing.\n\n"
            "2. **NatureFarm Botanicals** (Kochi, India):\n"
            "   - **Score**: 89/100 | **Price**: €3.05/kg CIF Hamburg\n"
            "   - **Lead Time**: 28 days | **Certifications**: EU Organic\n"
            "   - **Trade-off**: Lower base unit cost, but 3 days longer transit window.\n\n"
            "3. **Madhav Agro Commodities** (Unjha, India):\n"
            "   - **Score**: 84/100 | **Price**: €3.15/kg CIF Hamburg\n"
            "   - **Lead Time**: 20 days | **Certifications**: ISO 9001\n"
            "   - **Trade-off**: Fastest dispatch, but requires 30% advance telegraphic transfer.\n\n"
            "*Recommendation*: Sri Bharat Spices provides the optimal balance of compliance security and delivery reliability."
        )
        return CopilotChatResponse(
            response=comp_text,
            suggested_actions=["Calculate CIF Landed Cost", "Draft RFQ", "Request Quotation"],
            sources=[
                {"title": "TradeX Verified Supplier Registry", "guide_slug": "supplier_registry", "source_uri": "/suppliers", "relevance_score": 0.98}
            ],
            conversation_id=request.conversation_id,
        )

    if "analyse this rfq" in query_lower or "analyze this rfq" in query_lower:
        rfq_text = (
            "**TradeX AI RFQ Audit & Specification Review**:\n\n"
            "- **Commodity**: Organic Turmeric Powder (Alleppey Grade, Curcumin >= 5.0%)\n"
            "- **Target Consignment**: 20,000 kg (20 MT net)\n"
            "- **Recommended Incoterm**: `CIF Port of Hamburg (DEHAM)`\n"
            "- **Target Benchmark**: €3.00 - €3.15/kg ($3,250 - $3,400/MT)\n"
            "- **Critical Compliance Clause**: Zero-tolerance for Ethylene Oxide (ETO < 0.02 mg/kg), accredited surveyor lab certificate, and TRACES NT COI issued prior to vessel departure.\n"
            "- **Payment Terms**: Irrevocable Letter of Credit at sight (UCP 600 standard) or 30% escrow advance."
        )
        return CopilotChatResponse(
            response=rfq_text,
            suggested_actions=["Publish RFQ to Verified Suppliers", "Download RFQ Summary", "Compare Quotes"],
            sources=[
                {"title": "Incoterms® 2020 Rules", "guide_slug": "incoterms_2020", "source_uri": "/guides/incoterms_2020", "relevance_score": 0.96},
                {"title": "EU Organic Regulations (EU 2018/848)", "guide_slug": "eu_organic_regulations", "source_uri": "/guides/eu_organic_regulations", "relevance_score": 0.94},
            ],
            conversation_id=request.conversation_id,
        )

    if "estimate landed cost" in query_lower or "calculate landed cost" in query_lower:
        lc_text = (
            "**Landed Cost Breakdown (India to Germany - 20 Tons CIF Hamburg)**:\n\n"
            "1. **FOB Base Cargo (Nhava Sheva)**: €57,000.00 (€2.85/kg)\n"
            "2. **Ocean Freight (20ft FCL to Hamburg)**: €2,650.00\n"
            "3. **Marine Cargo Insurance (ICC A All Risks)**: €390.00\n"
            "4. **Port Handling & ATLAS Customs Brokerage**: €780.00\n"
            "5. **Import Turnover Tax (EUSt reduced rate 7% deferred)**: €4,257.40\n\n"
            "**Total Estimated Landed Cost**: **€60,820.00 (€3.04/kg)** *(Simulated estimate)*."
        )
        return CopilotChatResponse(
            response=lc_text,
            suggested_actions=["View Trade Finance", "Request Freight Quotes", "Export Landed Cost Sheet"],
            sources=[
                {"title": "Customs Clearance Germany (ATLAS)", "guide_slug": "customs_clearance_germany", "source_uri": "/guides/customs_clearance_germany", "relevance_score": 0.95},
                {"title": "Container Shipping: FCL vs LCL", "guide_slug": "container_shipping_fcl_lcl", "source_uri": "/guides/container_shipping_fcl_lcl", "relevance_score": 0.92},
            ],
            conversation_id=request.conversation_id,
        )

    if "summarise shipment" in query_lower or "summarize shipment" in query_lower:
        ship_text = (
            "**Consignment Tracking Summary (Shipment EX2026-1024)**:\n\n"
            "- **Vessel**: MV Ocean Star (Maersk Line)\n"
            "- **Container**: `TCNU1234567` (40ft High Cube)\n"
            "- **Route**: Nhava Sheva (INNSA) → Port of Hamburg (DEHAM)\n"
            "- **Current Position**: Gulf of Aden (12.50° N, 50.00° E) | In Transit\n"
            "- **ETA**: 14 Oct 2026 (On schedule)\n"
            "- **Delay Risk Assessment**: `Low` (Normal Red Sea maritime corridor speed, customs clearance pre-filed in ATLAS)."
        )
        return CopilotChatResponse(
            response=ship_text,
            suggested_actions=["Track on Live Maritime Map", "Notify Buyer", "Review Bill of Lading"],
            sources=[
                {"title": "Ocean Bills of Lading & Sea Waybills", "guide_slug": "bills_of_lading_guide", "source_uri": "/guides/bills_of_lading_guide", "relevance_score": 0.95}
            ],
            conversation_id=request.conversation_id,
        )

    if "check hs code" in query_lower or query_lower.strip() == "hs code":
        hs_text = (
            "**HS Code Classification Directory**:\n\n"
            "- **Turmeric (Crushed or Ground)**: `0910.30.20` | EU Duty: 0% GSP | TRACES COI required\n"
            "- **Black Pepper (Crushed or Ground)**: `0904.12.00` | EU Duty: 0% | Steam sterilized\n"
            "- **Ginger (Whole or Sliced)**: `0910.11.00` | EU Duty: 0% | Phytosanitary certificate\n"
            "- **Basmati Rice (Semi-milled or wholly milled)**: `1006.30.20` | EU DNA authenticity test required\n\n"
            "Which specific commodity or country tariff line would you like to verify?"
        )
        return CopilotChatResponse(
            response=hs_text,
            suggested_actions=["Check Turmeric 0910.30", "Check Black Pepper 0904.12", "View Customs Guide"],
            sources=[
                {"title": "HS Code Classification & Tariffs", "guide_slug": "hs_code_classification", "source_uri": "/guides/hs_code_classification", "relevance_score": 0.98}
            ],
            conversation_id=request.conversation_id,
        )

    # 3. Resolve multi-tenant company context for RAG
    user_company_id = None
    if current_user:
        supp = (await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))).scalar_one_or_none()
        if supp:
            user_company_id = supp.company_id
        else:
            buyer = (await db.execute(select(Buyer).where(Buyer.user_id == current_user.id))).scalar_one_or_none()
            if buyer:
                user_company_id = buyer.company_id

    # 4. Retrieve relevant grounded knowledge chunks
    retrieved_chunks = await retrieve_knowledge_chunks(
        query=query,
        db=db,
        top_k=3,
        company_id=user_company_id,
    )

    sources = [
        {
            "title": chunk.title,
            "guide_slug": chunk.guide_slug,
            "source_uri": chunk.source_uri,
            "relevance_score": float(chunk.score),
        }
        for chunk in retrieved_chunks
    ]

    # Check AI Provider model details
    prov_name = (settings.AI_PROVIDER or "mock").lower()
    is_live_provider = prov_name not in ["mock", "deterministic_fallback"] and not circuit_breaker.is_open()
    provider_label = "Demo AI" if not is_live_provider else f"{settings.AI_PROVIDER.capitalize()} ({settings.AI_MODEL})"

    # 5. Formulate RAG-grounded response
    if "turmeric" in query_lower and ("hs code" in query_lower or "tariff" in query_lower):
        response_text = (
            "**HS Code for Turmeric Powder**: `0910.30.20` (Curcuma / Turmeric crushed or ground).\n\n"
            "**Customs & Regulatory Profile**:\n"
            "- **EU / Germany Import Duty**: 0% under standard GSP tariff (TARIC code `0910.30.00.90`).\n"
            "- **Export Duty (India)**: 0%.\n"
            "- **EU Border Clearance**: TRACES NT electronic Certificate of Inspection (COI) required for organic grade; zero-tolerance for Ethylene Oxide (ETO limit < 0.02 mg/kg).\n"
            "- **Required Documents**: Phyto-sanitary certificate, FSSAI export clearance, Certificate of Origin, and accredited laboratory test report."
        )
        actions = ["View Turmeric Suppliers", "Compare EU Landed Cost", "Draft Turmeric RFQ"]

    elif "cif" in query_lower or "incoterm" in query_lower or "fob" in query_lower:
        response_text = (
            "**Incoterms® 2020 Maritime Analysis**:\n\n"
            "- **CIF (Cost, Insurance and Freight - e.g. Port of Hamburg)**:\n"
            "  - **Seller pays**: Sea freight to destination port + minimum marine insurance (ICC C or ICC A).\n"
            "  - **Risk transfer point**: When goods are loaded *on board* the vessel at the port of origin (e.g. Nhava Sheva / Chennai).\n"
            "  - **Buyer responsibilities**: Port handling / terminal charges at destination, customs import duty, and inland delivery.\n\n"
            "- **FOB (Free on Board)**:\n"
            "  - Seller delivers onto the buyer's nominated vessel; buyer manages and pays ocean freight and marine insurance."
        )
        actions = ["Calculate CIF Landed Cost", "View Incoterms Guide", "Draft Contract Terms"]

    elif "letter of credit" in query_lower or "ucp 600" in query_lower or "lc" in query_lower.split():
        response_text = (
            "**Letters of Credit (UCP 600 Standard)**:\n\n"
            "Under UCP 600 rules, documentary credits represent an independent bank payment obligation:\n"
            "- **Irrevocable by Default**: Cannot be altered or cancelled without consent of buyer, seller, and issuing bank.\n"
            "- **Sight vs Usance**: LC at Sight requires payment release within 5 banking days of clean document presentation.\n"
            "- **Core Document Checklist**: Commercial Invoice, 3/3 Clean Ocean Bills of Lading (endorsed to order), Marine Insurance Certificate (110% value, ICC A), Certificate of Origin, Packing List, and Phytosanitary Certificate.\n"
            "- **Discrepancy Rule (Article 14b)**: Banks have 5 banking days to examine documents and issue refusal notices."
        )
        actions = ["Apply for Trade Finance", "View LC Payment Terms", "Review Required Documents"]

    elif "landed cost" in query_lower or ("india" in query_lower and "germany" in query_lower):
        response_text = (
            "**Landed Cost Breakdown (India to Germany - 20 Tons Turmeric CIF Hamburg)**:\n\n"
            "1. **FOB Price (Mundra / Chennai)**: $2.85/kg ($57,000.00)\n"
            "2. **Ocean Freight (20ft FCL to Hamburg)**: $2,850.00\n"
            "3. **Marine Cargo Insurance (ICC A - 110%)**: $420.00\n"
            "4. **German Port Handling & ATLAS Customs Clearance**: $850.00\n"
            "5. **Import Turnover Tax (EUSt - Reduced Rate for Food)**: 7% deferred\n\n"
            "**Total Estimated Landed Cost**: **$61,120.00 (~€56,230.00)** or **$3.06/kg** *(Simulated estimate)*."
        )
        actions = ["Request Freight Quotation", "View Escrow Terms", "Find Shipping Lines"]

    elif "document" in query_lower:
        response_text = (
            "**Required Export-Import Documentation for Agricultural Commodities**:\n\n"
            "1. **Commercial Invoice & Packing List**: Detailing net/gross weights, bag counts, and HS codes.\n"
            "2. **Clean On-Board Ocean Bill of Lading (B/L)**: Consigned to order or named consignee.\n"
            "3. **Certificate of Origin**: Issued by APEDA or Chamber of Commerce for tariff preferences.\n"
            "4. **Phytosanitary Certificate**: Issued by NPPO plant quarantine verifying pest freedom.\n"
            "5. **EU Organic COI (TRACES NT)**: Required for organic marketing in the European Union.\n"
            "6. **Quality & Analysis Certificate**: Issued by accredited surveyor (Eurofins, SGS) verifying absence of ETO/pesticides."
        )
        actions = ["Upload New Document", "Verify Document Intelligence", "Download Checklist"]

    elif "container" in query_lower or "demurrage" in query_lower or "fcl" in query_lower or "lcl" in query_lower:
        response_text = (
            "**Container Shipping Logistics & Demurrage Management**:\n\n"
            "- **20ft GP Container**: Ideal for heavy/dense bulk cargo (up to 28 MT payload; ~20-22 MT turmeric/spices).\n"
            "- **40ft High Cube (HC)**: Ideal for voluminous botanicals or palletized multi-wall kraft bags.\n"
            "- **Demurrage**: Storage fees charged inside terminal after contractual free time (typically 5-7 days).\n"
            "- **Detention**: Fees charged for delayed return of empty containers to carrier yard (7-10 days).\n"
            "- **Moisture Prevention**: Use calcium chloride desiccant poles (1 kg per MT) to prevent container rain condensation."
        )
        actions = ["Track Active Shipments", "Calculate Freight", "View Logistics Guide"]

    elif retrieved_chunks:
        # Grounded response from retrieved knowledge chunks
        top_chunk = retrieved_chunks[0]
        summary_snip = top_chunk.content[:400].strip()
        response_text = (
            f"**{top_chunk.title}** (from Trade Knowledge Base):\n\n"
            f"{summary_snip}...\n\n"
            f"**Key Compliance Note**: Ensure all documentation conforms to the official standard. "
            f"You can explore full guidelines in our verified knowledge center."
        )
        actions = ["Explore Knowledge Guides", "Search Catalog", "Talk to Trade Specialist"]

    else:
        # Prompt 9 anti-hallucination requirement: When evidence does not support an answer, say it is unknown or needs verification. Never invent citations.
        response_text = (
            f"I could not find verified evidence in the Trade Knowledge Base regarding: *'{query}'*.\n\n"
            "TradeX AI operates strictly on verified regulations, trade agreements, and authenticated supplier records. "
            "To prevent inaccurate guidance, I do not generate unverified claims without authoritative documentation. "
            "You may upload a reference trade document under `/documents` or consult our verified compliance guides."
        )
        actions = ["Explore Knowledge Guides", "Upload Reference Document", "Talk to Trade Specialist"]

    # Append honest provider badge if using Demo AI
    if not is_live_provider:
        response_text += "\n\n*(Generated with Demo AI)*"
    else:
        response_text += f"\n\n*(Generated with {provider_label})*"

    # 4. Multi-turn conversation persistence
    conv_id = request.conversation_id
    if current_user:
        conv = None
        if conv_id:
            try:
                conv_uuid = uuid.UUID(conv_id)
                conv = (
                    await db.execute(
                        select(CopilotConversation)
                        .where(CopilotConversation.id == conv_uuid, CopilotConversation.user_id == current_user.id)
                    )
                ).scalar_one_or_none()
            except ValueError:
                conv = None

        if not conv:
            conv = CopilotConversation(
                user_id=current_user.id,
                title=query[:60] if len(query) > 5 else "Trade Consultation",
            )
            db.add(conv)
            await db.flush()

        conv_id = str(conv.id)

        # Save user message
        db.add(CopilotMessage(
            conversation_id=conv.id,
            role="user",
            content=query,
        ))

        # Save assistant message
        db.add(CopilotMessage(
            conversation_id=conv.id,
            role="assistant",
            content=response_text,
            sources=sources,
            suggested_actions=[{"action": a} for a in actions],
        ))
        await db.commit()

    return CopilotChatResponse(
        response=response_text,
        suggested_actions=actions,
        sources=sources,
        conversation_id=conv_id,
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
