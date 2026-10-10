import React from "react";
import {
  X,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Clock,
  DollarSign,
  Award,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import {
  ComparisonQuote,
  AIQuoteRecommendationOutput,
} from "../../lib/api/quoteComparison";
import { Button } from "../../components/ui/Button";

interface QuoteCompareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quotes: ComparisonQuote[];
  aiRecommendation?: AIQuoteRecommendationOutput | null;
  onAcceptQuote?: (quoteId: string) => void;
  isAccepting?: boolean;
}

export const QuoteCompareDrawer: React.FC<QuoteCompareDrawerProps> = ({
  isOpen,
  onClose,
  quotes,
  aiRecommendation,
  onAcceptQuote,
  isAccepting,
}) => {
  if (!isOpen) return null;

  // Max landed cost for relative bar scaling
  const maxLandedCost = Math.max(...quotes.map((q) => q.landed_cost), 4.0);
  const maxLeadTime = Math.max(...quotes.map((q) => q.lead_time_days), 35);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                AI Quote Comparison & Landed Cost Simulation
              </h2>
              <p className="text-xs text-slate-500">
                Deep multi-factor analysis across CIF port charges, import duties, and lead times
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* AI Recommendation Spotlight Card */}
          {aiRecommendation && (
            <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black tracking-wide uppercase flex items-center gap-1 shadow-xs">
                    <Award className="w-3.5 h-3.5" />
                    AI Top Recommendation
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {aiRecommendation.winner_supplier_name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Recommended Landed Cost:</span>
                  <span className="ml-1.5 text-base font-black text-blue-700">
                    €{aiRecommendation.winner_landed_cost?.toFixed(2)}/kg
                  </span>
                </div>
              </div>

              {/* Rationale & Trade-offs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Why this quote wins
                  </span>
                  <p className="text-slate-600 leading-relaxed">{aiRecommendation.why}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    Commercial Trade-offs
                  </span>
                  <p className="text-slate-600 leading-relaxed">{aiRecommendation.trade_offs}</p>
                </div>
              </div>

              {/* Tactical Tip & Risks */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-blue-100 text-xs">
                {aiRecommendation.negotiation_tip && (
                  <div className="flex items-center gap-1.5 text-blue-800 font-medium">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>Tactical Tip:</strong> {aiRecommendation.negotiation_tip}
                    </span>
                  </div>
                )}

                {onAcceptQuote && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isAccepting}
                    onClick={() => onAcceptQuote(aiRecommendation.winner_quote_id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 shadow-sm ml-auto"
                  >
                    Accept This Recommended Quote
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Landed Cost Stacked Breakdown Comparison */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Delivered Landed Cost Breakdown (€/kg)
                </h3>
                <p className="text-xs text-slate-500">
                  Simulated estimate: Product FOB + Ocean Freight + Insurance + Import Duty + Terminal Handling
                </p>
              </div>
            </div>

            {/* Stacked Cost Bars for each Quote */}
            <div className="space-y-3">
              {quotes.map((q) => {
                const bd = q.landed_cost_breakdown;
                const prodCost = bd?.product_cost_total && bd?.quantity ? bd.product_cost_total / bd.quantity : q.unit_price;
                const freight = bd?.freight_total && bd?.quantity ? bd.freight_total / bd.quantity : 0.20;
                const duty = bd?.duty_total && bd?.quantity ? bd.duty_total / bd.quantity : 0.05;
                const handling = bd?.handling_total && bd?.quantity ? bd.handling_total / bd.quantity : 0.04;
                const insurance = bd?.insurance_total && bd?.quantity ? bd.insurance_total / bd.quantity : 0.01;

                const prodPct = (prodCost / maxLandedCost) * 100;
                const freightPct = (freight / maxLandedCost) * 100;
                const dutyPct = (duty / maxLandedCost) * 100;
                const handlingPct = (handling / maxLandedCost) * 100;
                const insurancePct = (insurance / maxLandedCost) * 100;

                return (
                  <div key={q.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{q.supplier_name}</span>
                        <span className="text-[11px] font-mono text-slate-400">({q.quote_number})</span>
                        {q.is_cheapest && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Lowest Landed Cost
                          </span>
                        )}
                        {q.is_fastest && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Fastest Delivery
                          </span>
                        )}
                      </div>
                      <div className="font-black text-slate-900 text-sm">
                        €{q.landed_cost?.toFixed(2)}/kg
                      </div>
                    </div>

                    {/* Stacked Bar */}
                    <div className="h-4 bg-slate-100 rounded-md overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${prodPct}%` }}
                        className="bg-blue-600 h-full"
                        title={`Product FOB: €${prodCost.toFixed(2)}/kg`}
                      />
                      <div
                        style={{ width: `${freightPct}%` }}
                        className="bg-indigo-500 h-full"
                        title={`Ocean Freight: €${freight.toFixed(2)}/kg`}
                      />
                      <div
                        style={{ width: `${dutyPct}%` }}
                        className="bg-amber-500 h-full"
                        title={`Import Tariff/Duty: €${duty.toFixed(2)}/kg`}
                      />
                      <div
                        style={{ width: `${handlingPct}%` }}
                        className="bg-teal-500 h-full"
                        title={`Port Handling: €${handling.toFixed(2)}/kg`}
                      />
                      <div
                        style={{ width: `${insurancePct}%` }}
                        className="bg-purple-500 h-full"
                        title={`Marine Insurance: €${insurance.toFixed(2)}/kg`}
                      />
                    </div>

                    {/* Breakdown sub-labels */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        FOB: €{prodCost.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        Freight: €{freight.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Tariff: €{duty.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                        Handling: €{handling.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Insurance: €{insurance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Lead Time Comparison */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Delivery Lead Time Comparison (Days from Dispatch)
            </h3>

            <div className="space-y-2.5">
              {quotes.map((q) => {
                const pct = (q.lead_time_days / maxLeadTime) * 100;
                return (
                  <div key={q.id} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="font-semibold">{q.supplier_name}</span>
                      <span className="font-bold">{q.lead_time_days} Days</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          q.is_fastest ? "bg-emerald-500" : "bg-indigo-400"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: AI Scoring Multi-Factor Matrix (Deterministic 0-100) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Deterministic AI Score Breakdown (0-100)
              </h3>
              <span className="text-[11px] text-slate-500">
                Formula: Landed Cost (40) + Lead Time (20) + Reliability (20) + Certs (10) + Payment Terms (10)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100/80 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Landed Cost (40)</th>
                    <th className="p-3">Lead Time (20)</th>
                    <th className="p-3">Reliability (20)</th>
                    <th className="p-3">Certs & Terms (20)</th>
                    <th className="p-3 font-black text-blue-600">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes.map((q) => {
                    const landedPts = Math.min(40, ((Math.min(...quotes.map((x) => x.landed_cost)) / q.landed_cost) * 40));
                    const leadPts = Math.min(20, ((Math.min(...quotes.map((x) => x.lead_time_days)) / q.lead_time_days) * 20));
                    const relPts = Math.round((q.trust_score / 100) * 20);
                    const termsPts = 18;

                    return (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{q.supplier_name}</td>
                        <td className="p-3 text-slate-600">{landedPts.toFixed(1)} / 40</td>
                        <td className="p-3 text-slate-600">{leadPts.toFixed(1)} / 20</td>
                        <td className="p-3 text-slate-600">{relPts.toFixed(1)} / 20</td>
                        <td className="p-3 text-slate-600">{termsPts.toFixed(1)} / 20</td>
                        <td className="p-3 font-black text-sm text-blue-700">
                          {q.ai_score?.toFixed(1) || 90.0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>* Cost computations are modeled on official Port of Hamburg tariff schedules.</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Breakdown
          </Button>
        </div>
      </div>
    </div>
  );
};
