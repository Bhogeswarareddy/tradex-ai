from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


@dataclass
class LLMResponse:
    content: str
    raw_json: Optional[Dict[str, Any]] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    model: str = ""
    provider: str = ""
    fallback: bool = False
    is_mock: bool = False


class SearchRequirement(BaseModel):
    product: str = Field(description="Core commodity or manufactured product name")
    category: Optional[str] = Field(default=None, description="Industry product category")
    quantity: Optional[float] = Field(default=None, description="Target volume or weight numeric value")
    unit: Optional[str] = Field(default=None, description="Unit of measure (e.g. kg, MT, units)")
    origin_country: Optional[str] = Field(default=None, description="Supplier source country")
    destination_country: Optional[str] = Field(default=None, description="Importer destination country")
    destination_port: Optional[str] = Field(default=None, description="Destination port or city")
    certifications: List[str] = Field(default_factory=list, description="Required compliance certifications")
    max_budget: Optional[float] = Field(default=None, description="Maximum price or target budget")
    currency: str = Field(default="USD", description="Currency code")
    moq: Optional[int] = Field(default=None, description="Maximum acceptable MOQ")
    delivery_days: Optional[int] = Field(default=None, description="Maximum delivery lead time in days")
    incoterm: Optional[str] = Field(default=None, description="Trade Incoterm (e.g. CIF, FOB, CFR)")
    other_constraints: List[str] = Field(default_factory=list, description="Other packaging or quality constraints")
    confidence: Dict[str, float] = Field(default_factory=dict, description="Extraction confidence per field")

    def to_filters(self) -> Dict[str, Any]:
        """Convert extracted trade requirement to product & supplier search query params."""
        filters: Dict[str, Any] = {
            "q": self.product,
            "category": self.category,
            "origin_country": self.origin_country,
            "certifications": self.certifications,
            "currency": self.currency,
        }
        if self.max_budget:
            filters["max_price"] = self.max_budget
        if self.moq:
            filters["max_moq"] = self.moq
        if self.delivery_days:
            filters["max_lead_time"] = self.delivery_days
        return {k: v for k, v in filters.items() if v is not None}

    def get_missing_fields(self) -> List[str]:
        missing: List[str] = []
        if not self.destination_country:
            missing.append("destination_country")
        if not self.destination_port:
            missing.append("destination_port")
        if not self.quantity:
            missing.append("quantity")
        if not self.incoterm:
            missing.append("incoterm")
        if not self.delivery_days:
            missing.append("delivery_days")
        return missing

    def get_clarifying_questions(self) -> List[str]:
        questions: List[str] = []
        if self.destination_country and not self.destination_port:
            questions.append(
                f"Which port in {self.destination_country} would you like the consignment delivered to (e.g. Hamburg, Rotterdam)?"
            )
        elif not self.destination_country:
            questions.append("What is your destination country and preferred seaport?")

        if not self.incoterm:
            questions.append("Do you require CIF (Cost, Insurance & Freight) or FOB (Free On Board) pricing?")

        if not self.delivery_days:
            questions.append("What is your target shipping window or required delivery deadline?")

        return questions
