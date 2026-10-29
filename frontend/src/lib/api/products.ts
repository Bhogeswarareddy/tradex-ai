const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface PriceTierItem {
  min_qty: number;
  max_qty?: number;
  unit_price: number;
  currency: string;
}

export interface SupplierSummary {
  id: string;
  company_id: string;
  name: string;
  logo_url?: string;
  country: string;
  city?: string;
  trust_score: number;
  years_in_business: number;
  on_time_rate: number;
  response_time_hours: number;
  verified_status: string;
  rating: number;
  total_reviews: number;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_name: string;
  category_slug: string;
  hs_code?: string;
  moq: number;
  unit: string;
  origin_country: string;
  lead_time_days: number;
  price_min: number;
  price_max: number;
  currency: string;
  image_url?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_verified: boolean;
  supplier_country: string;
  supplier_rating: number;
  certifications: string[];
  is_saved: boolean;
}

export interface PaginatedProductsResponse {
  items: ProductItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProductDetailResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_name: string;
  category_slug: string;
  hs_code?: string;
  moq: number;
  unit: string;
  origin_country: string;
  lead_time_days: number;
  price_tiers: PriceTierItem[];
  images: string[];
  supplier: SupplierSummary;
  certifications: string[];
  reviews_summary: {
    average_rating: number;
    total_reviews: number;
  };
  ai_summary: {
    key_points: string[];
    caution: string;
  };
  specifications?: Record<string, string>;
  packaging?: string;
  incoterms?: string[];
  related_products: ProductItem[];
  is_saved: boolean;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  product_count: number;
  children: CategoryNode[];
}

export interface CompareAttributeRow {
  attribute: string;
  values: Record<string, string>;
}

export interface CompareProductsResponse {
  products: ProductItem[];
  matrix: CompareAttributeRow[];
}

export interface ProductFilterParams {
  q?: string;
  hs_code?: string;
  category?: string;
  country?: string;
  certifications?: string[];
  min_moq?: number;
  max_moq?: number;
  min_price?: number;
  max_price?: number;
  max_lead_time?: number;
  verified_only?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating" | "moq" | "lead_time";
  page?: number;
  page_size?: number;
}

export const productsApi = {
  async list(params: ProductFilterParams = {}): Promise<PaginatedProductsResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.hs_code) qs.set("hs_code", params.hs_code);
    if (params.category) qs.set("category", params.category);
    if (params.country) qs.set("country", params.country);
    if (params.certifications && params.certifications.length > 0) {
      params.certifications.forEach((c) => qs.append("certifications", c));
    }
    if (params.min_moq !== undefined) qs.set("min_moq", String(params.min_moq));
    if (params.max_moq !== undefined) qs.set("max_moq", String(params.max_moq));
    if (params.min_price !== undefined) qs.set("min_price", String(params.min_price));
    if (params.max_price !== undefined) qs.set("max_price", String(params.max_price));
    if (params.max_lead_time !== undefined) qs.set("max_lead_time", String(params.max_lead_time));
    if (params.verified_only) qs.set("verified_only", "true");
    if (params.sort) qs.set("sort", params.sort);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));

    const res = await fetch(`${BASE_URL}/products?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to load products: ${res.statusText}`);
    return res.json();
  },

  async getBySlug(slug: string): Promise<ProductDetailResponse> {
    const res = await fetch(`${BASE_URL}/products/${encodeURIComponent(slug)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Product not found: ${res.statusText}`);
    return res.json();
  },

  async getCategories(): Promise<CategoryNode[]> {
    const res = await fetch(`${BASE_URL}/categories`);
    if (!res.ok) throw new Error(`Failed to load categories: ${res.statusText}`);
    return res.json();
  },

  async compare(productIds: string[]): Promise<CompareProductsResponse> {
    const res = await fetch(`${BASE_URL}/products/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_ids: productIds }),
    });
    if (!res.ok) throw new Error(`Failed to compare products: ${res.statusText}`);
    return res.json();
  },

  getCompareCsvUrl(productIds: string[]): string {
    const qs = new URLSearchParams();
    productIds.forEach((id) => qs.append("product_ids", id));
    return `${BASE_URL}/products/compare/csv?${qs.toString()}`;
  },

  async toggleSaveProduct(productId: string, currentlySaved: boolean): Promise<boolean> {
    const method = currentlySaved ? "DELETE" : "POST";
    const res = await fetch(`${BASE_URL}/saved/products/${productId}`, {
      method,
      credentials: "include",
    });
    return res.ok ? !currentlySaved : currentlySaved;
  },

  async getSavedProducts(): Promise<ProductItem[]> {
    const res = await fetch(`${BASE_URL}/saved/products`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to load saved products: ${res.statusText}`);
    return res.json();
  },

  async getSavedSuppliers(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/saved/suppliers`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to load saved suppliers: ${res.statusText}`);
    return res.json();
  },

  async getAllSaved(): Promise<{ products: ProductItem[]; suppliers: any[]; searches: any[]; counts: Record<string, number> }> {
    const res = await fetch(`${BASE_URL}/saved`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to load saved items: ${res.statusText}`);
    return res.json();
  },

  async toggleSaveSupplier(supplierId: string, currentlySaved: boolean): Promise<boolean> {
    const method = currentlySaved ? "DELETE" : "POST";
    const res = await fetch(`${BASE_URL}/saved/suppliers/${supplierId}`, {
      method,
      credentials: "include",
    });
    return res.ok ? !currentlySaved : currentlySaved;
  },
};
