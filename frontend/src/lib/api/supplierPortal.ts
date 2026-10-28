const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response, defaultMessage: string): Promise<T> {
  if (!res.ok) {
    let errorMsg = defaultMessage;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        if (typeof errJson.detail === "string") {
          errorMsg = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorMsg = errJson.detail.map((d: any) => `${d.loc ? d.loc.slice(-1) + ': ' : ''}${d.msg}`).join("; ");
        }
      } else if (errJson.message) {
        errorMsg = errJson.message;
      }
    } catch {
      errorMsg = `${defaultMessage} (${res.status} ${res.statusText || ""})`.trim();
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export interface SupplierOpportunityItem {
  id: string;
  rfq_number: string;
  title: string;
  buyer_country: string;
  quantity: number;
  unit: string;
  target_price: number;
  currency: string;
  deadline: string;
  match_score: number;
}

export interface SupplierDashboardMetrics {
  profile_views: number;
  inquiries_count: number;
  quotes_sent: number;
  quote_win_rate: number;
  open_rfqs_matching: number;
  revenue_this_month: number;
  timeline_30d: Array<{ date: string; views: number; inquiries: number; quotes: number }>;
  opportunities: SupplierOpportunityItem[];
  products_count?: number;
  active_products_count?: number;
  published_products_count?: number;
  orders_count?: number;
  products_by_status?: Record<string, number>;
  low_stock_alerts?: Array<{ id: string; name: string; available_quantity: number; unit: string; availability_status?: string }>;
  stale_price_alerts?: Array<{ id: string; name: string; last_confirmed?: string }>;
  expiring_certificates?: Array<{ id: string; name: string; certificate_no?: string; expires_at: string; days_left: number }>;
}

export interface StorefrontProfile {
  id: string;
  company_id: string;
  company_name: string;
  about?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  city: string;
  state?: string;
  country: string;
  years_in_business: number;
  year_founded?: number;
  employees?: number;
  verified_status: string;
  capacity_per_month: string;
  export_countries: string[];
  export_markets?: string[];
  languages: string[];
  factory_photos?: string[];
  factory_details?: {
    facility_size?: string;
    annual_capacity?: string;
    production_lines?: number;
    cleanrooms?: string;
    warehouse_capacity?: string;
    testing_lab?: string;
    photos?: string[];
    employees?: number;
  };
  completeness_score: number;
  completeness_tips: string[];
  public_storefront_url?: string;
}

export interface PortalProductItem {
  id: string;
  name: string;
  slug: string;
  category_id?: string;
  category_name?: string;
  hs_code?: string;
  product_form?: string;
  origin_country?: string;
  production_region?: string;
  description?: string;
  moq: number;
  unit: string;
  price_min: number;
  price_max: number;
  currency: string;
  price_valid_from?: string;
  price_valid_until?: string;
  available_quantity?: number;
  reserved_quantity?: number;
  availability_status?: string;
  monthly_capacity?: string;
  lead_time_days: number;
  packaging?: string;
  storage?: string;
  export_details?: string;
  supported_destinations?: string[];
  incoterms?: string[];
  payment_terms?: string[];
  supporting_documents?: Array<{ name: string; url: string; doc_type?: string }>;
  certifications_json?: Array<{ certification_name: string; certificate_no?: string; issuer?: string; issued_at?: string; expires_at?: string; status?: string }>;
  status?: string;
  is_active: boolean;
  rejection_reason?: string;
  image_url?: string;
  images: string[];
  price_tiers: Array<{ id?: string; min_qty: number; max_qty?: number; unit_price: number; currency?: string }>;
  specifications: Record<string, any>;
  stock_available?: number;
  next_available_date?: string;
  price_status?: "current" | "unconfirmed" | "stale";
  availability_status_confirmed?: "current" | "unconfirmed" | "stale";
  price_confirmed_at?: string;
  inventory_confirmed_at?: string;
  price_badge?: string;
  availability_badge?: string;
  index_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CsvImportRowError {
  row: number;
  error: string;
  data?: Record<string, any>;
}

export interface CsvImportResult {
  total_rows: number;
  successful_rows: number;
  errors: CsvImportRowError[];
}

export interface CapacityInventoryItem {
  product_id: string;
  product_name: string;
  unit: string;
  moq: number;
  monthly_capacity?: string;
  available_quantity: number;
  reserved_quantity: number;
  stock_available: number;
  availability_status: string;
  next_available_date?: string;
  lead_time_days: number;
  price_confirmed_at?: string;
  confirmed_at?: string;
  updated_at?: string;
  is_stale?: boolean;
}

export interface SupplierInquiryMessage {
  id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
  is_mine: boolean;
}

export interface SupplierInquiryItem {
  id: string;
  buyer_id?: string;
  sender_name: string;
  sender_company: string;
  sender_country: string;
  subject: string;
  message: string;
  rfq_number?: string;
  created_at: string;
  is_read: boolean;
  replied: boolean;
  status?: string;
  messages_count?: number;
  messages?: SupplierInquiryMessage[];
}

export interface SupplierOrderResponse {
  id: string;
  order_number: string;
  buyer_id?: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  total_amount: number;
  currency: string;
  status: string;
  incoterm: string;
  created_at: string;
  shipping_address?: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
  }>;
}

export interface SupplierShipmentResponse {
  id: string;
  shipment_number: string;
  order_id: string;
  order_number: string;
  carrier: string;
  tracking_number: string;
  origin: string;
  destination: string;
  status: string;
  eta?: string;
  current_location: string;
  created_at: string;
}

export const supplierPortalApi = {
  async getMetrics(): Promise<SupplierDashboardMetrics> {
    const res = await fetch(`${BASE_URL}/supplier/dashboard/metrics`, {
      headers: getAuthHeader(),
    });
    return handleResponse<SupplierDashboardMetrics>(res, "Failed to load metrics");
  },

  async getProfile(): Promise<StorefrontProfile> {
    const res = await fetch(`${BASE_URL}/supplier/profile`, {
      headers: getAuthHeader(),
    });
    return handleResponse<StorefrontProfile>(res, "Failed to load profile");
  },

  async updateProfile(data: Partial<StorefrontProfile>): Promise<StorefrontProfile> {
    const res = await fetch(`${BASE_URL}/supplier/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<StorefrontProfile>(res, "Failed to update profile");
  },

  async getProducts(params: { q?: string; status?: string; page?: number; page_size?: number } = {}): Promise<{
    items: PortalProductItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));

    const res = await fetch(`${BASE_URL}/supplier/products?${qs.toString()}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to load products");
  },

  async createProduct(data: Record<string, any>): Promise<{ id: string; slug: string; message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to create product");
  },

  async getProduct(id: string): Promise<PortalProductItem> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to load product");
  },

  async patchProduct(id: string, data: Record<string, any>): Promise<{ message: string; product: PortalProductItem }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to patch product");
  },

  async confirmPrice(id: string): Promise<{ message: string; price_confirmed_at: string; price_badge: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/confirm-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    return handleResponse(res, "Failed to confirm product price");
  },

  async submitProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    return handleResponse(res, "Failed to submit product");
  },

  async publishProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    return handleResponse(res, "Failed to publish product");
  },

  async unpublishProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/unpublish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    return handleResponse(res, "Failed to unpublish product");
  },

  async archiveProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    return handleResponse(res, "Failed to archive product");
  },

  async updatePriceTiers(id: string, priceTiers: Array<{ min_qty: number; max_qty?: number; unit_price: number; currency?: string }>): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/price-tiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ price_tiers: priceTiers }),
    });
    return handleResponse(res, "Failed to update price tiers");
  },

  async updateInventory(id: string, data: { available_quantity?: number; reserved_quantity?: number; availability_status?: string; monthly_capacity?: string; lead_time_days?: number }): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to update inventory");
  },

  async uploadProductImage(id: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/images`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res, "Failed to upload product image");
  },

  async uploadProductDocument(id: string, file: File, documentType?: string): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    if (documentType) formData.append("document_type", documentType);
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/documents`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res, "Failed to upload product document");
  },

  async addProductCertification(id: string, data: { certification_name: string; certificate_no?: string; issuer?: string; issued_at?: string; expires_at?: string }): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to add product certification");
  },

  async updateProduct(id: string, data: Record<string, any>): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to update product");
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to delete product");
  },

  async bulkUpdateStatus(productIds: string[], isActive: boolean): Promise<{ updated_count: number }> {
    const res = await fetch(`${BASE_URL}/supplier/products/bulk-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ product_ids: productIds, is_active: isActive }),
    });
    return handleResponse(res, "Bulk update failed");
  },

  async getCapacity(): Promise<CapacityInventoryItem[]> {
    const res = await fetch(`${BASE_URL}/supplier/capacity`, {
      headers: getAuthHeader(),
    });
    return handleResponse<CapacityInventoryItem[]>(res, "Failed to load capacity");
  },

  async updateCapacity(productId: string, data: Partial<CapacityInventoryItem>): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/capacity/${encodeURIComponent(productId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to update capacity");
  },

  async bulkUpdateCapacityCsv(file: File): Promise<{ message: string; updated_count: number; errors: string[] }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/supplier/capacity/bulk-csv`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res, "Failed to bulk update capacity via CSV");
  },

  async getCertifications(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/supplier/certifications`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to load certifications");
  },

  async uploadCertification(data: { certification_name: string; certificate_no: string; issued_at?: string; expires_at?: string }): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to upload certification");
  },

  async linkCertificationToProducts(certId: string, productIds: string[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/certifications/${encodeURIComponent(certId)}/link-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ product_ids: productIds }),
    });
    return handleResponse(res, "Failed to link certification to products");
  },

  async deleteCertification(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/certifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to delete certification");
  },

  async getInquiries(): Promise<SupplierInquiryItem[]> {
    const res = await fetch(`${BASE_URL}/supplier/inquiries`, {
      headers: getAuthHeader(),
    });
    return handleResponse<SupplierInquiryItem[]>(res, "Failed to load inquiries");
  },

  async replyInquiry(id: string, message: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/inquiries/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message }),
    });
    return handleResponse(res, "Failed to dispatch reply");
  },

  async resolveInquiry(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/inquiries/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({}),
    });
    return handleResponse(res, "Failed to resolve inquiry");
  },

  async getRfqs(page: number = 1, pageSize: number = 20): Promise<{ items: any[]; total: number; page: number; page_size: number }> {
    const res = await fetch(`${BASE_URL}/supplier/rfqs?page=${page}&page_size=${pageSize}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to load RFQ opportunities");
  },

  async submitQuote(rfqId: string, data: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/rfqs/${encodeURIComponent(rfqId)}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res, "Failed to submit quote");
  },

  async getOrders(): Promise<SupplierOrderResponse[]> {
    const res = await fetch(`${BASE_URL}/supplier/orders`, {
      headers: getAuthHeader(),
    });
    return handleResponse<SupplierOrderResponse[]>(res, "Failed to load supplier orders");
  },

  async updateOrderStatus(orderId: string, newStatus: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/orders/${encodeURIComponent(orderId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status: newStatus }),
    });
    return handleResponse(res, "Failed to update order status");
  },

  async getShipments(): Promise<SupplierShipmentResponse[]> {
    const res = await fetch(`${BASE_URL}/supplier/shipments`, {
      headers: getAuthHeader(),
    });
    return handleResponse<SupplierShipmentResponse[]>(res, "Failed to load supplier shipments");
  },

  async getAnalytics(): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/analytics`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res, "Failed to load supplier analytics");
  },

  async importCsv(file: File): Promise<CsvImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/supplier/products/import-csv`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res, "CSV import failed");
  },

  async downloadCsvTemplate(): Promise<string> {
    const res = await fetch(`${BASE_URL}/supplier/products/csv-template`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to download template: ${res.statusText}`);
    return res.text();
  },
};
