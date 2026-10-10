const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface MatchingWeights {
  product_relevance: number;
  certifications: number;
  moq_fit: number;
  capacity: number;
  delivery: number;
  price: number;
  reliability: number;
}

export interface ScoreBreakdown {
  product_relevance: number;
  certifications: number;
  moq_fit: number;
  capacity: number;
  delivery: number;
  price: number;
  reliability: number;
}

export interface RankedSupplier {
  id: string;
  company_id: string;
  name: string;
  country: string;
  city: string;
  logo_url?: string;
  banner_url?: string;
  verified_status: string;
  trust_score: number;
  on_time_rate: number;
  rating: number;
  total_reviews: number;
  capacity_per_month: string;
  min_moq: number;
  lead_time_days: number;
  years_in_business: number;
  export_countries: string[];
  certifications: string[];
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  risks: string[];
  rank: number;
  explanation?: string;
}

export interface MatchingRankResponse {
  requirement: Record<string, any>;
  weights_used: MatchingWeights;
  total_suppliers_ranked: number;
  results: RankedSupplier[];
}

export const matchingApi = {
  async getWeights(): Promise<{ weights: MatchingWeights }> {
    const res = await fetch(`${BASE_URL}/matching/weights`);
    if (!res.ok) throw new Error("Failed to load matching weights");
    return res.json();
  },

  async updateWeights(weights: MatchingWeights): Promise<{ status: string; weights: MatchingWeights }> {
    const res = await fetch(`${BASE_URL}/admin/matching/weights`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ weights }),
    });
    if (!res.ok) throw new Error("Failed to update weights (Admin permission required)");
    return res.json();
  },

  async rankSuppliers(requirement: Record<string, any>): Promise<MatchingRankResponse> {
    const res = await fetch(`${BASE_URL}/matching/rank`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(requirement),
    });
    if (!res.ok) throw new Error("Failed to rank suppliers");
    return res.json();
  },
};
