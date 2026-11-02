import React from "react";
import { ArrowUpRight } from "lucide-react";
import { MarketInsightRow } from "../../lib/api/dashboard";

interface MarketInsightsSectionProps {
  insights: MarketInsightRow[];
  isLoading?: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SparklineSvg: React.FC<{ data: number[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 28;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-7 overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export const MarketInsightsSection: React.FC<MarketInsightsSectionProps> = ({
  insights,
  isLoading,
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: "top_export", label: "Top Export Products" },
    { id: "rising_demand", label: "Rising Demand" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Live Market Insights</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Live market feed
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Export commodity price and demand momentum</p>
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  isActive
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-${i}`} className="py-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                </div>
                <div className="w-20 h-6 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            ))
          : insights.map((row) => (
              <div
                key={row.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 rounded-xl px-2 transition-colors"
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={row.thumbnail_url || "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=150&q=80"}
                    alt={row.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{row.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.category}</p>
                  </div>
                </div>

                {/* Right: Sparkline & Growth Percentage */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:block">
                    <SparklineSvg data={row.sparkline} />
                  </div>
                  <div className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{row.trend_percentage}</span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};
