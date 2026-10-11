import { api } from "./client";

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
    return api.get<TopProductItem[]>("/analytics/market/top-products", params as Record<string, unknown>);
  },

  getRisingDemand: async (params?: AnalyticsFilterParams): Promise<RisingDemandItem[]> => {
    return api.get<RisingDemandItem[]>("/analytics/market/rising-demand", params as Record<string, unknown>);
  },

  getPriceTrends: async (params?: AnalyticsFilterParams): Promise<PriceTrendsResponse> => {
    return api.get<PriceTrendsResponse>("/analytics/market/price-trends", params as Record<string, unknown>);
  },

  getDestinationDemand: async (params?: AnalyticsFilterParams): Promise<DestinationDemandItem[]> => {
    return api.get<DestinationDemandItem[]>("/analytics/market/destination-demand", params as Record<string, unknown>);
  },

  getInsights: async (params?: AnalyticsFilterParams): Promise<InsightsResponse> => {
    return api.post<InsightsResponse>("/analytics/insights", {
      from_date: params?.from || null,
      to_date: params?.to || null,
      product: params?.product || null,
      category: params?.category || null,
      country: params?.country || null,
    });
  },

  getBuyerSpend: async (params?: AnalyticsFilterParams) => {
    return api.get("/analytics/buyer/spend", params as Record<string, unknown>);
  },

  getSupplierPerformance: async () => {
    return api.get("/analytics/supplier/performance");
  },

  getPlatformRfqTrends: async (params?: AnalyticsFilterParams) => {
    return api.get("/analytics/platform/rfq-trends", params as Record<string, unknown>);
  },

  getPlatformSupplierActivity: async () => {
    return api.get("/analytics/platform/supplier-activity");
  },

  getPlatformTradeVolume: async (params?: AnalyticsFilterParams) => {
    return api.get("/analytics/platform/trade-volume", params as Record<string, unknown>);
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

