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

export interface BuyerSpendMonth {
  month: string;
  spend: number;
  orders_count: number;
}

export interface BuyerSpendResponse {
  buyer_id: string;
  total_spend_eur: number;
  spend_by_month: BuyerSpendMonth[];
}

export interface SupplierPerformanceResponse {
  supplier_id: string;
  orders_fulfilled: number;
  on_time_delivery_rate: number;
  quality_compliance_rate: number;
  average_rfq_quote_speed_hours: number;
  overall_supplier_rating: number;
}

export interface RfqTrendItem {
  month: string;
  rfqs_created: number;
  volume_demanded: number;
}

export interface RfqTrendsResponse {
  report: string;
  trends: RfqTrendItem[];
}

export interface PlatformSupplierActivityResponse {
  report: string;
  total_active_suppliers: number;
  total_orders_serviced: number;
  avg_response_time_hours: number;
  on_time_shipment_rate: number;
  label: string;
}

export interface TradeVolumeItem {
  month: string;
  trade_value_eur: number;
  order_count: number;
}

export interface TradeVolumeResponse {
  report: string;
  volume_series: TradeVolumeItem[];
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

  getBuyerSpend: async (params?: AnalyticsFilterParams): Promise<BuyerSpendResponse> => {
    return api.get<BuyerSpendResponse>("/analytics/buyer/spend", params as Record<string, unknown>);
  },

  getSupplierPerformance: async (): Promise<SupplierPerformanceResponse> => {
    return api.get<SupplierPerformanceResponse>("/analytics/supplier/performance");
  },

  getPlatformRfqTrends: async (params?: AnalyticsFilterParams): Promise<RfqTrendsResponse> => {
    return api.get<RfqTrendsResponse>("/analytics/platform/rfq-trends", params as Record<string, unknown>);
  },

  getPlatformSupplierActivity: async (): Promise<PlatformSupplierActivityResponse> => {
    return api.get<PlatformSupplierActivityResponse>("/analytics/platform/supplier-activity");
  },

  getPlatformTradeVolume: async (params?: AnalyticsFilterParams): Promise<TradeVolumeResponse> => {
    return api.get<TradeVolumeResponse>("/analytics/platform/trade-volume", params as Record<string, unknown>);
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
