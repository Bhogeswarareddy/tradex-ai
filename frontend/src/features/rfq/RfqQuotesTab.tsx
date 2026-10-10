import React from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  TrendingUp,
  Award,
  FileText,
  MapPin,
} from "lucide-react";
import { QuotationItem } from "../../lib/api/rfqs";
import { Button } from "../../components/ui/Button";

interface RfqQuotesTabProps {
  quotes: QuotationItem[];
  isBuyer: boolean;
  rfqStatus: string;
  onAwardQuote?: (quoteId: string) => void;
  isAwarding?: boolean;
}

export const RfqQuotesTab: React.FC<RfqQuotesTabProps> = ({
  quotes,
  isBuyer,
  rfqStatus,
  onAwardQuote,
  isAwarding,
}) => {
  if (quotes.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 space-y-2">
        <FileText className="w-10 h-10 mx-auto text-slate-400" />
        <h3 className="text-base font-bold text-slate-800">No Quotations Received Yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Verified suppliers are evaluating your specifications. You will receive notifications as bids are submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Comparative Quotations ({quotes.length})
        </h3>
        <span className="text-xs text-slate-500">
          Ranked by landed cost and compliance audit score
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {quotes.map((q) => {
          const isWinning = q.status === "accepted";
          const score = q.ai_score || 90;

          return (
            <div
              key={q.id}
              className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 bg-white ${
                isWinning
                  ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-md"
                  : "border-slate-200 hover:border-blue-300 hover:shadow-md"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                {/* Supplier Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {q.supplier_logo ? (
                      <img
                        src={q.supplier_logo}
                        alt={q.supplier_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/suppliers/${q.supplier_id}`}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {q.supplier_name}
                      </Link>

                      <span className="text-xs font-mono text-slate-400">
                        {q.quote_number}
                      </span>

                      {isWinning && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                          <Award className="w-3 h-3 text-emerald-600" />
                          Awarded Contract
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {q.supplier_country}
                      </span>
                      <span>&bull;</span>
                      <span>
                        Lead Time: <strong className="text-slate-700">{q.lead_time_days} days</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Payment: <strong className="text-slate-700">{q.payment_terms}</strong>
                      </span>
                      {q.valid_until && (
                        <>
                          <span>&bull;</span>
                          <span>Valid: {new Date(q.valid_until).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    {q.notes && (
                      <p className="text-xs text-slate-600 italic pt-1">{q.notes}</p>
                    )}
                  </div>
                </div>

                {/* Right: Pricing, Score & Action */}
                <div className="flex sm:flex-row items-center justify-between w-full lg:w-auto gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-shrink-0">
                  {/* Pricing Details */}
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Unit Price:</div>
                    <div className="text-lg font-black text-slate-900">
                      {q.currency} ${q.unit_price?.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Landed: <strong className="text-slate-800">${q.landed_cost?.toFixed(2)}</strong> (incl. ${q.freight_cost?.toFixed(2)} freight)
                    </div>
                  </div>

                  {/* AI Score Badge */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{score} Score</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">AI Rank Score</div>
                  </div>

                  {/* Award Action (Buyer only) */}
                  {isBuyer && rfqStatus !== "closed" && (
                    <div>
                      {isWinning ? (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Accepted</span>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isAwarding}
                          onClick={() => onAwardQuote && onAwardQuote(q.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 shadow-xs"
                        >
                          Award Contract
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
