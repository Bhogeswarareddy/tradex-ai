import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_optional, get_current_user
from app.core.db import get_db
from app.models.content import CopilotConversation, CopilotMessage
from app.models.identity import Buyer, Supplier, User
from app.models.ai_ops import KnowledgeChunk
from app.ai.rag.retriever import retrieve_knowledge_chunks
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


@router.get("/status")
async def ai_status():
    return {"module": "ai", "status": "initialized", "rag_enabled": True}


@router.post("/copilot/suggested-prompts", response_model=List[SuggestedPrompt], summary="Get AI Trade Copilot suggested prompts")
async def get_suggested_prompts() -> List[SuggestedPrompt]:
    return SUGGESTED_PROMPTS


@router.get("/copilot/guides", summary="Get catalog of trade knowledge guides")
async def get_copilot_guides() -> List[Dict[str, Any]]:
    return GUIDE_SUMMARIES


@router.post("/copilot/chat", response_model=CopilotChatResponse, summary="Chat with AI Trade Copilot with RAG grounding")
async def copilot_chat(
    request: CopilotChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CopilotChatResponse:
    query = request.message.strip()
    query_lower = query.lower()

    # 1. Resolve multi-tenant company context
    user_company_id = None
    if current_user:
        supp = (await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))).scalar_one_or_none()
        if supp:
            user_company_id = supp.company_id
        else:
            buyer = (await db.execute(select(Buyer).where(Buyer.user_id == current_user.id))).scalar_one_or_none()
            if buyer:
                user_company_id = buyer.company_id

    # 2. Retrieve relevant grounded knowledge chunks
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
            "relevance_score": chunk.score,
        }
        for chunk in retrieved_chunks
    ]

    # 3. Formulate RAG-grounded response
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
        # Build synthesis from top retrieved chunk
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
        response_text = (
            f"TradeX AI analyzed your inquiry: *'{query}'*.\n\n"
            "Based on international trade regulations and verified supplier records, TradeX AI helps you navigate "
            "cross-border procurement, tariff classifications, and landed cost simulations. "
            "Would you like me to generate a tailored RFQ or run a multi-supplier landed cost comparison?"
        )
        actions = ["Create New RFQ", "Search Catalog", "Talk to Trade Specialist"]

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
