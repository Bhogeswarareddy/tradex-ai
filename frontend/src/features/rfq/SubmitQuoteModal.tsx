import React, { useState } from "react";
import { X, Send } from "lucide-react";
import { rfqsApi } from "../../lib/api/rfqs";
import { Button } from "../../components/ui/Button";

interface SubmitQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqId: string;
  rfqNumber: string;
  onSuccess: (quoteNumber: string) => void;
}

export const SubmitQuoteModal: React.FC<SubmitQuoteModalProps> = ({
  isOpen,
  onClose,
  rfqId,
  rfqNumber,
  onSuccess,
}) => {
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [moq, setMoq] = useState("1000");
  const [leadTimeDays, setLeadTimeDays] = useState("18");
  const [validUntil, setValidUntil] = useState("2026-11-30");
  const [paymentTerms, setPaymentTerms] = useState("LC at sight, 30% advance");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitPrice || Number(unitPrice) <= 0) {
      setError("Please specify a valid unit price");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        unit_price: Number(unitPrice),
        currency,
        moq: Number(moq) || 1000,
        lead_time_days: Number(leadTimeDays) || 20,
        valid_until: validUntil || undefined,
        payment_terms: paymentTerms,
        notes: notes.trim() || undefined,
      };
      const result = await rfqsApi.submitQuote(rfqId, payload);
      onSuccess(result.quote_number);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Supplier Bidding Portal
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                Submit Quote for {rfqNumber}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price *</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="2.85"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none pr-14"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="absolute right-1 text-xs border-0 bg-transparent font-bold text-slate-600 focus:outline-none"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Order Qty</label>
                <input
                  type="number"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  placeholder="1000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Production Lead Time (Days)</label>
                <input
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  placeholder="18"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bid Validity Date</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment & Escrow Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. 100% Irrevocable LC at sight or Escrow"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes & Commercial Conditions</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Include details about packaging, COA certificate attachments, or volume discounts."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs border-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Submitting..." : "Send Quotation"}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
