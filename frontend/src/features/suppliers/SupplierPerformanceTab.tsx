import React from "react";
import {
  TrendingUp,
  Clock,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { SupplierPerformanceResponse } from "../../lib/api/suppliers";

interface SupplierPerformanceTabProps {
  performance: SupplierPerformanceResponse | null;
  isLoading?: boolean;
}

export const SupplierPerformanceTab: React.FC<SupplierPerformanceTabProps> = ({
  performance,
  isLoading,
}) => {
  if (isLoading || !performance) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 animate-pulse">
        Loading operational performance track record...
      </div>
    );
  }

  const months = performance.monthly_trend || [];
  const svgWidth = 600;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 30;

  const minRate = 90;
  const maxRate = 100;

  const points = months.map((m, idx) => {
    const x = paddingX + (idx / Math.max(1, months.length - 1)) * (svgWidth - 2 * paddingX);
    const y =
      svgHeight -
      paddingY -
      ((m.on_time_rate - minRate) / (maxRate - minRate)) * (svgHeight - 2 * paddingY);
    return { x, y, ...m };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
      : "";

  return (
    <div className="space-y-6">
      {/* 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {performance.on_time_rate}%
            </div>
            <div className="text-xs font-semibold text-slate-500">12-Month On-Time Delivery</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              &lt; {performance.response_time_hours}h
            </div>
            <div className="text-xs font-semibold text-slate-500">Average RFQ Response Time</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {performance.repeat_buyer_rate}%
            </div>
            <div className="text-xs font-semibold text-slate-500">Repeat Importer Re-order Rate</div>
          </div>
        </div>
      </div>

      {/* Grid: 12-Month Delivery Trend Chart & Response Time Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 12-Month Line Chart */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                12-Month On-Time Fulfillment Track Record
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              95.0% Overall SLA
            </span>
          </div>

          <div className="w-full overflow-x-auto pt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 sm:h-56 min-w-[500px]"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line
                x1={paddingX}
                y1={svgHeight - paddingY}
                x2={svgWidth - paddingX}
                y2={svgHeight - paddingY}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={paddingY}
                x2={svgWidth - paddingX}
                y2={paddingY}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {areaD && <path d={areaD} fill="url(#trendGradient)" />}

              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  />
                  <text
                    x={pt.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-semibold"
                  >
                    {pt.month}
                  </text>
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-700 font-bold"
                  >
                    {pt.on_time_rate}%
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Response Time Gauge */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Response Time Gauge</h3>
          </div>

          <div className="flex flex-col items-center justify-center py-4 space-y-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#F1F5F9"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10B981"
                  strokeWidth="10"
                  strokeDasharray="251.2"
                  strokeDashoffset="35"
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl font-black text-slate-900 leading-none">4.0h</span>
                <span className="block text-[11px] font-semibold text-slate-400 mt-1">Avg SLA</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Under 4 hours</span>
              <span className="font-bold text-emerald-600">82%</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Under 12 hours</span>
              <span className="font-bold text-blue-600">96%</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Under 24 hours</span>
              <span className="font-bold text-slate-800">100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
