import React from "react";
import {
  Clock,
  MapPin,
  Package,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { RFQDetail } from "../../lib/api/rfqs";
import { Button } from "../../components/ui/Button";

interface RfqHeaderCardProps {
  rfq: RFQDetail;
  isBuyer: boolean;
  onInviteSuppliers?: () => void;
  onCloseRfq?: () => void;
  onCancelRfq?: () => void;
  onPublishRfq?: () => void;
}

export const RfqHeaderCard: React.FC<RfqHeaderCardProps> = ({
  rfq,
  isBuyer,
  onInviteSuppliers,
  onCloseRfq,
  onCancelRfq,
  onPublishRfq,
}) => {
  const isExpired = rfq.deadline ? new Date(rfq.deadline) < new Date() : false;
  const statusColor =
    rfq.status === "active" || rfq.status === "evaluating"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
      : rfq.status === "awarded"
      ? "bg-blue-50 text-blue-700 border-blue-300"
      : rfq.status === "closed"
      ? "bg-slate-100 text-slate-700 border-slate-300"
      : "bg-amber-50 text-amber-700 border-amber-300";

  const flagEmoji =
    rfq.destination_country === "Germany"
      ? "🇩🇪"
      : rfq.destination_country === "France"
      ? "🇫🇷"
      : rfq.destination_country === "USA"
      ? "🇺🇸"
      : rfq.destination_country === "UAE"
      ? "🇦🇪"
      : "🌐";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Top Bar: RFQ Number, Status, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {rfq.rfq_number}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColor}`}
            >
              {rfq.status}
            </span>
            {rfq.quotes_count > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                ({rfq.quotes_count} {rfq.quotes_count === 1 ? "quote" : "quotes"} submitted)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            {rfq.title}
          </h1>
        </div>

        {/* Action buttons */}
        {isBuyer && (
          <div className="flex flex-wrap items-center gap-2">
            {onPublishRfq && rfq.status === "draft" && (
              <Button
                variant="primary"
                size="sm"
                onClick={onPublishRfq}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <span>Publish RFQ</span>
              </Button>
            )}

            {onInviteSuppliers && (rfq.status === "active" || rfq.status === "open") && (
              <Button
                variant="outline"
                size="sm"
                onClick={onInviteSuppliers}
                className="flex items-center gap-1.5 text-xs border-slate-300 hover:bg-slate-50"
              >
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Invite Suppliers</span>
              </Button>
            )}

            {onCloseRfq && (rfq.status === "active" || rfq.status === "open") && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCloseRfq}
                className="flex items-center gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Close Bidding</span>
              </Button>
            )}

            {onCancelRfq && (rfq.status === "active" || rfq.status === "draft" || rfq.status === "open") && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelRfq}
                className="flex items-center gap-1.5 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Cancel RFQ</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Grid of Key Trade Specifications (matching reference header) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Quantity & Unit */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span>Quantity</span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {rfq.quantity.toLocaleString()} {rfq.unit}
          </div>
        </div>

        {/* Destination Port & Country */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <MapPin className="w-3.5 h-3.5 text-purple-500" />
            <span>Destination</span>
          </div>
          <div className="text-base font-bold text-slate-900 truncate flex items-center gap-1.5">
            <span>{flagEmoji}</span>
            <span>
              {rfq.destination_port}, {rfq.destination_country}
            </span>
          </div>
        </div>

        {/* Target Price */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Target Price Range</span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {rfq.currency} {rfq.target_price_min?.toFixed(2)} &ndash; {rfq.target_price_max?.toFixed(2)}
          </div>
        </div>

        {/* Incoterm & Terms */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Incoterm & Payment</span>
          </div>
          <div className="text-base font-bold text-slate-900 truncate">
            {rfq.incoterm} &bull; {rfq.payment_terms || "LC at sight"}
          </div>
        </div>

        {/* Bidding Deadline */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Bidding Deadline</span>
          </div>
          <div
            className={`text-base font-bold ${
              isExpired ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Open"}
          </div>
        </div>
      </div>

      {/* Required Certifications Chips */}
      {rfq.required_certifications && rfq.required_certifications.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Required Audits:
          </span>
          {rfq.required_certifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {cert}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
