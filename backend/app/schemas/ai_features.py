from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProductAISummaryResponse(BaseModel):
    key_points: List[str] = Field(
        default_factory=list,
        description="Key factual trade points synthesized from verified product specs and supplier credentials",
    )
    caution: str = Field(
        default="Verify packaging specifications and shipping transit times for moisture-sensitive cargo.",
        description="Operational shipping, shelf-life, or packaging consideration",
    )
    ai_label: str = Field(default="AI generated", description="Transparency label")


class ListingWriterRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Brief raw notes or bullet points about the product")
    product_name: Optional[str] = Field(None, description="Informal or preliminary product name")
    category: Optional[str] = Field(None, description="Target industry category")
    origin_country: Optional[str] = Field("India", description="Country of origin")


class ListingWriterResponse(BaseModel):
    title: str = Field(..., description="Polished, export-grade commercial product title")
    description: str = Field(..., description="Detailed commercial catalog description")
    specifications: Dict[str, str] = Field(
        default_factory=dict, description="Structured technical/chemical specifications"
    )
    search_keywords: List[str] = Field(
        default_factory=list, description="Top high-intent search terms buyers use"
    )
    aliases: List[str] = Field(
        default_factory=list, description="Common regional or industry synonyms"
    )
    ai_label: str = Field(default="AI generated", description="Transparency label")


class InquiryReplyRequest(BaseModel):
    inquiry_id: Optional[str] = Field(None, description="Inquiry thread ID if linked to an existing thread")
    buyer_message: str = Field(..., description="Buyer inquiry message content")
    product_id: Optional[str] = Field(None, description="Product ID being inquired about")
    supplier_notes: Optional[str] = Field(None, description="Optional custom supplier notes or price flexibility")


class InquiryReplyResponse(BaseModel):
    reply_draft: str = Field(..., description="Polished professional supplier response to the inquiry")
    suggested_next_steps: List[str] = Field(
        default_factory=list, description="Recommended next actions (e.g. sample shipment, CIF quote)"
    )
    clarifications_requested: List[str] = Field(
        default_factory=list, description="Questions for buyer regarding volume, port, Incoterms"
    )
    ai_label: str = Field(default="AI generated", description="Transparency label")


class ProfileTipsResponse(BaseModel):
    completeness_score: int = Field(..., ge=0, le=100, description="Completeness score 0-100")
    strengths: List[str] = Field(default_factory=list, description="Current storefront strengths")
    actionable_tips: List[str] = Field(
        default_factory=list, description="Concrete tips to improve buyer trust and conversion"
    )
    priority_area: str = Field(..., description="Top recommended area for immediate improvement")
    ai_label: str = Field(default="AI generated", description="Transparency label")


class RFQOpportunityResponse(BaseModel):
    match_score: int = Field(..., ge=0, le=100, description="Opportunity fit score 0-100")
    capability_match_summary: str = Field(
        ..., description="Assessment of supplier capacity, MOQ, and certs vs RFQ requirements"
    )
    recommended_bid_strategy: str = Field(
        ..., description="Recommended pricing, Incoterms, and payment terms strategy"
    )
    risk_factors: List[str] = Field(
        default_factory=list, description="Identified execution or commercial risk factors"
    )
    ai_label: str = Field(default="AI generated", description="Transparency label")


class ModerationSummaryRequest(BaseModel):
    entity_type: str = Field(..., description="'product', 'rfq', or 'document'")
    entity_id: str = Field(..., description="UUID or identifier of the entity")
    flag_reason: Optional[str] = Field(None, description="Reason entity was flagged or reported")


class ModerationSummaryResponse(BaseModel):
    risk_level: str = Field(
        ..., description="'low', 'medium', 'high', or 'critical'"
    )
    summary: str = Field(..., description="Concise objective summary of the flagged content")
    violation_categories: List[str] = Field(
        default_factory=list, description="Potential compliance or catalog violation categories"
    )
    recommended_action: str = Field(
        ..., description="'approve', 'request_revision', 'reject', or 'escalate'"
    )
    reasoning: str = Field(
        ..., description="Factual analysis and rationale for the recommended action"
    )
    ai_label: str = Field(
        default="AI generated (Advisory only - Human decides)",
        description="Transparency and human-in-the-loop advisory label",
    )


class SupplierMatchExplainResponse(BaseModel):
    match_score: int = Field(default=85, ge=0, le=100)
    key_strengths: List[str] = Field(default_factory=list)
    compliance_alignment: str = Field(
        default="Directly aligns with target quality and import regulations."
    )
    risk_factors: List[str] = Field(default_factory=list)
    two_sentence_explanation: Optional[str] = None
    ai_label: str = Field(default="AI generated")
