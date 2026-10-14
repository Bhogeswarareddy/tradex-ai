from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    min_qty: int = Field(..., gt=0, description="Minimum order quantity for tier")
    max_qty: Optional[int] = Field(None, description="Maximum order quantity for tier, or null for unbounded")
    unit_price: float = Field(..., ge=0.0, description="Unit price for this tier (non-negative)")
    currency: str = "USD"

    @field_validator("unit_price")
    @classmethod
    def validate_price_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Unit price cannot be negative")
        return v


def validate_price_tiers_no_overlap(tiers: List[PriceTierCreate]) -> List[PriceTierCreate]:
    if not tiers:
        return tiers
    for t in tiers:
        if t.unit_price < 0:
            raise ValueError("Unit price cannot be negative")
        if t.max_qty is not None and t.max_qty < t.min_qty:
            raise ValueError(f"Max quantity ({t.max_qty}) cannot be less than min quantity ({t.min_qty})")

    sorted_tiers = sorted(tiers, key=lambda x: x.min_qty)
    for i in range(len(sorted_tiers) - 1):
        curr = sorted_tiers[i]
        nxt = sorted_tiers[i + 1]
        if curr.min_qty == nxt.min_qty:
            raise ValueError(f"Duplicate min quantity in price tiers: {curr.min_qty}")
        if curr.max_qty is None:
            curr.max_qty = nxt.min_qty - 1
        elif nxt.min_qty <= curr.max_qty:
            raise ValueError(
                f"Overlapping price tiers detected: {curr.min_qty}-{curr.max_qty} overlaps with {nxt.min_qty}-{nxt.max_qty}"
            )
    return tiers


class SupplierProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    description: Optional[str] = None
    product_form: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    technical_specifications: Optional[Dict[str, Any]] = None
    origin_country: str = "India"
    production_region: Optional[str] = None
    hs_code: Optional[str] = None
    moq: int = Field(..., gt=0)
    unit: str = "kg"
    currency: str = "USD"
    price_tiers: List[PriceTierCreate] = []
    price_valid_from: Optional[str] = None
    price_valid_until: Optional[str] = None
    available_quantity: Optional[int] = 0
    reserved_quantity: Optional[int] = 0
    stock_available: Optional[int] = 1000
    availability_status: str = "in_stock"
    monthly_capacity: Optional[str] = None
    lead_time_days: int = 14
    packaging: Optional[str] = None
    storage: Optional[str] = None
    export_details: Optional[str] = None
    supported_destinations: Optional[List[str]] = []
    incoterms: Optional[List[str]] = []
    payment_terms: Optional[List[str]] = []
    images: Optional[List[str]] = []
    supporting_documents: Optional[List[Dict[str, Any]]] = []
    certifications_json: Optional[List[Dict[str, Any]]] = []
    is_active: bool = True
    next_available_date: Optional[str] = None
    submit_for_review: bool = False

    @field_validator("price_tiers")
    @classmethod
    def check_tiers(cls, v: List[PriceTierCreate]) -> List[PriceTierCreate]:
        return validate_price_tiers_no_overlap(v)


class SupplierProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    product_form: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    technical_specifications: Optional[Dict[str, Any]] = None
    origin_country: Optional[str] = None
    production_region: Optional[str] = None
    hs_code: Optional[str] = None
    moq: Optional[int] = None
    unit: Optional[str] = None
    currency: Optional[str] = None
    price_tiers: Optional[List[PriceTierCreate]] = None
    price_valid_from: Optional[str] = None
    price_valid_until: Optional[str] = None
    available_quantity: Optional[int] = None
    reserved_quantity: Optional[int] = None
    stock_available: Optional[int] = None
    availability_status: Optional[str] = None
    monthly_capacity: Optional[str] = None
    lead_time_days: Optional[int] = None
    packaging: Optional[str] = None
    storage: Optional[str] = None
    export_details: Optional[str] = None
    supported_destinations: Optional[List[str]] = None
    incoterms: Optional[List[str]] = None
    payment_terms: Optional[List[str]] = None
    images: Optional[List[str]] = None
    supporting_documents: Optional[List[Dict[str, Any]]] = None
    certifications_json: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None
    next_available_date: Optional[str] = None

    @field_validator("price_tiers")
    @classmethod
    def check_tiers(cls, v: Optional[List[PriceTierCreate]]) -> Optional[List[PriceTierCreate]]:
        if v is not None:
            return validate_price_tiers_no_overlap(v)
        return v


class PriceTiersUpdateRequest(BaseModel):
    price_tiers: List[PriceTierCreate]

    @field_validator("price_tiers")
    @classmethod
    def check_tiers(cls, v: List[PriceTierCreate]) -> List[PriceTierCreate]:
        return validate_price_tiers_no_overlap(v)


class InventoryUpdateRequest(BaseModel):
    available_quantity: int = Field(..., ge=0)
    reserved_quantity: Optional[int] = 0
    availability_status: str = Field(default="in_stock", description="in_stock, limited, made_to_order, out_of_stock")
    monthly_capacity: Optional[str] = None
    lead_time_days: Optional[int] = None
    stock_available: Optional[int] = None
    next_available_date: Optional[str] = None


class AddDocumentRequest(BaseModel):
    title: str
    doc_type: str = "specification"
    file_url: str
    file_size_bytes: Optional[int] = None
    file_name: Optional[str] = None


class AddCertificationRequest(BaseModel):
    name: str
    code: Optional[str] = None
    certificate_no: str
    issued_at: Optional[str] = None
    expires_at: Optional[str] = None
    document_url: Optional[str] = None
    status: str = "pending"


class AdminProductRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Audited rejection reason")
    admin_notes: Optional[str] = None


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
