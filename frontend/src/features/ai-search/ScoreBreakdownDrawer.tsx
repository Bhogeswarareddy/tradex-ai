import React from "react";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { RankedSupplier } from "../../lib/api/matching";

interface ScoreBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: RankedSupplier | null;
}

const FACTOR_CONFIGS = [
  { key: "product_relevance", label: "Product Relevance", max: 25, color: "bg-blue-500" },
  { key: "certifications", label: "Certifications & Audit", max: 15, color: "bg-teal-500" },
  { key: "moq_fit", label: "MOQ Order Scale Fit", max: 10, color: "bg-indigo-500" },
  { key: "capacity", label: "Factory Monthly Capacity", max: 10, color: "bg-cyan-500" },
  { key: "delivery", label: "Lead Time & Route Experience", max: 10, color: "bg-purple-500" },
  { key: "price", label: "Price Competitiveness", max: 15, color: "bg-emerald-500" },
  { key: "reliability", label: "Reliability & Track Record", max: 15, color: "bg-amber-500" },
];

export const ScoreBreakdownDrawer: React.FC<ScoreBreakdownDrawerProps> = ({
  isOpen,
  onClose,
  supplier,
}) => {
  if (!isOpen || !supplier) return null;

  const score = supplier.score;
  const scoreColor =
    score >= 80 ? "text-emerald-500 stroke-emerald-500" : score >= 60 ? "text-amber-500 stroke-amber-500" : "text-rose-500 stroke-rose-500";
  const strokeDashoffset = 100 - score;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Scoring Breakdown
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{supplier.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Score Circular Gauge */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-md">
              <div>
                <div className="text-xs text-slate-400 font-medium">Deterministic Match Score</div>
                <div className="text-2xl font-black mt-1 flex items-baseline gap-2">
                  <span>{supplier.score}</span>
                  <span className="text-xs text-slate-400 font-normal">/ 100 points</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xs">
                  Computed purely via pure-Python mathematical weights from system settings.
                </p>
              </div>

              {/* Circular SVG Ring */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-700"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${scoreColor} transition-all duration-1000 ease-out`}
                    strokeDasharray="100, 100"
                    strokeDashoffset={strokeDashoffset}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-sm font-bold">{Math.round(supplier.score)}%</span>
              </div>
            </div>

            {/* Plain Language AI Explanation */}
            {supplier.explanation && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>AI Trade Analyst Summary</span>
                </div>
                <p className="leading-relaxed text-blue-900/90">{supplier.explanation}</p>
              </div>
            )}

            {/* 7 Factors Breakdown Bars */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Factor Point Breakdown (Sum = 100)
              </h3>

              <div className="space-y-3">
                {FACTOR_CONFIGS.map((factor) => {
                  const pts = supplier.breakdown?.[factor.key as keyof typeof supplier.breakdown] ?? 0;
                  const pct = Math.min(100, (pts / factor.max) * 100);

                  return (
                    <div key={factor.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{factor.label}</span>
                        <span className="font-mono text-slate-500">
                          <strong className="text-slate-800">{pts}</strong> / {factor.max} pts
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${factor.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Match Reasons */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Match Highlights</span>
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 pl-1">
                {supplier.reasons?.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold mt-0.5">&bull;</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks / Warnings */}
            {supplier.risks && supplier.risks.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Trade Risks & Constraints Identified</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1">
                  {supplier.risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
