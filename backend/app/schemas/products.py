from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PriceTierItem(BaseModel):
    min_qty: int
    max_qty: Optional[int] = None
    unit_price: float
    currency: str = "USD"


class SupplierSummary(BaseModel):
    id: str
    company_id: str
    name: str
    logo_url: Optional[str] = None
    country: str
    city: Optional[str] = None
    trust_score: float
    years_in_business: int
    on_time_rate: float
    response_time_hours: float
    verified_status: str
    rating: float = 4.8
    total_reviews: int = 24


class ProductListItem(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    category_name: str
    category_slug: str
    hs_code: Optional[str] = None
    moq: int
    unit: str
    origin_country: str
    lead_time_days: int
    price_min: float
    price_max: float
    currency: str = "USD"
    image_url: Optional[str] = None
    supplier_id: str
    supplier_name: str
    supplier_verified: bool = True
    supplier_country: str
    supplier_rating: float = 4.8
    certifications: List[str] = Field(default_factory=list)
    is_saved: bool = False
    status: Optional[str] = "published"
    price_status: Optional[str] = "current"
    availability_status_confirmed: Optional[str] = "current"
    price_confirmed_at: Optional[str] = None
    inventory_confirmed_at: Optional[str] = None
    price_badge: Optional[str] = None
    availability_badge: Optional[str] = None


class PaginatedProductsResponse(BaseModel):
    items: List[ProductListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class AISummary(BaseModel):
    key_points: List[str]
    caution: str


class ReviewsSummary(BaseModel):
    average_rating: float
    total_reviews: int


class ProductDetailResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    category_name: str
    category_slug: str
    hs_code: Optional[str] = None
    moq: int
    unit: str
    origin_country: str
    lead_time_days: int
    price_tiers: List[PriceTierItem]
    images: List[str] = Field(default_factory=list)
    supplier: SupplierSummary
    certifications: List[str] = Field(default_factory=list)
    reviews_summary: ReviewsSummary
    ai_summary: AISummary
    specifications: Optional[Dict[str, str]] = None
    packaging: Optional[str] = None
    incoterms: List[str] = Field(default_factory=lambda: ["FOB", "CIF", "EXW"])
    related_products: List[ProductListItem] = Field(default_factory=list)
    is_saved: bool = False

    # Prompt 15 Freshness & Status Metadata
    status: Optional[str] = "published"
    product_form: Optional[str] = None
    production_region: Optional[str] = None
    available_quantity: Optional[int] = 0
    reserved_quantity: Optional[int] = 0
    availability_status: Optional[str] = "in_stock"
    monthly_capacity: Optional[str] = None
    price_status: Optional[str] = "current"
    availability_status_confirmed: Optional[str] = "current"
    price_confirmed_at: Optional[str] = None
    inventory_confirmed_at: Optional[str] = None
    price_badge: Optional[str] = None
    availability_badge: Optional[str] = None
    supporting_documents: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    certifications_json: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    supported_destinations: Optional[List[str]] = Field(default_factory=list)
    payment_terms: Optional[List[str]] = Field(default_factory=list)


class CategoryNode(BaseModel):
    id: str
    name: str
    slug: str
    product_count: int = 0
    children: List["CategoryNode"] = Field(default_factory=list)


class CompareProductsRequest(BaseModel):
    product_ids: List[str] = Field(..., min_length=2, max_length=4)


class CompareAttributeRow(BaseModel):
    attribute: str
    values: Dict[str, str]


class CompareProductsResponse(BaseModel):
    products: List[ProductListItem]
    matrix: List[CompareAttributeRow]
