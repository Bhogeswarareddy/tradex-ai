import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Globe,
  Download,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Package,
  Layers,
  Lock,
  AlertCircle,
  Inbox,
  FileText,
  CreditCard,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api/client";
import {
  analyticsApi,
  TopProductItem,
  RisingDemandItem,
  PriceTrendsResponse,
  DestinationDemandItem,
  InsightsResponse,
  RfqTrendsResponse,
  BuyerSpendResponse,
  PlatformSupplierActivityResponse,
  TradeVolumeResponse,
} from "../lib/api/analytics";

interface ChartStateWrapperProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  loading: boolean;
  error?: string | null;
  unauthorized?: boolean;
  empty?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}

const ChartStateWrapper: React.FC<ChartStateWrapperProps> = ({
  title,
  subtitle,
  icon,
  badge,
  loading,
  error,
  unauthorized,
  empty,
  onRetry,
  children,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>

      <div className="h-72 w-full flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-slate-400 animate-pulse">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading analytics data...</span>
          </div>
        ) : unauthorized ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Access Restricted
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              This metric requires specific organization or administrative role privileges.
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Failed to load chart
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 px-3 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
              <Inbox className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              No Data Available
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              No records found matching the selected filters and date range.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  // Preset filters: 7d, 30d, 90d, 12m, all
  const [datePreset, setDatePreset] = useState<string>("12m");
  const [selectedProduct, setSelectedProduct] = useState<string>("Organic Turmeric");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"market" | "platform">("market");

  // Market states
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [risingDemand, setRisingDemand] = useState<RisingDemandItem[]>([]);
  const [priceTrends, setPriceTrends] = useState<PriceTrendsResponse | null>(null);
  const [destDemand, setDestDemand] = useState<DestinationDemandItem[]>([]);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);

  // Platform states
  const [rfqTrends, setRfqTrends] = useState<RfqTrendsResponse | null>(null);
  const [buyerSpend, setBuyerSpend] = useState<BuyerSpendResponse | null>(null);
  const [supplierActivity, setSupplierActivity] = useState<PlatformSupplierActivityResponse | null>(null);
  const [platformTradeVolume, setPlatformTradeVolume] = useState<TradeVolumeResponse | null>(null);

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [regeneratingAi, setRegeneratingAi] = useState<boolean>(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Permissions tracking for role-scoping
  const [buyerSpendUnauthorized, setBuyerSpendUnauthorized] = useState<boolean>(false);
  const [platformUnauthorized, setPlatformUnauthorized] = useState<boolean>(false);

  // Compute dates based on preset
  const getDateRange = useCallback(() => {
    const today = new Date();
    const d = new Date();
    if (datePreset === "7d") {
      d.setDate(today.getDate() - 7);
    } else if (datePreset === "30d") {
      d.setDate(today.getDate() - 30);
    } else if (datePreset === "90d") {
      d.setDate(today.getDate() - 90);
    } else if (datePreset === "12m") {
      d.setFullYear(today.getFullYear() - 1);
    } else {
      return { from: undefined, to: undefined };
    }
    return {
      from: d.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  }, [datePreset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBuyerSpendUnauthorized(false);
    setPlatformUnauthorized(false);

    try {
      const { from, to } = getDateRange();
      const params = {
        from,
        to,
        product: selectedProduct || undefined,
        category: selectedCategory || undefined,
        country: selectedCountry || undefined,
      };

      // Market endpoints (all authenticated users)
      const [topRes, riseRes, priceRes, destRes] = await Promise.all([
        analyticsApi.getTopProducts(params).catch(() => []),
        analyticsApi.getRisingDemand(params).catch(() => []),
        analyticsApi.getPriceTrends(params).catch(() => null),
        analyticsApi.getDestinationDemand(params).catch(() => []),
      ]);

      setTopProducts(topRes);
      setRisingDemand(riseRes);
      setPriceTrends(priceRes);
      setDestDemand(destRes);

      // AI / Rule-based Insights
      analyticsApi
        .getInsights(params)
        .then((ins) => setInsights(ins))
        .catch(() => {});

      // Platform & Operations endpoints (graceful role fallbacks)
      analyticsApi
        .getBuyerSpend(params)
        .then((res) => setBuyerSpend(res))
        .catch((err) => {
          if (err?.status === 403 || err?.message?.includes("403")) {
            setBuyerSpendUnauthorized(true);
          }
        });

      analyticsApi
        .getPlatformRfqTrends(params)
        .then((res) => setRfqTrends(res))
        .catch((err) => {
          if (err?.status === 403 || err?.message?.includes("403")) {
            setPlatformUnauthorized(true);
          }
        });

      analyticsApi
        .getPlatformSupplierActivity()
        .then((res) => setSupplierActivity(res))
        .catch((err) => {
          if (err?.status === 403 || err?.message?.includes("403")) {
            setPlatformUnauthorized(true);
          }
        });

      analyticsApi
        .getPlatformTradeVolume(params)
        .then((res) => setPlatformTradeVolume(res))
        .catch((err) => {
          if (err?.status === 403 || err?.message?.includes("403")) {
            setPlatformUnauthorized(true);
          }
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading market intelligence data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedProduct, selectedCategory, selectedCountry]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegenerateInsights = async () => {
    setRegeneratingAi(true);
    try {
      const { from, to } = getDateRange();
      const ins = await analyticsApi.getInsights({
        from,
        to,
        product: selectedProduct || undefined,
        category: selectedCategory || undefined,
        country: selectedCountry || undefined,
      });
      setInsights(ins);
    } catch {
      // ignore
    } finally {
      setRegeneratingAi(false);
    }
  };

  const handleResetFilters = () => {
    setDatePreset("12m");
    setSelectedProduct("");
    setSelectedCategory("");
    setSelectedCountry("");
  };

  // Secure Authenticated Export Handler
  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const { from, to } = getDateRange();
      const exportUrl = analyticsApi.getExportUrl("market", format, {
        from,
        to,
        product: selectedProduct || undefined,
        category: selectedCategory || undefined,
        country: selectedCountry || undefined,
      });

      const token = api.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(exportUrl, { headers });
      if (!response.ok) {
        throw new Error(`Export request failed (${response.status} ${response.statusText})`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `market_analytics_${datePreset}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export download failed";
      alert(msg);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Market Intelligence & Analytics
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              Simulated market data
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            24-month commodity time-series, global shipping lane demand, spot price trends, and autonomous export forecasting.
          </p>
        </div>

        {/* Authenticated Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {exporting === "csv" ? "Generating CSV..." : "Export CSV"}
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting === "pdf" ? "Generating PDF..." : "Export PDF Report"}
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar with Validation & Reset */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date range presets */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <span className="text-xs font-medium text-slate-500 px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Range:
            </span>
            {["7d", "30d", "90d", "12m", "all"].map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  datePreset === preset
                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {preset.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Commodity & Lane Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Filter by Commodity"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Commodities</option>
                <option value="Organic Turmeric">Organic Turmeric</option>
                <option value="Basmati Rice">Basmati Rice</option>
                <option value="Cotton Fibre">Cotton Fibre</option>
                <option value="Precision Auto Components">Precision Auto Components</option>
                <option value="White Sesame Seeds">White Sesame Seeds</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                aria-label="Filter by Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Categories</option>
                <option value="Spices">Spices</option>
                <option value="Grains">Grains</option>
                <option value="Textiles">Textiles</option>
                <option value="Engineering">Engineering</option>
                <option value="Oilseeds">Oilseeds</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Filter by Destination"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Destinations</option>
                <option value="Germany">Germany</option>
                <option value="USA">USA</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="UAE">UAE</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="text-xs text-primary font-semibold hover:underline ml-2"
            >
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* 3. AI Market Insights Banner (Truth-Grounded or Rule-Based Fallback) */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                TradeX Market Intelligence Synthesis
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-300">
                  {insights?.source || "market_insight.v1"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ground-truth evaluation derived strictly from real time-series endpoints and database records.
              </p>
            </div>
          </div>
          <button
            onClick={handleRegenerateInsights}
            disabled={regeneratingAi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regeneratingAi ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        </div>

        {insights?.insights && insights.insights.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-indigo-100 dark:border-indigo-900/40 pt-3">
            {insights.insights.map((sentence, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5 flex-shrink-0" />
                <span>{sentence}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. Top Rising Demand Fast Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {risingDemand.slice(0, 5).map((item) => (
          <div
            key={item.product}
            onClick={() => setSelectedProduct(item.product)}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              selectedProduct === item.product
                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">{item.category}</span>
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                +{item.growth_pct}%
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </span>
            </div>
            <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white truncate">
              {item.product}
            </p>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Demand Index:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {item.current_demand}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 5. View Switcher Tabs: Market Intelligence vs Platform Operations */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("market")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "market"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Market Intelligence & Time-Series
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "platform"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Trade Operations & Performance
        </button>
      </div>

      {/* 6. Active Tab Content */}
      {activeTab === "market" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Price Trends & 3-Month Simple Moving Average */}
          <ChartStateWrapper
            title="Commodity Spot Price & 3M SMA Trend"
            subtitle="Historical monthly price per kg/unit with simple moving average (€)"
            icon={<TrendingUp className="w-4 h-4 text-primary" />}
            badge={priceTrends?.product || "Selected"}
            loading={loading}
            empty={!priceTrends || priceTrends.points.length === 0}
            onRetry={loadData}
          >
            {priceTrends && priceTrends.points.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceTrends.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => val.slice(2, 7)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="avg_price" name="Spot Price (€)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sma_3m" name="3M SMA (€)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Chart 2: Top Traded Products by Volume */}
          <ChartStateWrapper
            title="Top Export Commodities by Cumulative Volume"
            subtitle="Aggregated export tonnage across monitored shipping corridors (MT)"
            icon={<BarChart3 className="w-4 h-4 text-emerald-600" />}
            loading={loading}
            empty={topProducts.length === 0}
            onRetry={loadData}
          >
            {topProducts.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="product"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={110}
                    tickFormatter={(val) => (val.length > 15 ? `${val.slice(0, 15)}...` : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="total_volume" name="Volume (MT)" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Chart 3: Destination Demand Distribution */}
          <ChartStateWrapper
            title="Destination Port & Country Demand Share"
            subtitle="Export flow destination market share (%) and cumulative trade volume"
            icon={<Globe className="w-4 h-4 text-cyan-600" />}
            loading={loading}
            empty={destDemand.length === 0}
            onRetry={loadData}
          >
            {destDemand.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={destDemand} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="destination" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="market_share_pct" name="Market Share (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Chart 4: Monthly Trade Volume & Seasonality Flow */}
          <ChartStateWrapper
            title="Monthly Trade Volume Flow (MT)"
            subtitle="Seasonality and cyclical volume throughput across 24 consecutive months"
            icon={<Layers className="w-4 h-4 text-violet-600" />}
            badge="Seasonality Curve"
            loading={loading}
            empty={!priceTrends || priceTrends.points.length === 0}
            onRetry={loadData}
          >
            {priceTrends && priceTrends.points.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceTrends.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => val.slice(2, 7)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="volume" name="Volume (MT)" stroke="#8b5cf6" fillOpacity={1} fill="url(#volGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operations Chart 1: Platform RFQ Creation Trends */}
          <ChartStateWrapper
            title="RFQ Creation Trends & Inquiries"
            subtitle="Monthly buyer RFQs initiated on the platform with demanded quantities"
            icon={<FileText className="w-4 h-4 text-blue-600" />}
            loading={loading}
            unauthorized={platformUnauthorized}
            empty={!rfqTrends || rfqTrends.trends.length === 0}
            onRetry={loadData}
          >
            {rfqTrends && rfqTrends.trends.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rfqTrends.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="rfqs_created" name="RFQs Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Operations Chart 2: Buyer Spend Trends */}
          <ChartStateWrapper
            title="Buyer Spend History"
            subtitle="Monthly cumulative procurement expenditure and confirmed order volume (€)"
            icon={<CreditCard className="w-4 h-4 text-emerald-600" />}
            loading={loading}
            unauthorized={buyerSpendUnauthorized}
            empty={!buyerSpend || buyerSpend.spend_by_month.length === 0}
            onRetry={loadData}
          >
            {buyerSpend && buyerSpend.spend_by_month.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buyerSpend.spend_by_month} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="spend" name="Spend (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Operations Chart 3: Platform Trade Value */}
          <ChartStateWrapper
            title="Platform Trade Value & Completed Volume"
            subtitle="Gross contract transaction value executed through TradeX escrow contracts"
            icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
            loading={loading}
            unauthorized={platformUnauthorized}
            empty={!platformTradeVolume || platformTradeVolume.volume_series.length === 0}
            onRetry={loadData}
          >
            {platformTradeVolume && platformTradeVolume.volume_series.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={platformTradeVolume.volume_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="trade_value_eur" name="Trade Value (€)" stroke="#6366f1" fill="#c7d2fe" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartStateWrapper>

          {/* Operations Card 4: Supplier Network & Activity Highlights */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Supplier Network & Fulfillment Activity
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Platform supplier capacity, order fulfillment response speed, and on-time shipment rate.
                </p>
              </div>
            </div>

            {platformUnauthorized ? (
              <div className="h-72 flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Access Restricted
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Supplier network metrics require administrative privileges.
                </p>
              </div>
            ) : supplierActivity ? (
              <div className="h-72 grid grid-cols-2 gap-4 items-center">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Active Verified Suppliers</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {supplierActivity.total_active_suppliers}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Audited profiles
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Orders Serviced</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {supplierActivity.total_orders_serviced}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1">Confirmed contracts</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Avg Quote Response</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {supplierActivity.avg_response_time_hours}h
                  </p>
                  <p className="text-[10px] text-purple-600 mt-1">Fast turnaround</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">On-Time Shipment Rate</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {supplierActivity.on_time_shipment_rate}%
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-1">High reliability</p>
                </div>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-xs text-slate-400">
                Loading network activity...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
