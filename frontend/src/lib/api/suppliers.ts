const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface SupplierCertificationItem {
  id?: string;
  name: string;
  code: string;
  certificate_no: string;
  issuing_body?: string;
  issued_at?: string;
  expires_at?: string;
  is_valid: boolean;
  days_to_expiry?: number;
  expiry_warning?: boolean;
}

export interface SupplierProductSummaryItem {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  category_name: string;
  moq: number;
  unit: string;
  price_min: number;
  price_max: number;
  currency: string;
  is_active: boolean;
}

export interface SupplierListItem {
  id: string;
  company_id: string;
  name: string;
  logo_url?: string;
  banner_url?: string;
  description?: string;
  country: string;
  state?: string;
  city: string;
  years_in_business: number;
  verified_status: string;
  trust_score: number;
  on_time_rate: number;
  capacity_per_month: string;
  response_time_hours: number;
  rating: number;
  total_reviews: number;
  export_countries: string[];
  min_moq: number;
  main_products: string[];
  certifications: string[];
  is_saved: boolean;
}

export interface PaginatedSuppliersResponse {
  items: SupplierListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FactoryDetails {
  facility_size?: string;
  annual_capacity?: string;
  production_lines?: number;
  cleanrooms?: string;
  warehouse_capacity?: string;
  testing_lab?: string;
  photos: string[];
}

export interface SupplierProfileResponse {
  id: string;
  company_id: string;
  name: string;
  tag: string;
  one_line_description: string;
  about_company: string;
  country: string;
  state?: string;
  city: string;
  location_display: string;
  years_in_business: number;
  verified_status: string;
  logo_url?: string;
  banner_url?: string;
  website?: string;
  languages: string[];
  on_time_rate: number;
  total_buyers_count: number;
  capacity_per_month: string;
  trust_score: number;
  rating: number;
  total_reviews: number;
  response_time_hours: number;
  repeat_buyer_rate: number;
  export_countries: string[];
  certifications: SupplierCertificationItem[];
  factory_details: FactoryDetails;
  is_saved: boolean;
}

export interface SupplierReviewItem {
  id: string;
  rating: number;
  title: string;
  comment?: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  created_at: string;
}

export interface MonthlyTrendItem {
  month: string;
  on_time_rate: number;
  orders_count: number;
}

export interface SupplierPerformanceResponse {
  on_time_rate: number;
  response_time_hours: number;
  repeat_buyer_rate: number;
  total_orders: number;
  monthly_trend: MonthlyTrendItem[];
}

export interface SupplierFilterParams {
  q?: string;
  country?: string;
  product_category?: string;
  certifications?: string[];
  min_capacity?: number;
  min_rating?: number;
  max_moq?: number;
  min_years?: number;
  verified_only?: boolean;
  min_on_time?: number;
  export_country?: string;
  sort?: "trust" | "rating" | "capacity" | "response_time";
  page?: number;
  page_size?: number;
}

export const suppliersApi = {
  async list(params: SupplierFilterParams = {}): Promise<PaginatedSuppliersResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.country) qs.set("country", params.country);
    if (params.product_category) qs.set("product_category", params.product_category);
    if (params.certifications && params.certifications.length > 0) {
      params.certifications.forEach((c) => qs.append("certifications", c));
    }
    if (params.min_capacity !== undefined) qs.set("min_capacity", String(params.min_capacity));
    if (params.min_rating !== undefined) qs.set("min_rating", String(params.min_rating));
    if (params.max_moq !== undefined) qs.set("max_moq", String(params.max_moq));
    if (params.min_years !== undefined) qs.set("min_years", String(params.min_years));
    if (params.verified_only) qs.set("verified_only", "true");
    if (params.min_on_time !== undefined) qs.set("min_on_time", String(params.min_on_time));
    if (params.export_country) qs.set("export_country", params.export_country);
    if (params.sort) qs.set("sort", params.sort);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));

    const res = await fetch(`${BASE_URL}/suppliers?${qs.toString()}`);
    if (!res.ok) throw new Error(`Failed to load suppliers: ${res.statusText}`);
    return res.json();
  },

  async getById(id: string): Promise<SupplierProfileResponse> {
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Supplier not found: ${res.statusText}`);
    return res.json();
  },

  async getProducts(id: string): Promise<SupplierProductSummaryItem[]> {
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/products`);
    if (!res.ok) throw new Error(`Failed to load products: ${res.statusText}`);
    return res.json();
  },

  async getReviews(id: string): Promise<SupplierReviewItem[]> {
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/reviews`);
    if (!res.ok) throw new Error(`Failed to load reviews: ${res.statusText}`);
    return res.json();
  },

  async getCertifications(id: string): Promise<SupplierCertificationItem[]> {
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/certifications`);
    if (!res.ok) throw new Error(`Failed to load certifications: ${res.statusText}`);
    return res.json();
  },

  async getPerformance(id: string): Promise<SupplierPerformanceResponse> {
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/performance`);
    if (!res.ok) throw new Error(`Failed to load performance metrics: ${res.statusText}`);
    return res.json();
  },

  async postReview(
    id: string,
    payload: { rating: number; title: string; comment?: string }
  ): Promise<{ id: string; message: string; review: SupplierReviewItem }> {
    const token = localStorage.getItem("tradex_access_token");
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || `Failed to submit review: ${res.statusText}`);
    }
    return res.json();
  },

  async toggleSave(id: string): Promise<{ saved: boolean; message: string }> {
    const token = localStorage.getItem("tradex_access_token");
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/save`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to save supplier: ${res.statusText}`);
    return res.json();
  },

  async sendInquiry(
    id: string,
    payload: {
      subject: string;
      message: string;
      quantity?: number;
      destination_port?: string;
      incoterm?: string;
      product_id?: string;
    }
  ): Promise<{ status: string; thread_id: string; message_id: string; message: string }> {
    const token = localStorage.getItem("tradex_access_token");
    const res = await fetch(`${BASE_URL}/suppliers/${encodeURIComponent(id)}/inquire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || `Failed to submit inquiry: ${res.statusText}`);
    }
    return res.json();
  },
};
