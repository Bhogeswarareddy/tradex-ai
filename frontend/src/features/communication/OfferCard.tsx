import React, { useState } from "react";
import {
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  DollarSign,
} from "lucide-react";
import { OfferData, communicationApi } from "../../lib/api/communication";
import { Button } from "../../components/ui/Button";

interface OfferCardProps {
  messageId: string;
  offer: OfferData;
  isMe: boolean;
  onOfferUpdated?: () => void;
  onOpenCounter?: (offer: OfferData) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({
  messageId,
  offer,
  isMe,
  onOfferUpdated,
  onOpenCounter,
}) => {
  const [loading, setLoading] = useState(false);
  const totalAmount = offer.price * (offer.quantity || 20000);

  const handleAccept = async () => {
    if (!window.confirm(`Accept counter-offer rate of €${offer.price.toFixed(2)}/kg?`)) return;
    setLoading(true);
    try {
      await communicationApi.acceptOffer(messageId);
      if (onOfferUpdated) onOfferUpdated();
    } catch (err: any) {
      alert(err.message || "Failed to accept offer");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm("Reject this proposed counter-offer?")) return;
    setLoading(true);
    try {
      await communicationApi.rejectOffer(messageId);
      if (onOfferUpdated) onOfferUpdated();
    } catch (err: any) {
      alert(err.message || "Failed to reject offer");
    } finally {
      setLoading(false);
    }
  };

  const isPending = offer.status === "pending";
  const isAccepted = offer.status === "accepted";
  const isRejected = offer.status === "rejected";

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3.5 my-2 text-xs shadow-xs transition-all ${
        isAccepted
          ? "bg-emerald-50/70 border-emerald-300"
          : isRejected
          ? "bg-rose-50/50 border-rose-200 opacity-80"
          : "bg-white border-blue-200 ring-1 ring-blue-500/10"
      }`}
    >
      {/* Header with status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Tag className="w-4 h-4 text-blue-600" />
          <span>Formal Counter-Offer Proposal</span>
        </div>

        <div>
          {isAccepted && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Accepted
            </span>
          )}
          {isRejected && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center gap-1 text-[11px]">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Declined
            </span>
          )}
          {isPending && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Pending Response
            </span>
          )}
        </div>
      </div>

      {/* Structured Terms Grid */}
      <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div>
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Proposed Price</span>
          <span className="text-base font-black text-slate-900">
            €{offer.price.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500"> / {offer.unit || "kg"}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Quantity</span>
          <span className="text-sm font-bold text-slate-800">
            {offer.quantity?.toLocaleString() || "20,000"}
          </span>
          <span className="text-[10px] text-slate-500"> {offer.unit || "kg"}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lead Time</span>
          <span className="text-sm font-bold text-slate-800">
            {offer.lead_time_days || 25}
          </span>
          <span className="text-[10px] text-slate-500"> days</span>
        </div>
      </div>

      {/* Total amount summary & note */}
      <div className="flex flex-wrap items-center justify-between text-slate-600 gap-2">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          <span>Estimated Total: <strong className="text-slate-900">€{totalAmount.toLocaleString()}</strong></span>
        </div>

        {offer.notes && (
          <span className="italic text-[11px] text-slate-500 max-w-xs truncate" title={offer.notes}>
            "{offer.notes}"
          </span>
        )}
      </div>

      {/* Recipient Action Buttons when pending */}
      {!isMe && isPending && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleReject}
            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 px-3 py-1.5"
          >
            Reject
          </Button>

          {onOpenCounter && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onOpenCounter(offer)}
              className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-3 py-1.5 flex items-center gap-1 font-bold"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Counter-Offer
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading}
            onClick={handleAccept}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 shadow-2xs"
          >
            Accept Offer
          </Button>
        </div>
      )}
    </div>
  );
};
