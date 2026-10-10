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

      <div className="grid grid-cols-2 gap-3.5">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`p-3 rounded-xl bg-gradient-to-b ${item.glowColor} bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-slate-800/60">{item.icon}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isLoading ? (
                  <div className="h-6 w-16 bg-slate-800 rounded animate-pulse" />
                ) : (
                  item.value
                )}
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">{item.label}</p>
              <p className="text-[10px] text-slate-500 hidden sm:block mt-0.5">{item.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
