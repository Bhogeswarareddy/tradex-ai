from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SupplierCertificationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    name: str
    code: str
    certificate_no: str
    issuing_body: Optional[str] = None
    issued_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_valid: bool = True
    days_to_expiry: Optional[int] = None
    expiry_warning: bool = False


class SupplierProductSummaryItem(BaseModel):
    id: str
    name: str
    slug: str
    image_url: Optional[str] = None
    category_name: str
    moq: int
    unit: str
    price_min: float
    price_max: float
    currency: str
    is_active: bool = True


class SupplierListItem(BaseModel):
    id: str
    company_id: str
    name: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    country: str
    state: Optional[str] = None
    city: str
    years_in_business: int
    verified_status: str
    trust_score: float
    on_time_rate: float
    capacity_per_month: str
    response_time_hours: float
    rating: float
    total_reviews: int
    export_countries: List[str] = []
    min_moq: int = 500
    main_products: List[str] = []
    certifications: List[str] = []
    is_saved: bool = False


class PaginatedSuppliersResponse(BaseModel):
    items: List[SupplierListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class FactoryDetails(BaseModel):
    facility_size: Optional[str] = None
    annual_capacity: Optional[str] = None
    production_lines: Optional[int] = None
    cleanrooms: Optional[str] = None
    warehouse_capacity: Optional[str] = None
    testing_lab: Optional[str] = None
    photos: List[str] = []


class SupplierProfileResponse(BaseModel):
    id: str
    company_id: str
    name: str
    tag: str = "AN EXPORTER"
    one_line_description: str
    about_company: str
    country: str
    state: Optional[str] = None
    city: str
    location_display: str
    years_in_business: int
    verified_status: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    languages: List[str] = []
    on_time_rate: float
    total_buyers_count: int
    capacity_per_month: str
    trust_score: float
    rating: float
    total_reviews: int
    response_time_hours: float
    repeat_buyer_rate: float
    export_countries: List[str] = []
    certifications: List[SupplierCertificationItem] = []
    factory_details: FactoryDetails
    is_saved: bool = False


class SupplierReviewItem(BaseModel):
    id: str
    rating: int
    title: str
    comment: Optional[str] = None
    buyer_name: str
    buyer_company: str
    buyer_country: str
    created_at: str


class CreateReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Star rating between 1 and 5")
    title: str = Field(..., min_length=3, max_length=255)
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewResponse(BaseModel):
    id: str
    message: str
    review: SupplierReviewItem


class MonthlyTrendItem(BaseModel):
    month: str
    on_time_rate: float
    orders_count: int


class SupplierPerformanceResponse(BaseModel):
    on_time_rate: float
    response_time_hours: float
    repeat_buyer_rate: float
    total_orders: int
    monthly_trend: List[MonthlyTrendItem]


# --- Supplier Portal Schemas (Prompt 9) ---

class SupplierOpportunityItem(BaseModel):
    id: str
    rfq_number: str
    title: str
    buyer_country: str
    quantity: int
    unit: str
    target_price: float
    currency: str
    deadline: str
    match_score: int


class SupplierDashboardMetricsResponse(BaseModel):
    profile_views: int
    inquiries_count: int
    quotes_sent: int
    quote_win_rate: float
    open_rfqs_matching: int
    revenue_this_month: float
    timeline_30d: List[Dict[str, Any]]
    opportunities: List[SupplierOpportunityItem]


class StorefrontProfileUpdate(BaseModel):
    description: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    years_in_business: Optional[int] = None
    capacity_per_month: Optional[str] = None
    export_countries: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    factory_details: Optional[Dict[str, Any]] = None


class StorefrontProfileResponse(BaseModel):
    id: str
    company_id: str
    company_name: str
    description: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    city: str
    state: Optional[str] = None
    country: str
    years_in_business: int
    verified_status: str
    capacity_per_month: str
    export_countries: List[str] = []
    languages: List[str] = []
    factory_details: Optional[Dict[str, Any]] = None
    completeness_score: int
    completeness_tips: List[str] = []


class PriceTierCreate(BaseModel):
    min_qty: int = Field(..., gt=0)
    max_qty: Optional[int] = None
    unit_price: float = Field(..., ge=0.0)
    currency: str = "USD"


class SupplierProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    category_id: str
    description: Optional[str] = None
    hs_code: Optional[str] = None
    moq: int = Field(..., gt=0)
    unit: str = "kg"
    origin_country: str = "India"
    lead_time_days: int = 14
    price_tiers: List[PriceTierCreate] = []
    is_active: bool = True
    specifications: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    stock_available: Optional[int] = 1000
    next_available_date: Optional[str] = None


class SupplierProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    hs_code: Optional[str] = None
    moq: Optional[int] = None
    unit: Optional[str] = None
    origin_country: Optional[str] = None
    lead_time_days: Optional[int] = None
    price_tiers: Optional[List[PriceTierCreate]] = None
    is_active: Optional[bool] = None
    specifications: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    stock_available: Optional[int] = None
    next_available_date: Optional[str] = None


class BulkStatusUpdateRequest(BaseModel):
    product_ids: List[str]
    is_active: bool


class CsvImportRowError(BaseModel):
    row: int
    error: str
    data: Optional[Dict[str, Any]] = None


class CsvImportResult(BaseModel):
    total_rows: int
    successful_rows: int
    errors: List[CsvImportRowError]


class CapacityInventoryItem(BaseModel):
    product_id: str
    product_name: str
    unit: str
    moq: int
    monthly_capacity: str
    stock_available: int
    next_available_date: Optional[str] = None
    lead_time_days: int


class CapacityInventoryUpdate(BaseModel):
    stock_available: int = Field(..., ge=0)
    next_available_date: Optional[str] = None
    lead_time_days: Optional[int] = None


class SupplierCertCreate(BaseModel):
    certification_name: str
    code: Optional[str] = None
    certificate_no: str
    issued_at: Optional[str] = None
    expires_at: Optional[str] = None


class SupplierInquiryItem(BaseModel):
    id: str
    sender_name: str
    sender_company: str
    sender_country: str
    subject: str
    message: str
    rfq_number: Optional[str] = None
    created_at: str
    is_read: bool = False
    replied: bool = False
