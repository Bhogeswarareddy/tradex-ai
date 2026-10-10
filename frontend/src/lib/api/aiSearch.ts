const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ExtractedRequirement {
  product: string;
  category?: string;
  quantity?: number;
  unit?: string;
  origin_country?: string;
  destination_country?: string;
  destination_port?: string;
  certifications: string[];
  max_budget?: number;
  currency: string;
  moq?: number;
  delivery_days?: number;
  incoterm?: string;
  other_constraints: string[];
  confidence: Record<string, number>;
}

export interface AiMatchedSupplier {
  id: string;
  company_id: string;
  name: string;
  logo_url?: string;
  banner_url?: string;
  country: string;
  city: string;
  verified_status: string;
  trust_score: number;
  on_time_rate: number;
  rating: number;
  total_reviews: number;
  capacity_per_month: string;
  match_score: number;
  match_reasons: string[];
}

export interface AiMatchedProduct {
  id: string;
  name: string;
  slug: string;
  category_name: string;
  hs_code?: string;
  origin_country: string;
  moq: number;
  unit: string;
  price_min: number;
  price_max: number;
  currency: string;
  image_url?: string;
  lead_time_days: number;
  supplier_id: string;
  supplier_name: string;
  supplier_country: string;
  stock_available: number;
}

export interface AiSearchResponse {
  query: string;
  requirement: ExtractedRequirement;
  missing_fields: string[];
  clarifying_questions: string[];
  filters: Record<string, any>;
  products: AiMatchedProduct[];
  suppliers: AiMatchedSupplier[];
  relaxation_suggestions: string[];
  execution_time_ms: number;
  is_mock: boolean;
}

export interface AiSearchHistoryItem {
  id: string;
  query: string;
  requirement?: ExtractedRequirement;
  filters?: Record<string, any>;
  results_count: number;
  execution_time_ms: number;
  created_at: string;
}

export const aiSearchApi = {
  async search(query: string): Promise<AiSearchResponse> {
    const res = await fetch(`${BASE_URL}/ai/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `AI Search failed with status ${res.status}`);
    }
    return res.json();
  },

  async getHistory(): Promise<AiSearchHistoryItem[]> {
    const res = await fetch(`${BASE_URL}/ai/search/history`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed to load search history");
    return res.json();
  },
};
