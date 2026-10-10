from typing import List
from fastapi import APIRouter
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


@router.get("/status")
async def ai_status():
    return {"module": "ai", "status": "initialized"}


@router.post("/copilot/suggested-prompts", response_model=List[SuggestedPrompt], summary="Get AI Trade Copilot suggested prompts")
async def get_suggested_prompts() -> List[SuggestedPrompt]:
    return SUGGESTED_PROMPTS


@router.post("/copilot/chat", response_model=CopilotChatResponse, summary="Chat with AI Trade Copilot")
async def copilot_chat(request: CopilotChatRequest) -> CopilotChatResponse:
    query = request.message.strip().lower()

    if "turmeric" in query and "hs code" in query:
        response_text = (
            "**HS Code for Turmeric Powder**: `0910.30.20` (Curcuma / Turmeric crushed or ground).\n"
            "- **Import Duty (EU / Germany)**: 0% under standard GSP tariff.\n"
            "- **Export Duty (India)**: 0%.\n"
            "- **Mandatory Certifications**: Phyto-sanitary certificate, FSSAI export clearance, Certificate of Origin."
        )
        actions = ["View Turmeric Suppliers", "Compare EU Landed Cost", "Draft Turmeric RFQ"]
    elif "landed cost" in query or ("india" in query and "germany" in query):
        response_text = (
            "**Landed Cost Breakdown (India to Germany - 20 Tons Turmeric CIF Hamburg)**:\n"
            "1. **FOB Price (Mundra)**: $2.85/kg ($57,000)\n"
            "2. **Ocean Freight (20ft FCL)**: $2,850\n"
            "3. **Marine Cargo Insurance**: $420\n"
            "4. **Customs Clearance & Port Handling**: $850\n"
            "**Total Estimated Landed Cost**: **$61,120 (~€56,230)** or **$3.06/kg**."
        )
        actions = ["Request Freight Quotation", "View Escrow Terms", "Find Shipping Lines"]
    elif "document" in query:
        response_text = (
            "**Required Export-Import Documentation for Agricultural Commodities**:\n"
            "1. Commercial Invoice & Packing List\n"
            "2. Clean On-Board Bill of Lading (B/L)\n"
            "3. Certificate of Origin (APEDA / Chamber of Commerce)\n"
            "4. Phytosanitary Certificate (Plant Quarantine Department)\n"
            "5. Quality & Fumigation Inspection Certificate (SGS / Intertek)"
        )
        actions = ["Download Document Checklist", "Verify Supplier Certifications"]
    elif "freight forwarder" in query:
        response_text = (
            "Top rated freight forwarders covering India to Europe / Middle East trade routes:\n"
            "- **Maersk Line Direct**: 21-day transit time, Nhava Sheva to Rotterdam/Hamburg.\n"
            "- **MSC Logistics**: Best spot rates for 20ft & 40ft dry containers.\n"
            "- **Hapag-Lloyd Express**: Guaranteed temperature-controlled reefer slots."
        )
        actions = ["Book Freight Slot", "Calculate Container Weight"]
    else:
        response_text = (
            f"TradeX AI analyzed your inquiry: *'{request.message}'*.\n\n"
            "Based on live market data, verified suppliers from India and Vietnam currently provide the highest "
            "cost-efficiency and verified compliance with EU and US food-grade standards. "
            "Would you like me to generate a tailored RFQ or run a multi-supplier landed cost comparison?"
        )
        actions = ["Create New RFQ", "Search Catalog", "Talk to Trade Specialist"]

    return CopilotChatResponse(response=response_text, suggested_actions=actions)
