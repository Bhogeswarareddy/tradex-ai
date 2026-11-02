import React from "react";
import { FileText, CheckCircle2, Truck, DollarSign, UserPlus, ArrowUpRight } from "lucide-react";
import { KPICardData } from "../../lib/api/dashboard";

interface KpiBarSectionProps {
  kpis?: KPICardData[];
  isLoading?: boolean;
}

const DEFAULT_KPIS: KPICardData[] = [
  { title: "Active RFQs", value: "124", delta_percentage: "+18%", is_positive: true, subtext: "vs last month" },
  { title: "Total Orders", value: "342", delta_percentage: "+27%", is_positive: true, subtext: "high fulfillment" },
  { title: "Shipments in Transit", value: "86", delta_percentage: "+12%", is_positive: true, subtext: "on-schedule" },
  { title: "Total Trade Value", value: "$8.4M", delta_percentage: "+31%", is_positive: true, subtext: "escrow protected" },
  { title: "New Supplier Leads", value: "520", delta_percentage: "+45%", is_positive: true, subtext: "verified this week" },
];

export const KpiBarSection: React.FC<KpiBarSectionProps> = ({ kpis = DEFAULT_KPIS, isLoading }) => {
  const displayKpis = kpis && kpis.length === 5 ? kpis : DEFAULT_KPIS;

  const icons = [
    <FileText key="rfq" className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    <CheckCircle2 key="ord" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    <Truck key="shp" className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
    <DollarSign key="val" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
    <UserPlus key="sup" className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
  ];

  const iconBgs = [
    "bg-blue-50 dark:bg-blue-950/50",
    "bg-emerald-50 dark:bg-emerald-950/50",
    "bg-sky-50 dark:bg-sky-950/50",
    "bg-indigo-50 dark:bg-indigo-950/50",
    "bg-amber-50 dark:bg-amber-950/50",
  ];

  return (
    <section className="-mt-8 sm:-mt-10 relative z-20 px-2 sm:px-4" aria-label="Key Performance Indicators">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {displayKpis.map((kpi, index) => (
          <div
            key={kpi.title}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-900/5 dark:shadow-slate-950/40 hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {kpi.title}
              </span>
              <div className={`p-2 rounded-xl ${iconBgs[index % iconBgs.length]}`}>
                {icons[index % icons.length]}
              </div>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isLoading ? (
                  <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  kpi.value
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  {kpi.delta_percentage}
                </span>
                {kpi.subtext && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                    {kpi.subtext}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
