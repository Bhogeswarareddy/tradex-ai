import React, { useState, useEffect } from "react";
import {
  FileText,
  Sparkles,
  Send,
  Clock,
  Globe,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { supplierPortalApi } from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useCurrency } from "../settings/SettingsContext";

interface SupplierRfqsViewProps {
  onNavigateToInquiries?: () => void;
}

export const SupplierRfqsView: React.FC<SupplierRfqsViewProps> = ({ onNavigateToInquiries }) => {
  const { formatPrice } = useCurrency();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer & Quote Modal
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteUnitPrice, setQuoteUnitPrice] = useState("");
  const [quoteMoq, setQuoteMoq] = useState("500");
  const [quoteLeadDays, setQuoteLeadDays] = useState("14");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("LC at sight");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteSuccessMsg, setQuoteSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRfqs();
  }, []);

  const loadRfqs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supplierPortalApi.getRfqs(1, 20);
      setRfqs(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load RFQ opportunities.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenQuoteModal = (rfq: any) => {
    setSelectedRfq(rfq);
    setQuoteUnitPrice(String(rfq.target_price_max || rfq.target_price_min || ""));
    setQuoteMoq(String(rfq.quantity ? Math.min(500, rfq.quantity) : 500));
    setQuoteLeadDays("14");
    setQuotePaymentTerms("LC at sight");
    setQuoteNotes("");
    setQuoteSuccessMsg(null);
    setIsQuoteModalOpen(true);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq || !quoteUnitPrice) return;
    setIsSubmittingQuote(true);
    try {
      await supplierPortalApi.submitQuote(selectedRfq.id, {
        unit_price: parseFloat(quoteUnitPrice),
        moq: parseInt(quoteMoq) || 500,
        lead_time_days: parseInt(quoteLeadDays) || 14,
        payment_terms: quotePaymentTerms,
        notes: quoteNotes,
      });
      setQuoteSuccessMsg("Quote successfully dispatched to buyer!");
      setTimeout(() => {
        setIsQuoteModalOpen(false);
        setQuoteSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message || "Failed to submit quote");
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <Button variant="primary" size="sm" onClick={loadRfqs}>
          Retry Loading RFQs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Active RFQ Opportunities ({rfqs.length})
          </h3>
          <p className="text-xs text-slate-500">
            Open international buyer tenders matched to your export catalog by TradeX AI
          </p>
        </div>
      </div>

      {rfqs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">No Active RFQs Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no open buyer requests matching your published export categories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-mono font-bold text-blue-600">{rfq.rfq_number}</div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    {rfq.match_score}% Match
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                  {rfq.title}
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Volume</span>
                    <span className="font-bold text-slate-800">
                      {rfq.quantity?.toLocaleString()} {rfq.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Price</span>
                    <span className="font-bold text-slate-800">
                      {formatPrice(rfq.target_price_max || rfq.target_price_min, rfq.currency || "USD").formatted} / {rfq.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" />
                      {rfq.destination_port}, {rfq.destination_country}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Deadline</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {rfq.deadline_display || rfq.deadline}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenQuoteModal(rfq)}
                  className="flex-1 text-xs font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Submit Quote
                </Button>
                {onNavigateToInquiries && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToInquiries}
                    className="text-xs font-semibold text-slate-600"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote Submission Modal */}
      {isQuoteModalOpen && selectedRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Submit Quotation</h3>
                <p className="text-xs text-slate-500">{selectedRfq.rfq_number}: {selectedRfq.title}</p>
              </div>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quoteSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-emerald-900 text-sm">{quoteSuccessMsg}</h4>
                <p className="text-xs text-slate-500">The buyer will be notified via email and TradeX chat.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Unit Price (${selectedRfq.currency}/{selectedRfq.unit}) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={quoteUnitPrice}
                      onChange={(e) => setQuoteUnitPrice(e.target.value)}
                      required
                      className="text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Minimum Order Qty ({selectedRfq.unit})</label>
                    <Input
                      type="number"
                      value={quoteMoq}
                      onChange={(e) => setQuoteMoq(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Dispatch Lead Time (Days)</label>
                    <Input
                      type="number"
                      value={quoteLeadDays}
                      onChange={(e) => setQuoteLeadDays(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Payment Terms</label>
                    <Input
                      value={quotePaymentTerms}
                      onChange={(e) => setQuotePaymentTerms(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quotation Notes & Specification Compliance</label>
                  <textarea
                    rows={3}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Enter details on certifications, port dispatch guarantees, packaging..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQuoteModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmittingQuote}
                    className="font-bold text-xs"
                  >
                    {isSubmittingQuote ? "Submitting..." : "Send Official Quote"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
