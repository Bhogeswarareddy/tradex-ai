import React, { useState, useEffect } from "react";
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
import {
  analyticsApi,
  TopProductItem,
  RisingDemandItem,
  PriceTrendsResponse,
  DestinationDemandItem,
  InsightsResponse,
} from "../lib/api/analytics";

export const AnalyticsPage: React.FC = () => {
  // Preset filters: 7d, 30d, 90d, 12m, all
  const [datePreset, setDatePreset] = useState<string>("12m");
  const [selectedProduct, setSelectedProduct] = useState<string>("Organic Turmeric");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  // Data states
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [risingDemand, setRisingDemand] = useState<RisingDemandItem[]>([]);
  const [priceTrends, setPriceTrends] = useState<PriceTrendsResponse | null>(null);
  const [destDemand, setDestDemand] = useState<DestinationDemandItem[]>([]);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regeneratingAi, setRegeneratingAi] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Compute dates based on preset
  const getDateRange = () => {
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
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange();
      const params = {
        from,
        to,
        product: selectedProduct || undefined,
        category: selectedCategory || undefined,
        country: selectedCountry || undefined,
      };

      const [topRes, riseRes, priceRes, destRes] = await Promise.all([
        analyticsApi.getTopProducts(params),
        analyticsApi.getRisingDemand(params),
        analyticsApi.getPriceTrends(params),
        analyticsApi.getDestinationDemand(params),
      ]);

      setTopProducts(topRes);
      setRisingDemand(riseRes);
      setPriceTrends(priceRes);
      setDestDemand(destRes);

      // AI Insights
      if (!insights) {
        const ins = await analyticsApi.getInsights(params);
        setInsights(ins);
      }
    } catch (err: any) {
      console.error("Failed to load analytics data", err);
      setError(err?.message || "Error loading market intelligence data");
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingAi(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [datePreset, selectedProduct, selectedCategory, selectedCountry]);

  const exportUrlCsv = analyticsApi.getExportUrl("market", "csv", {
    ...getDateRange(),
    product: selectedProduct || undefined,
    category: selectedCategory || undefined,
    country: selectedCountry || undefined,
  });

  const exportUrlPdf = analyticsApi.getExportUrl("market", "pdf", {
    ...getDateRange(),
    product: selectedProduct || undefined,
    category: selectedCategory || undefined,
    country: selectedCountry || undefined,
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
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
            24-month commodity time-series, global shipping lane demand, spot price trends, and AI export forecasting.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <a
            href={exportUrlCsv}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </a>
          <a
            href={exportUrlPdf}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-white shadow-sm hover:bg-primary/90 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF Report
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
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
              onClick={() => {
                setSelectedProduct("");
                setSelectedCategory("");
                setSelectedCountry("");
                setDatePreset("12m");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-2"
            >
              Reset
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-xs text-primary animate-pulse font-medium">
            Fetching latest time-series data...
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* AI Market Insights Banner */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                TradeX AI Market Intelligence Synthesis
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-300">
                  market_insight.v1
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ground-truth AI evaluation derived strictly from 24-month time-series metrics.
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

      {/* Top Rising Demand Fast Stats Cards */}
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

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Price Trends & 3-Month Simple Moving Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Commodity Spot Price & 3M SMA Trend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historical monthly price per kg/unit with simple moving average (€)
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {priceTrends?.product || "Selected"}
            </span>
          </div>

          <div className="h-72 w-full">
            {priceTrends && priceTrends.points.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceTrends.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => val.slice(2, 7)}
                  />
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
                  <Line
                    type="monotone"
                    dataKey="avg_price"
                    name="Spot Price (€)"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma_3m"
                    name="3M SMA (€)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Loading price trends...
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Top Traded Products by Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Top Export Commodities by Cumulative Volume
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated export tonnage across monitored shipping corridors (MT)
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {topProducts.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Loading volume comparison...
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Destination Demand Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600" />
                Destination Port & Country Demand Share
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Export flow destination market share (%) and cumulative trade volume
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {destDemand.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Loading destination breakdown...
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Monthly Trade Volume & Demand Dynamics */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                Monthly Trade Volume Flow (MT)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seasonality and cyclical volume throughput across 24 consecutive months
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
              Seasonality Curve
            </span>
          </div>

          <div className="h-72 w-full">
            {priceTrends && priceTrends.points.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceTrends.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => val.slice(2, 7)}
                  />
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
                  <Area
                    type="monotone"
                    dataKey="volume"
                    name="Volume (MT)"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#volGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Loading volume throughput...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
