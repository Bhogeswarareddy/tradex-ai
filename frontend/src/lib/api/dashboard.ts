const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface HeroStats {
  verified_suppliers: number;
  global_buyers: number;
  active_shipments: number;
  countries_covered: number;
}

export interface KPICardData {
  title: string;
  value: string;
  delta_percentage: string;
  is_positive: boolean;
  subtext?: string;
}

export interface DashboardSummaryResponse {
  hero_stats: HeroStats;
  kpis: KPICardData[];
}

export interface RecommendedSupplierCard {
  id: string;
  name: string;
  logo_url?: string;
  cover_image_url?: string;
  country: string;
  city?: string;
  flag: string;
  years_in_business: number;
  is_verified: boolean;
  trust_score: number;
  rating: number;
  review_count: number;
  on_time_rate: number;
  capacity_per_month: string;
  moq: string;
  certifications: string[];
  is_saved: boolean;
}

export interface MarketInsightRow {
  id: string;
  name: string;
  category: string;
  trend_percentage: string;
  is_positive: boolean;
  sparkline: number[];
  thumbnail_url?: string;
}

export interface SuggestedPromptItem {
  id: string;
  prompt: string;
  category?: string;
}

export interface CopilotChatResponse {
  response: string;
  suggested_actions: string[];
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummaryResponse> {
    const res = await fetch(`${BASE_URL}/dashboard/summary`);
    if (!res.ok) throw new Error(`Failed to load summary: ${res.statusText}`);
    return res.json();
  },

  async getRecommendedSuppliers(tab: string = "top_match"): Promise<RecommendedSupplierCard[]> {
    const res = await fetch(`${BASE_URL}/dashboard/recommended-suppliers?tab=${encodeURIComponent(tab)}`);
    if (!res.ok) throw new Error(`Failed to load suppliers: ${res.statusText}`);
    return res.json();
  },

  async getMarketInsights(tab: string = "top_export"): Promise<MarketInsightRow[]> {
    const res = await fetch(`${BASE_URL}/dashboard/market-insights?tab=${encodeURIComponent(tab)}`);
    if (!res.ok) throw new Error(`Failed to load market insights: ${res.statusText}`);
    return res.json();
  },

  async getSuggestedPrompts(): Promise<SuggestedPromptItem[]> {
    const res = await fetch(`${BASE_URL}/ai/copilot/suggested-prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to load suggested prompts: ${res.statusText}`);
    return res.json();
  },

  async sendCopilotMessage(message: string): Promise<CopilotChatResponse> {
    const res = await fetch(`${BASE_URL}/ai/copilot/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
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
