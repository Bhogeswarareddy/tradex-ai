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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-7 overflow-visible">
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
    <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Live Market Insights</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-400">Export commodity price and demand momentum</p>
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows List */}
      <div className="divide-y divide-slate-100">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-${i}`} className="py-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="w-20 h-6 bg-slate-100 rounded" />
              </div>
            ))
          : insights.map((row) => (
              <div
                key={row.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl px-2 transition-colors"
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={row.thumbnail_url || "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=150&q=80"}
                    alt={row.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{row.name}</h4>
                    <p className="text-[11px] text-slate-500 truncate">{row.category}</p>
                  </div>
                </div>

                {/* Right: Sparkline & Growth Percentage */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:block">
                    <SparklineSvg data={row.sparkline} />
                  </div>
                  <div className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
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
