from typing import List, Optional
from pydantic import BaseModel, Field


class HeroStats(BaseModel):
    verified_suppliers: int = Field(2847, description="Count of verified suppliers")
    global_buyers: int = Field(12430, description="Count of active global buyers")
    active_shipments: int = Field(1250, description="Shipments currently active or in transit")
    countries_covered: int = Field(98, description="Global countries actively trading")


class KPICard(BaseModel):
    title: str
    value: str
    delta_percentage: str
    is_positive: bool = True
    subtext: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    hero_stats: HeroStats
    kpis: List[KPICard]


class RecommendedSupplier(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    country: str
    city: Optional[str] = None
    flag: str = "🌐"
    years_in_business: int = 5
    is_verified: bool = True
    trust_score: float = 95.0
    rating: float = 4.8
    review_count: int = 24
    on_time_rate: float = 96.0
    capacity_per_month: str = "500 MT / month"
    moq: str = "1 MT"
    certifications: List[str] = Field(default_factory=list)
    is_saved: bool = False


class MarketInsightItem(BaseModel):
    id: str
    name: str
    category: str
    trend_percentage: str
    is_positive: bool = True
    sparkline: List[float]
    thumbnail_url: Optional[str] = None


class SuggestedPrompt(BaseModel):
    id: str
    prompt: str
    category: Optional[str] = None


class CopilotChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None


class CopilotChatResponse(BaseModel):
    response: str
    suggested_actions: List[str] = Field(default_factory=list)
