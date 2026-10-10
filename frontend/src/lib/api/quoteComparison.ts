const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface LandedCostBreakdownItem {
  name: string;
  amount_per_kg: number;
  total_amount: number;
  percentage_of_total: number;
}

export interface LandedCostBreakdown {
  currency: string;
  quantity: number;
  unit: string;
  unit_price: number;
  origin_port: string;
  destination_port: string;
  destination_country: string;
  incoterm: string;
  hs_code: string;
  product_cost_total: number;
  freight_total: number;
  insurance_total: number;
  duty_total: number;
  handling_total: number;
  inland_total: number;
  total_landed_cost: number;
  landed_cost_per_kg: number;
  breakdown: LandedCostBreakdownItem[];
  label: string;
}

export interface ComparisonQuote {
  id: string;
  quote_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_country: string;
  supplier_city: string;
  supplier_logo?: string;
  supplier_verified: boolean;
  trust_score: number;
  unit_price: number;
  currency: string;
  landed_cost: number;
  lead_time_days: number;
  payment_terms: string;
  valid_until?: string;
  status: string;
  is_shortlisted: boolean;
  is_accepted: boolean;
  is_cheapest: boolean;
  is_fastest: boolean;
  ai_score: number;
  notes?: string;
  landed_cost_breakdown?: LandedCostBreakdown;
}

export interface QuoteComparisonData {
  rfq_id: string;
  rfq_number: string;
  title: string;
  total_quotes: number;
  benchmark: {
    min_landed_cost: number;
    min_lead_time_days: number;
    min_unit_price: number;
    average_landed_cost: number;
    currency: string;
  };
  quotes: ComparisonQuote[];
}

export interface AIQuoteRecommendationOutput {
  winner_quote_id: string;
  winner_supplier_name: string;
  winner_landed_cost: number;
  why: string;
  trade_offs: string;
  risks: string[];
  negotiation_tip: string;
}

export interface AcceptQuoteResponse {
  status: string;
  order_id: string;
  order_number: string;
  accepted_quote_number: string;
  total_amount: number;
  currency: string;
  rfq_status: string;
}

export interface ShortlistQuoteResponse {
  quote_id: string;
  quote_number: string;
  status: string;
  is_shortlisted: boolean;
}

export const quoteComparisonApi = {
  async getComparison(
    rfqId: string,
    sortBy: "score" | "landed_cost" | "lead_time" | "unit_price" = "score"
  ): Promise<QuoteComparisonData> {
    const res = await fetch(`${BASE_URL}/rfqs/${rfqId}/comparison?sort_by=${sortBy}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch quote comparison");
    }
    return res.json();
  },

  async getAiRecommendation(rfqId: string): Promise<AIQuoteRecommendationOutput> {
    const res = await fetch(`${BASE_URL}/rfqs/${rfqId}/comparison/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to generate AI quote recommendation");
    }
    return res.json();
  },

  async acceptQuote(quoteId: string): Promise<AcceptQuoteResponse> {
    const res = await fetch(`${BASE_URL}/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to accept quotation");
    }
    return res.json();
  },

  async shortlistQuote(quoteId: string): Promise<ShortlistQuoteResponse> {
    const res = await fetch(`${BASE_URL}/quotes/${quoteId}/shortlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to shortlist quotation");
    }
    return res.json();
  },

  async exportComparison(rfqId: string, format: "csv" | "pdf" = "csv"): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/rfqs/${rfqId}/comparison/export?format=${format}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error("Failed to export quotation comparison");
    }
    return res.blob();
  },
};
