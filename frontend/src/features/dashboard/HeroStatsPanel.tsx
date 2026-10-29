import React from "react";
import { ShieldCheck, Users, Truck, Globe2 } from "lucide-react";
import { HeroStats } from "../../lib/api/dashboard";

interface HeroStatsPanelProps {
  stats?: HeroStats;
  isLoading?: boolean;
}

export const HeroStatsPanel: React.FC<HeroStatsPanelProps> = ({ stats, isLoading }) => {
  const verifiedCount = stats?.verified_suppliers || 2847;
  const buyersCount = stats?.global_buyers || 12430;
  const shipmentsCount = stats?.active_shipments || 1250;
  const countriesCount = stats?.countries_covered || 98;

  const statItems = [
    {
      label: "Verified Suppliers",
      value: `${verifiedCount.toLocaleString()}`,
      subtext: "Strictly audited & accredited",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      glowColor: "from-emerald-500/10 to-transparent",
    },
    {
      label: "Global Buyers",
      value: `${buyersCount.toLocaleString()}`,
      subtext: "Active importers & distributors",
      icon: <Users className="w-5 h-5 text-blue-400" />,
      glowColor: "from-blue-500/10 to-transparent",
    },
    {
      label: "Active Shipments",
      value: `${shipmentsCount.toLocaleString()}`,
      subtext: "In ocean & air transit now",
      icon: <Truck className="w-5 h-5 text-sky-400" />,
      glowColor: "from-sky-500/10 to-transparent",
    },
    {
      label: "Countries Covered",
      value: `${countriesCount}`,
      subtext: "Across 6 continents",
      icon: <Globe2 className="w-5 h-5 text-purple-400" />,
      glowColor: "from-purple-500/10 to-transparent",
    },
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between gap-4">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Global Discovery Metrics
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">Real-time trade platform network</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`p-3 rounded-xl bg-gradient-to-r ${item.glowColor} bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-slate-800/60 shrink-0">{item.icon}</span>
              <div>
                <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                  {isLoading ? (
                    <div className="h-5 w-16 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    item.value
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-300">{item.label}</p>
              </div>
            </div>
            <div className="text-right shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-400 hidden xl:inline">{item.subtext}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
