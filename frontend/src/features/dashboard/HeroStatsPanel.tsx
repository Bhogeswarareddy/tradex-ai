import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, Truck, Globe2, Info, Database } from "lucide-react";
import { HeroStats } from "../../lib/api/dashboard";

interface HeroStatsPanelProps {
  stats?: HeroStats;
  isLoading?: boolean;
}

// Accessible Animated Counter with reduced-motion support and <200ms duration
const AnimatedCounter: React.FC<{ value: number; duration?: number }> = ({ value, duration = 180 }) => {
  const [displayValue, setDisplayValue] = useState<number>(() => {
    // Check if user prefers reduced motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return value;
    }
    return Math.floor(value * 0.7);
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = Math.floor(value * 0.7);
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (value - startValue) * easedProgress);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

export const HeroStatsPanel: React.FC<HeroStatsPanelProps> = ({ stats, isLoading }) => {
  const [showDbBreakdown, setShowDbBreakdown] = useState(false);

  const verifiedCount = stats?.verified_suppliers || 2847;
  const buyersCount = stats?.global_buyers || 12430;
  const shipmentsCount = stats?.active_shipments || 1250;
  const countriesCount = stats?.countries_covered || 98;
  const networkLabel = stats?.network_label || "Demo network";

  const statItems = [
    {
      label: "Verified Suppliers",
      rawCount: verifiedCount,
      subtext: "Strictly audited & accredited",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      glowColor: "from-emerald-500/10 to-transparent",
      dbCount: stats?.real_db_counts?.suppliers,
    },
    {
      label: "Global Buyers",
      rawCount: buyersCount,
      subtext: "Active importers & distributors",
      icon: <Users className="w-5 h-5 text-blue-400" />,
      glowColor: "from-blue-500/10 to-transparent",
      dbCount: stats?.real_db_counts?.buyers,
    },
    {
      label: "Active Shipments",
      rawCount: shipmentsCount,
      subtext: "In ocean & air transit now",
      icon: <Truck className="w-5 h-5 text-sky-400" />,
      glowColor: "from-sky-500/10 to-transparent",
      dbCount: stats?.real_db_counts?.shipments,
    },
    {
      label: "Countries Covered",
      rawCount: countriesCount,
      subtext: "Across 6 continents",
      icon: <Globe2 className="w-5 h-5 text-purple-400" />,
      glowColor: "from-purple-500/10 to-transparent",
      dbCount: stats?.real_db_counts?.countries,
    },
  ];

  return (
    <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between gap-4">
      {/* Header with Demo Network Label and Verification Indicator */}
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Global Discovery Metrics
            </h3>
            {/* Prominent Demo Network Badge per Prompt 41 */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300 select-none"
              title="Platform network scale showing seeded enterprise benchmark"
            >
              <Info className="w-3 h-3 text-amber-400" />
              {networkLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time trade platform network
          </p>
        </div>

        {/* Live DB counts toggle button */}
        {stats?.real_db_counts && (
          <button
            type="button"
            onClick={() => setShowDbBreakdown(!showDbBreakdown)}
            className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 transition flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            title="Inspect active local database counts"
          >
            <Database className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">{showDbBreakdown ? "Hide DB" : "Live DB"}</span>
          </button>
        )}
      </div>

      {/* Database breakdown notice if toggled */}
      {showDbBreakdown && stats?.real_db_counts && (
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between gap-2 animate-fadeIn">
          <span className="text-slate-400 font-semibold">Active Database Rows:</span>
          <div className="flex items-center gap-2 font-mono text-sky-300">
            <span>{stats.real_db_counts.suppliers} suppliers</span>
            <span>•</span>
            <span>{stats.real_db_counts.buyers} buyers</span>
            <span>•</span>
            <span>{stats.real_db_counts.shipments} shipments</span>
          </div>
        </div>
      )}

      {/* Metric Cards List */}
      <div className="flex flex-col gap-2.5">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`p-3 rounded-xl bg-gradient-to-r ${item.glowColor} bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 transition-colors hover:border-slate-700`}
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-slate-800/70 shrink-0">{item.icon}</span>
              <div>
                <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                  {isLoading ? (
                    <div className="h-5 w-16 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    <AnimatedCounter value={item.rawCount} />
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-300">{item.label}</p>
              </div>
            </div>
            <div className="text-right shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
              <span className="text-[11px] text-slate-400 hidden xl:inline">{item.subtext}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
