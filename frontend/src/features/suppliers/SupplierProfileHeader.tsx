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
    </div>
  );
};
