import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { RecommendedSupplierCard } from "../../lib/api/dashboard";
import { Button } from "../../components/ui/Button";

interface RecommendedSuppliersSectionProps {
  suppliers: RecommendedSupplierCard[];
  isLoading?: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onToggleSave?: (supplierId: string, current: boolean) => void;
}

const TABS = [
  { id: "top_match", label: "Top Match" },
  { id: "verified", label: "Verified" },
  { id: "best_price", label: "Best Price" },
  { id: "fast_delivery", label: "Fast Delivery" },
  { id: "organic_certified", label: "Organic Certified" },
];

export const RecommendedSuppliersSection: React.FC<RecommendedSuppliersSectionProps> = ({
  suppliers,
  isLoading,
  activeTab,
  onTabChange,
  onToggleSave,
}) => {
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const handleHeartClick = (e: React.MouseEvent, sId: string, currentSaved: boolean) => {
    e.stopPropagation();
    const nextState = !savedMap[sId] ? !currentSaved : !savedMap[sId];
    setSavedMap((prev) => ({ ...prev, [sId]: nextState }));
    if (onToggleSave) onToggleSave(sId, currentSaved);
  };

  return (
    <section className="space-y-5">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Recommended Suppliers for You
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-[#2563EB] px-2 py-0.5 rounded-full border border-blue-200">
              <Sparkles className="w-3 h-3 text-[#2563EB]" />
              AI Matched
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-audited global exporters ranked by reliability, compliance, and trade capacity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/suppliers"
            className="text-xs font-bold text-[#2563EB] hover:text-blue-800 flex items-center gap-1 shrink-0 group"
          >
            <span>View All Suppliers</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-white rounded-[12px] border border-slate-200 p-4 space-y-3 animate-pulse"
              >
                <div className="h-36 bg-slate-100 rounded-lg" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-10 bg-slate-100 rounded" />
              </div>
            ))
          : suppliers.map((supplier) => {
              const isSaved =
                savedMap[supplier.id] !== undefined
                  ? savedMap[supplier.id]
                  : supplier.is_saved;

              return (
                <div
                  key={supplier.id}
                  className="bg-white rounded-[12px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Cover Photo Header */}
                    <div className="relative h-36 bg-slate-100 overflow-hidden">
                      <img
                        src={supplier.cover_image_url}
                        alt={supplier.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* Dark overlay top */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                      {/* Verified Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      </div>

                      {/* Save Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => handleHeartClick(e, supplier.id, supplier.is_saved)}
                        className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-colors ${
                          isSaved
                            ? "bg-rose-50 text-rose-600 shadow"
                            : "bg-slate-900/40 text-white hover:bg-white hover:text-slate-900"
                        }`}
                        aria-label="Save supplier"
                      >
                        <Heart
                          className={`w-4 h-4 ${isSaved ? "fill-rose-500 text-rose-500" : ""}`}
                        />
                      </button>

                      {/* Trust Score Tag at bottom of cover */}
                      <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 text-white text-xs font-semibold">
                        <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded font-mono">
                          Score: {supplier.trust_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-4 space-y-3">
                      {/* Name & Origin */}
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1 group-hover:text-[#2563EB] transition-colors">
                          {supplier.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{supplier.flag}</span>
                          <span className="font-medium text-slate-700">{supplier.country}</span>
                          <span>•</span>
                          <span>{supplier.years_in_business} yrs in business</span>
                        </p>
                      </div>

                      {/* Rating & Review Count */}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                          <span className="font-bold text-slate-800">
                            {supplier.rating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-slate-400">({supplier.review_count} reviews)</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded">
                          {supplier.on_time_rate.toFixed(0)}% on-time
                        </span>
                      </div>

                      {/* Trade Specs: Monthly capacity & MOQ */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-slate-400 flex items-center gap-1 text-[10px]">
                            <Layers className="w-3 h-3 text-slate-400" />
                            <span>Capacity</span>
                          </p>
                          <p className="font-bold text-slate-800 mt-0.5">{supplier.capacity_per_month}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 flex items-center gap-1 text-[10px]">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span>MOQ</span>
                          </p>
                          <p className="font-bold text-slate-800 mt-0.5">{supplier.moq}</p>
                        </div>
                      </div>

                      {/* Certifications Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {supplier.certifications.map((cert) => (
                          <span
                            key={cert}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/suppliers`)}
                      className="text-xs"
                    >
                      View Profile
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/rfq?supplierId=${supplier.id}`)}
                      className="text-xs"
                    >
                      Request Quote
                    </Button>
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
};
