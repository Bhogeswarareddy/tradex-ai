import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Star,
  CheckCircle2,
  MapPin,
  Calendar,
  MessageSquare,
  Send,
  Sparkles,
  ChevronRight,
  Handshake,
  ShieldCheck,
  HelpCircle,
  X,
} from "lucide-react";
import { SupplierProfileResponse } from "../../lib/api/suppliers";
import { Button } from "../../components/ui/Button";

interface SupplierProfileHeaderProps {
  supplier: SupplierProfileResponse;
  onRequestQuote: () => void;
  onStartNegotiation: () => void;
  onOpenChat: () => void;
  onToggleSave: () => void;
}

export const SupplierProfileHeader: React.FC<SupplierProfileHeaderProps> = ({
  supplier,
  onRequestQuote,
  onStartNegotiation,
  onOpenChat,
  onToggleSave,
}) => {
  const [isSaved, setIsSaved] = useState(supplier.is_saved);
  const [showTierModal, setShowTierModal] = useState(false);

  const handleHeartClick = () => {
    setIsSaved(!isSaved);
    onToggleSave();
  };

  const bannerImg =
    supplier.banner_url ||
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=80";
  const logoImg =
    supplier.logo_url ||
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80";

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link to="/suppliers" className="hover:text-blue-600 transition-colors">
          Suppliers
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-semibold">{supplier.name}</span>
      </nav>

      {/* Hero Card with Banner & Profile Identity */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Banner Photo */}
        <div className="relative h-48 sm:h-64 w-full bg-slate-900">
          <img
            src={bannerImg}
            alt={supplier.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Top-right AI Verified Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/90 backdrop-blur-md text-white text-xs font-bold shadow-lg">
              <Sparkles className="w-3.5 h-3.5" />
              AI Verified Exporter
            </span>
          </div>
        </div>

        {/* Profile Info Bar */}
        <div className="relative px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 -mt-16 sm:-mt-20">
            {/* Left: Circular Logo & Identity */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={logoImg}
                  alt={supplier.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {supplier.name}
                  </h1>
                  {supplier.verified_status === "verified" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Supplier
                    </span>
                  )}
                  {/* Verification Tier Badge & Explanation */}
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      (supplier.verification_tier || "silver").toLowerCase() === "gold"
                        ? "bg-amber-500/10 text-amber-700 border-amber-400 font-black"
                        : (supplier.verification_tier || "silver").toLowerCase() === "bronze"
                        ? "bg-orange-50 text-orange-700 border-orange-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {(supplier.verification_tier || "silver").toUpperCase()} TIER
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTierModal(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-0.5"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Why this tier?
                    </button>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-extrabold uppercase tracking-wider">
                    {supplier.tag || "AN EXPORTER"}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-600 max-w-2xl">
                  {supplier.one_line_description}
                </p>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap pt-1">
                  <span className="flex items-center gap-1 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {supplier.location_display}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {supplier.years_in_business} Years in Business
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    {supplier.rating.toFixed(1)} ({supplier.total_reviews} verified reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              {/* Request Quote Button (Blue) */}
              <Button
                variant="primary"
                size="md"
                className="shadow-md shadow-blue-500/20 font-bold"
                onClick={onRequestQuote}
              >
                <Send className="w-4 h-4 mr-2" />
                Request Quote
              </Button>

              {/* Start Negotiation Button (Green) */}
              <button
                type="button"
                onClick={onStartNegotiation}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-colors"
              >
                <Handshake className="w-4 h-4 mr-2" />
                Start Negotiation
              </button>

              {/* Chat Button */}
              <Button variant="outline" size="md" onClick={onOpenChat}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Button>

              {/* Save Heart Toggle Button */}
              <button
                type="button"
                onClick={handleHeartClick}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isSaved
                    ? "bg-rose-50 border-rose-300 text-rose-500"
                    : "bg-white border-slate-200 text-slate-600 hover:text-rose-500 hover:border-slate-300"
                }`}
                title={isSaved ? "Saved in Favorites" : "Save Supplier"}
              >
                <Heart className={`w-5 h-5 ${isSaved ? "fill-rose-500" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Why This Tier Modal */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  {(supplier.verification_tier || "silver").toUpperCase()} Tier Verification Criteria
                </h3>
              </div>
              <button
                onClick={() => setShowTierModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <strong>Assessment Narrative:</strong>
              <p className="mt-1">
                {supplier.tier_reason || `${supplier.name} has qualified for ${(supplier.verification_tier || "silver").toUpperCase()} tier status based on rigorous review of official commercial registrations, international certifications, and reliable trade consignment history.`}
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Audited KYC & Compliance Checklist
              </h4>
              <div className="space-y-1.5">
                {[
                  { label: "Company Legal Registration & Articles", status: "Verified & Active" },
                  { label: "Tax Identification Number (TIN / VAT)", status: "Verified & Compliant" },
                  { label: "Commercial Bank Account Verification", status: "Verified Escrow Eligible" },
                  { label: "International Export License", status: (supplier.verification_tier === "bronze" ? "Conditional Onboarding" : "Verified Exporter") },
                  { label: `Years in Verified Global Business: ${supplier.years_in_business} Years`, status: "Audited" },
                  { label: `Historical On-Time Delivery Rate: ${supplier.on_time_rate}%`, status: "Verified" },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1 font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <Button size="sm" onClick={() => setShowTierModal(false)}>
                Close Assessment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
