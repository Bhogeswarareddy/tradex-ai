import React, { useState, useEffect, useCallback } from "react";
import {
  dashboardApi,
  DashboardSummaryResponse,
  RecommendedSupplierCard,
  MarketInsightRow,
  SuggestedPromptItem,
} from "../lib/api/dashboard";
import { matchingApi } from "../lib/api/matching";
import {
  HeroSearchSection,
  KpiBarSection,
  RecommendedSuppliersSection,
  AiCopilotPanel,
  MarketInsightsSection,
} from "../features/dashboard";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/Button";

export const HomePage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [suppliers, setSuppliers] = useState<RecommendedSupplierCard[]>([]);
  const [supplierTab, setSupplierTab] = useState("top_match");
  const [insights, setInsights] = useState<MarketInsightRow[]>([]);
  const [insightTab, setInsightTab] = useState("top_export");
  const [prompts, setPrompts] = useState<SuggestedPromptItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, supRes, insRes, prmRes] = await Promise.all([
        dashboardApi.getSummary().catch(() => null),
        dashboardApi.getRecommendedSuppliers("top_match").catch(() => []),
        dashboardApi.getMarketInsights("top_export").catch(() => []),
        dashboardApi.getSuggestedPrompts().catch(() => []),
      ]);

      if (sumRes) setSummary(sumRes);
      setSuppliers(supRes);
      setInsights(insRes);
      setPrompts(prmRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle supplier tab change
  const handleSupplierTabChange = async (tab: string) => {
    setSupplierTab(tab);
    setSuppliersLoading(true);
    try {
      if (tab === "top_match") {
        let lastReq = {
          product: "Organic Turmeric Powder",
          quantity: 20000,
          destination_country: "Germany",
          certifications: ["EU Organic", "ISO 22000"],
        };
        try {
          const stored = localStorage.getItem("tradex_last_requirement");
          if (stored) lastReq = JSON.parse(stored);
        } catch {
          // ignore
        }
        const matchRes = await matchingApi.rankSuppliers(lastReq);
        const mapped: RecommendedSupplierCard[] = matchRes.results.map((r) => ({
          id: r.id,
          name: r.name,
          logo_url: r.logo_url,
          cover_image_url: r.banner_url,
          country: r.country,
          city: r.city,
          flag: r.country === "India" ? "🇮🇳" : "🌐",
          years_in_business: r.years_in_business,
          is_verified: r.verified_status === "verified",
          trust_score: r.trust_score,
          rating: r.rating,
          review_count: r.total_reviews,
          on_time_rate: r.on_time_rate,
          capacity_per_month: r.capacity_per_month,
          moq: `${r.min_moq || 1000} kg`,
          certifications: r.certifications.slice(0, 3),
          is_saved: false,
        }));
        setSuppliers(mapped);
      } else {
        const res = await dashboardApi.getRecommendedSuppliers(tab);
        setSuppliers(res);
      }
    } catch {
      // Keep previous on error
    } finally {
      setSuppliersLoading(false);
    }
  };

  // Handle insights tab change
  const handleInsightTabChange = async (tab: string) => {
    setInsightTab(tab);
    setInsightsLoading(true);
    try {
      const res = await dashboardApi.getMarketInsights(tab);
      setInsights(res);
    } catch {
      // Keep previous on error
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleToggleSaveSupplier = async (supplierId: string, current: boolean) => {
    await dashboardApi.toggleSaveSupplier(supplierId, current);
  };

  if (error && !summary) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to Load Dashboard</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">{error}</p>
        <Button variant="primary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadInitialData}>
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 sm:space-y-14 pb-16">
      {/* 1. Hero Section & Stats Panel */}
      <HeroSearchSection stats={summary?.hero_stats} isLoading={loading} />

      {/* 2. Five KPI Cards Overlapping Hero's Bottom Edge */}
      <KpiBarSection kpis={summary?.kpis} isLoading={loading} />

      {/* 3. Recommended Suppliers for You */}
      <RecommendedSuppliersSection
        suppliers={suppliers}
        isLoading={suppliersLoading || loading}
        activeTab={supplierTab}
        onTabChange={handleSupplierTabChange}
        onToggleSave={handleToggleSaveSupplier}
      />

      {/* 4. Two-Column Intelligence Grid: AI Copilot Panel & Live Market Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <AiCopilotPanel suggestedPrompts={prompts} />
        </div>
        <div className="lg:col-span-5">
          <MarketInsightsSection
            insights={insights}
            isLoading={insightsLoading || loading}
            activeTab={insightTab}
            onTabChange={handleInsightTabChange}
          />
        </div>
      </div>
    </div>
  );
};
