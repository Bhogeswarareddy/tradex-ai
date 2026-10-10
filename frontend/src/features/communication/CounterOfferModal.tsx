import React, { useState } from "react";
import { X, ArrowRightLeft, Send } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { communicationApi, CounterOfferInput } from "../../lib/api/communication";

interface CounterOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  initialPrice?: number;
  initialQuantity?: number;
  initialLeadTime?: number;
  onSuccess?: () => void;
}

export const CounterOfferModal: React.FC<CounterOfferModalProps> = ({
  isOpen,
  onClose,
  quoteId,
  initialPrice = 3.05,
  initialQuantity = 20000,
  initialLeadTime = 22,
  onSuccess,
}) => {
  const [price, setPrice] = useState(initialPrice);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [leadTime, setLeadTime] = useState(initialLeadTime);
  const [note, setNote] = useState("Proposing adjusted rate based on volume commitment.");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0) {
      setError("Please enter a valid target unit price.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CounterOfferInput = {
        price,
        quantity,
        lead_time_days: leadTime,
        note,
      };
      await communicationApi.submitCounterOffer(quoteId, payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit counter-offer");
    } finally {
      setSubmitting(false);
    }
  };

  const totalEstimate = price * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Submit Counter-Offer</h3>
              <p className="text-xs text-slate-500">Negotiate commercial terms and delivery lead time</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Unit Price (€/kg)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">€</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Order Quantity (kg)
              </label>
              <input
                type="number"
                step="500"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Requested Lead Time (Days)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={leadTime}
              onChange={(e) => setLeadTime(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Negotiation Note / Commercial Rationale
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800"
              placeholder="e.g. Willing to increase volume to 25 MT if price can meet €3.05 CIF Hamburg."
            />
          </div>

          {/* Value Summary Callout */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Projected Contract Value:</span>
            <span className="text-sm font-black text-blue-700">€{totalEstimate.toLocaleString()}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 px-4"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Transmitting..." : "Send Counter-Offer"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
