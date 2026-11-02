import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Download,
  Building2,
  CheckCircle2,
  Star,
  Clock,
  ArrowUpDown,
  TrendingUp,
  Award,
  FileSpreadsheet,
  FileText,
  Share2,
} from "lucide-react";
import { apiClient } from "../../lib/api";
import {
  QuoteComparisonData,
  AIQuoteRecommendationOutput,
  quoteComparisonApi,
} from "../../lib/api/quoteComparison";
import { Button } from "../../components/ui/Button";
import { QuoteCompareDrawer } from "./QuoteCompareDrawer";
import { LoadingSpinner } from "../../components/LoadingSpinner";

interface SupplierQuotesComparisonTableProps {
  rfqId: string;
  isBuyer: boolean;
  rfqStatus: string;
  onQuoteAccepted?: () => void;
}

export const SupplierQuotesComparisonTable: React.FC<SupplierQuotesComparisonTableProps> = ({
  rfqId,
  isBuyer,
  rfqStatus,
  onQuoteAccepted,
}) => {
  const [data, setData] = useState<QuoteComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "landed_cost" | "lead_time" | "unit_price">("score");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<AIQuoteRecommendationOutput | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await apiClient.post<any>(`/rfqs/${rfqId}/share`);
      const fullUrl = `${window.location.origin}${res.data.share_url}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        setActionSuccess(`Read-only share link copied to clipboard: ${fullUrl}`);
      } catch {
        setActionSuccess(`Share link created: ${fullUrl}`);
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
    }
  };

  const loadComparison = async (sort = sortBy) => {
    setLoading(true);
    setError(null);
    try {
      const res = await quoteComparisonApi.getComparison(rfqId, sort);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load supplier quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparison();
  }, [rfqId, sortBy]);

  const handleCompareWithAi = async () => {
    setIsDrawerOpen(true);
    if (!aiRecommendation && !loadingAi) {
      setLoadingAi(true);
      try {
        const rec = await quoteComparisonApi.getAiRecommendation(rfqId);
        setAiRecommendation(rec);
      } catch (err) {
        console.error("AI recommendation error:", err);
      } finally {
        setLoadingAi(false);
      }
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const blob = await quoteComparisonApi.exportComparison(rfqId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotes_comparison_${rfqId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Failed to export comparison");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShortlist = async (quoteId: string) => {
    try {
      await quoteComparisonApi.shortlistQuote(quoteId);
      loadComparison();
    } catch (err: any) {
      alert(err.message || "Failed to update shortlist status");
    }
  };

  const handleAcceptQuote = async (quoteId: string) => {
    if (!window.confirm("Accept this quote and generate an official purchase contract & order?")) {
      return;
    }
    setIsAccepting(quoteId);
    try {
      const res = await quoteComparisonApi.acceptQuote(quoteId);
      setActionSuccess(`Contract created! Order #${res.order_number} generated for ${res.accepted_quote_number}.`);
      loadComparison();
      if (onQuoteAccepted) onQuoteAccepted();
    } catch (err: any) {
      alert(err.message || "Failed to accept quote");
    } finally {
      setIsAccepting(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
        <span>{error || "Failed to load quotations"}</span>
        <Button size="sm" variant="outline" onClick={() => loadComparison()}>
          Retry
        </Button>
      </div>
    );
  }

  const quotes = data.quotes;

  return (
    <div className="space-y-4">
      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 font-bold hover:text-emerald-800"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header bar matching Prompt 14 image */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900">
              Supplier Quotes ({quotes.length})
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
              Simulated estimate
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time landed cost comparison to Port of Hamburg, Germany
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="score">AI Score</option>
              <option value="landed_cost">Landed Cost</option>
              <option value="lead_time">Lead Time</option>
              <option value="unit_price">Unit Price</option>
            </select>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="text-xs border-slate-200 text-slate-700 flex items-center gap-1.5 font-bold hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>Download PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Share Button (Prompt 42) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sharing}
            onClick={handleShare}
            className="text-xs border-slate-200 text-slate-700 flex items-center gap-1.5 font-bold hover:bg-slate-50"
            title="Create an expiring read-only link to share quote comparison with stakeholders"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{sharing ? "Sharing..." : "Share"}</span>
          </Button>

          {/* Compare with AI Button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCompareWithAi}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs px-3.5 py-2 flex items-center gap-1.5 shadow-sm font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Compare with AI</span>
          </Button>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-3">Unit Price</th>
                <th className="py-3.5 px-3 text-blue-700 font-black">Landed Cost</th>
                <th className="py-3.5 px-3">Freight</th>
                <th className="py-3.5 px-3">Lead Time</th>
                <th className="py-3.5 px-3">Payment Terms</th>
                <th className="py-3.5 px-3 text-center">AI Score</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {quotes.map((q) => {
                const isAccepted = q.is_accepted;
                const isShortlisted = q.is_shortlisted;

                return (
                  <tr
                    key={q.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isAccepted ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    {/* Supplier Column */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {q.supplier_logo ? (
                            <img
                              src={q.supplier_logo}
                              alt={q.supplier_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/suppliers/${q.supplier_id}`}
                              className="font-bold text-slate-900 hover:text-blue-600 transition-colors"
                            >
                              {q.supplier_name}
                            </Link>
                            {q.supplier_verified && (
                              <span title="Verified Exporter">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>
                              {q.supplier_city}, {q.supplier_country}
                            </span>
                            <span>&bull;</span>
                            <span className="text-emerald-700 font-semibold">
                              {q.trust_score}% Trust
                            </span>
                            {q.is_cheapest && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                Cheapest
                              </span>
                            )}
                            {q.is_fastest && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">
                                Fastest
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="py-4 px-3">
                      <span className="font-bold text-slate-900">
                        {q.currency} €{q.unit_price?.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/kg FOB</span>
                    </td>

                    {/* Landed Cost (Highlighted) */}
                    <td className="py-4 px-3">
                      <div className="inline-flex flex-col">
                        <span className="font-black text-blue-700 text-sm">
                          €{q.landed_cost?.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          incl. duty & port
                        </span>
                      </div>
                    </td>

                    {/* Freight */}
                    <td className="py-4 px-3 text-slate-600">
                      €0.20<span className="text-[10px] text-slate-400">/kg</span>
                    </td>

                    {/* Lead Time */}
                    <td className="py-4 px-3">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {q.lead_time_days} days
                      </span>
                    </td>

                    {/* Payment Terms */}
                    <td className="py-4 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={q.payment_terms}>
                      {q.payment_terms}
                    </td>

                    {/* AI Score (Circular or Badge Meter) */}
                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black shadow-2xs">
                        <TrendingUp className="w-3 h-3 text-blue-600" />
                        <span>{q.ai_score?.toFixed(0)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Shortlist bookmark */}
                        <button
                          type="button"
                          onClick={() => handleShortlist(q.id)}
                          title={isShortlisted ? "Remove from Shortlist" : "Add to Shortlist"}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isShortlisted
                              ? "bg-amber-50 border-amber-300 text-amber-500"
                              : "border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-slate-100"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isShortlisted ? "fill-amber-500" : ""}`} />
                        </button>

                        {/* View Breakdown */}
                        <button
                          type="button"
                          onClick={() => setIsDrawerOpen(true)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 text-[11px] font-bold transition-colors"
                        >
                          Breakdown
                        </button>

                        {/* Direct Accept / Award for Buyer */}
                        {isBuyer && rfqStatus !== "closed" && (
                          <>
                            {isAccepted ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                                <Award className="w-3 h-3 text-emerald-600" />
                                Awarded
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={isAccepting === q.id}
                                onClick={() => handleAcceptQuote(q.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1.5 font-bold shadow-2xs"
                              >
                                {isAccepting === q.id ? "Accepting..." : "Accept"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Comparison Drawer */}
      <QuoteCompareDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        quotes={quotes}
        aiRecommendation={aiRecommendation}
        onAcceptQuote={isBuyer ? handleAcceptQuote : undefined}
        isAccepting={!!isAccepting}
      />
    </div>
  );
};
