const getStorageItem = (key: string): string => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem(key) || "";
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage.getItem(key) || "";
  }
  return "";
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStorageItem("tradex_access_token")}`,
});

export interface TopProductItem {
  product: string;
  category: string;
  total_volume: number;
  avg_price: number;
  avg_demand: number;
  label: string;
}

export interface RisingDemandItem {
  product: string;
  category: string;
  growth_pct: number;
  current_demand: number;
  start_demand: number;
  label: string;
}

export interface PriceTrendPoint {
  date: string;
  avg_price: number;
  sma_3m?: number | null;
  volume: number;
  demand_index: number;
}

export interface PriceTrendsResponse {
  product: string;
  category?: string;
  points: PriceTrendPoint[];
  label: string;
}

export interface DestinationDemandItem {
  destination: string;
  total_volume: number;
  avg_demand: number;
  market_share_pct: number;
  label: string;
}

export interface InsightsResponse {
  insights: string[];
  summary: string;
  source: string;
}

export interface AnalyticsFilterParams {
  from?: string;
  to?: string;
  product?: string;
  category?: string;
  country?: string;
}

export const analyticsApi = {
  getTopProducts: async (params?: AnalyticsFilterParams): Promise<TopProductItem[]> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/market/top-products${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getRisingDemand: async (params?: AnalyticsFilterParams): Promise<RisingDemandItem[]> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/market/rising-demand${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getPriceTrends: async (params?: AnalyticsFilterParams): Promise<PriceTrendsResponse> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/market/price-trends${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getDestinationDemand: async (params?: AnalyticsFilterParams): Promise<DestinationDemandItem[]> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/market/destination-demand${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getInsights: async (params?: AnalyticsFilterParams): Promise<InsightsResponse> => {
    const r = await fetch("/api/v1/analytics/insights", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        from_date: params?.from || null,
        to_date: params?.to || null,
        product: params?.product || null,
        category: params?.category || null,
        country: params?.country || null,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getBuyerSpend: async (params?: AnalyticsFilterParams) => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/buyer/spend${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getSupplierPerformance: async () => {
    const r = await fetch("/api/v1/analytics/supplier/performance", {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getPlatformRfqTrends: async (params?: AnalyticsFilterParams) => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/platform/rfq-trends${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getPlatformSupplierActivity: async () => {
    const r = await fetch("/api/v1/analytics/platform/supplier-activity", {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getPlatformTradeVolume: async (params?: AnalyticsFilterParams) => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/analytics/platform/trade-volume${q ? `?${q}` : ""}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getExportUrl: (report = "market", format = "csv", params?: AnalyticsFilterParams) => {
    const q = new URLSearchParams({
      report,
      format,
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
      ...(params?.product ? { product: params.product } : {}),
      ...(params?.category ? { category: params.category } : {}),
      ...(params?.country ? { country: params.country } : {}),
    }).toString();
    return `/api/v1/analytics/export?${q}`;
  },
};
