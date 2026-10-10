import React from "react";
import {
  TrendingUp,
  Eye,
  FileText,
  Package,
  Award,
  Sparkles,
  ArrowUpRight,
  Globe,
  Clock,
} from "lucide-react";
import { SupplierDashboardMetrics } from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";

interface SupplierDashboardViewProps {
  metrics: SupplierDashboardMetrics | null;
  isLoading?: boolean;
  onNavigateToProducts: () => void;
  onNavigateToProfile: () => void;
}

export const SupplierDashboardView: React.FC<SupplierDashboardViewProps> = ({
  metrics,
  isLoading,
  onNavigateToProducts,
  onNavigateToProfile,
}) => {
  if (isLoading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="h-72 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  const timeline = metrics.timeline_30d || [];
  const svgWidth = 700;
  const svgHeight = 220;
  const padX = 40;
  const padY = 30;

  const maxVal = Math.max(10, ...timeline.map((t) => Math.max(t.views, t.inquiries)));

  const viewPoints = timeline.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, timeline.length - 1)) * (svgWidth - 2 * padX);
    const y = svgHeight - padY - (pt.views / maxVal) * (svgHeight - 2 * padY);
    return { x, y, ...pt };
  });

  const inquiryPoints = timeline.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, timeline.length - 1)) * (svgWidth - 2 * padX);
    const y = svgHeight - padY - (pt.inquiries / maxVal) * (svgHeight - 2 * padY);
    return { x, y, ...pt };
  });

  const viewPath = viewPoints.reduce((acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");
  const viewArea =
    viewPoints.length > 0
      ? `${viewPath} L ${viewPoints[viewPoints.length - 1].x} ${svgHeight - padY} L ${viewPoints[0].x} ${svgHeight - padY} Z`
      : "";

  const inqPath = inquiryPoints.reduce((acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");

  return (
    <div className="space-y-6">
      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profile Views */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Profile Views (30d)
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {metrics.profile_views.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +24% vs prior month
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* RFQs / Inquiries Received */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              RFQs Received (30d)
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {metrics.inquiries_count}
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {metrics.quotes_sent} quotes dispatched
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Active Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Products
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {metrics.open_rfqs_matching}
            </div>
            <div className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1">
              <span>Published in Catalog</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Conversion Rate / Quote Win Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quote Win Rate
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {metrics.quote_win_rate}%
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Above industry average (22%)
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: 30-Day Timeline Chart & AI Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 30-Day Timeline Chart */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                30-Day Storefront Traffic & Inquiries
              </h3>
              <p className="text-xs text-slate-500">
                Buyer discovery analytics and RFQ conversion trends
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-1 rounded-full bg-blue-600" />
                Profile Views
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-1 rounded-full bg-emerald-600" />
                Inquiries Received
              </span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="w-full overflow-x-auto pt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-56 sm:h-64 min-w-[500px]"
            >
              <defs>
                <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line
                x1={padX}
                y1={svgHeight - padY}
                x2={svgWidth - padX}
                y2={svgHeight - padY}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <line
                x1={padX}
                y1={padY}
                x2={svgWidth - padX}
                y2={padY}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {viewArea && <path d={viewArea} fill="url(#viewsAreaGrad)" />}
              {viewPath && (
                <path
                  d={viewPath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {inqPath && (
                <path
                  d={inqPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points (sparse to avoid crowding) */}
              {viewPoints.filter((_, i) => i % 5 === 0 || i === viewPoints.length - 1).map((pt, idx) => (
                <g key={idx}>
                  <circle cx={pt.x} cy={pt.y} r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
                  <text
                    x={pt.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-semibold"
                  >
                    {pt.date.split("-").slice(1).join("/")}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: AI Opportunities List */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="font-bold text-sm text-white">AI Trade Opportunities</h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-[#38BDF8] border border-blue-400/30">
                High Match
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time unfulfilled buyer demand identified by TradeX AI matching engine based on recent buyer search traffic.
            </p>

            <div className="space-y-3">
              {metrics.opportunities && metrics.opportunities.length > 0 ? (
                metrics.opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-white leading-snug">
                        {opp.title}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                        {opp.match_score}% Match
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400" />
                        Buyer: {opp.buyer_country}
                      </span>
                      <span className="font-bold text-white">
                        {opp.quantity} {opp.unit} @ ${opp.target_price}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Deadline: {opp.deadline}
                      </span>
                      <span className="text-blue-300 font-semibold cursor-pointer hover:underline">
                        Send Quote &rarr;
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-white">Organic Turmeric (Alleppey)</div>
                  <p className="text-slate-400">
                    3 buyers searched for Organic Turmeric from India with no direct match this week. Add this product to capture demand.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToProducts}
              className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs font-bold"
            >
              Add Matching Products Now
              <ArrowUpRight className="w-4 h-4 ml-1.5 text-[#38BDF8]" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToProfile}
              className="w-full bg-transparent border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold"
            >
              Edit Storefront Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
