"""
TradeX AI - Schemas for AI Mode (Prompt 18)
"""
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class ConversationListItem(BaseModel):
    id: str
    title: str
    search_state: Dict[str, Any]
    created_at: str
    updated_at: str
    messages_count: int = 0
    selected_count: int = 0


class ProductCardItem(BaseModel):
    product_id: str
    image: Optional[str] = None
    title: str
    supplier_name: str
    origin_country: str
    unit_price: float
    price_range: Optional[str] = None
    currency: str = "USD"
    price_status: str = "current"  # current, unconfirmed, stale
    moq: float
    supplier_verification: bool = False
    certifications: List[Any] = []
    lead_time: Optional[int] = None
    match_explanation: Dict[str, Any] = {}
    demo_data: bool = False
    availability_status: str = "in_stock"  # in_stock, limited, made_to_order, out_of_stock
    available_quantity: Optional[float] = None
    is_alternative: bool = False
    price_original: Optional[float] = None
    currency_original: Optional[str] = None
    price_display: Optional[float] = None
    currency_display: Optional[str] = None
    rate: Optional[float] = None
    rate_as_of: Optional[str] = None
    is_simulated: Optional[bool] = None


class MessageInput(BaseModel):
    content: str = Field(..., min_length=1)


class AIMessageDetail(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    structured: Optional[Dict[str, Any]] = None
    provider: str
    model: Optional[str] = None
    is_demo: bool
    latency_ms: Optional[int] = None
    fallback_reason: Optional[str] = None
    created_at: str


class MessageTurnResponse(BaseModel):
    user_message: AIMessageDetail
    assistant_reply: AIMessageDetail
    classification: str
    product_cards: List[ProductCardItem] = []
    clarifying_question: Optional[str] = None
    comparison_data: Optional[Dict[str, Any]] = None
    has_more: bool = False
    total_cards: int = 0
    active_filters: List[Dict[str, str]] = []
    suggested_chips: List[str] = []


class ConversationDetail(BaseModel):
    id: str
    title: str
    search_state: Dict[str, Any]
    created_at: str
    updated_at: str
    messages: List[AIMessageDetail] = []
    selected_products: List[ProductCardItem] = []


class NegotiationDraftCreate(BaseModel):
    target_price: float = Field(..., gt=0)
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None


class NegotiationDraftSendInput(BaseModel):
    confirm: bool = Field(..., description="Explicit buyer confirmation flag required to send")
    final_message: str = Field(..., min_length=1, description="Buyer's final edited negotiation text")


class NegotiationDraftResponse(BaseModel):
    id: str
    conversation_id: str
    product_id: str
    supplier_id: str
    buyer_id: str
    original_unit_price: float
    currency: str
    original_moq: int
    target_price: float
    quantity: float
    ai_suggested_message: str
    final_message: Optional[str] = None
    status: str
    linked_thread_id: Optional[str] = None
    created_at: str
