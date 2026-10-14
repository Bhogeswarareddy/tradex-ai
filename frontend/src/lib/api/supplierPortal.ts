const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
}

export interface StorefrontProfile {
  id: string;
  company_id: string;
  company_name: string;
  description?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  city: string;
  state?: string;
  country: string;
  years_in_business: number;
  verified_status: string;
  capacity_per_month: string;
  export_countries: string[];
  languages: string[];
  factory_details?: {
    facility_size?: string;
    annual_capacity?: string;
    production_lines?: number;
    cleanrooms?: string;
    warehouse_capacity?: string;
    testing_lab?: string;
    photos?: string[];
  };
  completeness_score: number;
  completeness_tips: string[];
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
  monthly_capacity: string;
  stock_available: number;
  next_available_date?: string;
  lead_time_days: number;
}

export interface SupplierInquiryItem {
  id: string;
  sender_name: string;
  sender_company: string;
  sender_country: string;
  subject: string;
  message: string;
  rfq_number?: string;
  created_at: string;
  is_read: boolean;
  replied: boolean;
}

export const supplierPortalApi = {
  async getMetrics(): Promise<SupplierDashboardMetrics> {
    const res = await fetch(`${BASE_URL}/supplier/dashboard/metrics`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load metrics: ${res.statusText}`);
    return res.json();
  },

  async getProfile(): Promise<StorefrontProfile> {
    const res = await fetch(`${BASE_URL}/supplier/profile`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load profile: ${res.statusText}`);
    return res.json();
  },

  async updateProfile(data: Partial<StorefrontProfile>): Promise<StorefrontProfile> {
    const res = await fetch(`${BASE_URL}/supplier/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update profile: ${res.statusText}`);
    return res.json();
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
    if (!res.ok) throw new Error(`Failed to load products: ${res.statusText}`);
    return res.json();
  },

  async createProduct(data: Record<string, any>): Promise<{ id: string; slug: string; message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create product: ${res.statusText}`);
    return res.json();
  },

  async getProduct(id: string): Promise<PortalProductItem> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load product: ${res.statusText}`);
    return res.json();
  },

  async patchProduct(id: string, data: Record<string, any>): Promise<{ message: string; product: PortalProductItem }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to patch product: ${res.statusText}`);
    return res.json();
  },

  async submitProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to submit product: ${res.statusText}`);
    return res.json();
  },

  async publishProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to publish product: ${res.statusText}`);
    return res.json();
  },

  async unpublishProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/unpublish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to unpublish product: ${res.statusText}`);
    return res.json();
  },

  async archiveProduct(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to archive product: ${res.statusText}`);
    return res.json();
  },

  async updatePriceTiers(id: string, priceTiers: Array<{ min_qty: number; max_qty?: number; unit_price: number; currency?: string }>): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/price-tiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ price_tiers: priceTiers }),
    });
    if (!res.ok) throw new Error(`Failed to update price tiers: ${res.statusText}`);
    return res.json();
  },

  async updateInventory(id: string, data: { available_quantity?: number; reserved_quantity?: number; availability_status?: string; monthly_capacity?: string; lead_time_days?: number }): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update inventory: ${res.statusText}`);
    return res.json();
  },

  async uploadProductImage(id: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/images`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to upload product image: ${res.statusText}`);
    return res.json();
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
    if (!res.ok) throw new Error(`Failed to upload product document: ${res.statusText}`);
    return res.json();
  },

  async addProductCertification(id: string, data: { certification_name: string; certificate_no?: string; issuer?: string; issued_at?: string; expires_at?: string }): Promise<any> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to add product certification: ${res.statusText}`);
    return res.json();
  },

  async updateProduct(id: string, data: Record<string, any>): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update product: ${res.statusText}`);
    return res.json();
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/supplier/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to delete product: ${res.statusText}`);
    return res.json();
  },

  async bulkUpdateStatus(productIds: string[], isActive: boolean): Promise<{ updated_count: number }> {
    const res = await fetch(`${BASE_URL}/supplier/products/bulk-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ product_ids: productIds, is_active: isActive }),
    });
    if (!res.ok) throw new Error(`Bulk update failed: ${res.statusText}`);
    return res.json();
  },

  async getCapacity(): Promise<CapacityInventoryItem[]> {
    const res = await fetch(`${BASE_URL}/supplier/capacity`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load capacity: ${res.statusText}`);
    return res.json();
  },

  async updateCapacity(productId: string, data: { stock_available: number; next_available_date?: string; lead_time_days?: number }): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/capacity/${encodeURIComponent(productId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update capacity: ${res.statusText}`);
  },

  async getCertifications(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/supplier/certifications`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load certifications: ${res.statusText}`);
    return res.json();
  },

  async uploadCertification(data: { certification_name: string; certificate_no: string; issued_at?: string; expires_at?: string }): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/certifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to upload certification: ${res.statusText}`);
  },

  async deleteCertification(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/certifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to delete certification: ${res.statusText}`);
  },

  async getInquiries(): Promise<SupplierInquiryItem[]> {
    const res = await fetch(`${BASE_URL}/supplier/inquiries`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load inquiries: ${res.statusText}`);
    return res.json();
  },

  async replyInquiry(id: string, message: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/supplier/inquiries/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Failed to dispatch reply: ${res.statusText}`);
  },

  async importCsv(file: File): Promise<CsvImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/supplier/products/import-csv`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    if (!res.ok) throw new Error(`CSV import failed: ${res.statusText}`);
    return res.json();
  },

  async downloadCsvTemplate(): Promise<string> {
    const res = await fetch(`${BASE_URL}/supplier/products/csv-template`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Failed to download template: ${res.statusText}`);
    return res.text();
  },
};
