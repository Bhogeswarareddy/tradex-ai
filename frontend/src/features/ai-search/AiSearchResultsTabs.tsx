import React from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Building2,
  Star,
  MapPin,
  Package,
  ExternalLink,
} from "lucide-react";
import { AiMatchedSupplier, AiMatchedProduct } from "../../lib/api/aiSearch";
import { Button } from "../../components/ui/Button";

interface AiSearchResultsTabsProps {
  activeTab: "suppliers" | "products";
  onTabChange: (tab: "suppliers" | "products") => void;
  suppliers: AiMatchedSupplier[];
  products: AiMatchedProduct[];
  onRequestQuote: (supplierId: string, supplierName: string) => void;
  onOpenBreakdown?: (supplier: any) => void;
}

export const AiSearchResultsTabs: React.FC<AiSearchResultsTabsProps> = ({
  activeTab,
  onTabChange,
  suppliers,
  products,
  onRequestQuote,
  onOpenBreakdown,
}) => {
  return (
    <div className="space-y-6">
      {/* Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onTabChange("suppliers")}
            className={`pb-3 px-1 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "suppliers"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Matched Suppliers</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "suppliers"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("products")}
            className={`pb-3 px-1 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "products"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catalog Products</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "products"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {products.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          {suppliers.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No matching suppliers found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Try loosening origin country, certification, or lead time filters using the editable chips above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {suppliers.map((s) => {
                const matchScore = s.match_score || 95;
                const scoreColor =
                  matchScore >= 90
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : matchScore >= 75
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-amber-50 text-amber-700 border-amber-300";

                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 p-5 sm:p-6 flex flex-col md:flex-row gap-5 justify-between items-start"
                  >
                    {/* Left: Supplier info & reasons */}
                    <div className="space-y-4 flex-1">
                      {/* Company Header */}
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {s.logo_url ? (
                            <img
                              src={s.logo_url}
                              alt={s.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-7 h-7 text-slate-400" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/suppliers/${s.id}`}
                              className="text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors"
                            >
                              {s.name}
                            </Link>

                            {s.verified_status === "verified" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {s.city ? `${s.city}, ${s.country}` : s.country}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <strong className="text-slate-700">{s.rating || 4.9}</strong>
                              <span>({s.total_reviews || 28} reviews)</span>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Capacity:{" "}
                              <strong className="text-slate-700">
                                {s.capacity_per_month || "50 MT/mo"}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Why it matched section (3 bullet points) */}
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-1.5">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Why this supplier matched your requirements:</span>
                          </div>
                          {onOpenBreakdown && (
                            <button
                              type="button"
                              onClick={() => onOpenBreakdown(s)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
                            >
                              Why this score?
                            </button>
                          )}
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1 pl-1">
                          {s.match_reasons && s.match_reasons.length > 0 ? (
                            s.match_reasons.slice(0, 3).map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-blue-500 font-bold">&bull;</span>
                                <span>{reason.replace(/^•\s*/, "")}</span>
                              </li>
                            ))
                          ) : (
                            <>
                              <li className="flex items-start gap-1.5">
                                <span className="text-blue-500 font-bold">&bull;</span>
                                <span>Direct exporter matching specified origin country and commodity specifications</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <span className="text-blue-500 font-bold">&bull;</span>
                                <span>High on-time fulfillment track record ({s.on_time_rate || 98}%)</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <span className="text-blue-500 font-bold">&bull;</span>
                                <span>Meets required international trade standards and quantity scale</span>
                              </li>
                            </>
                          )}
                        </ul>

                        {/* Trade Risks as amber warning line */}
                        {(s as any).risks && (s as any).risks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/60 px-2.5 py-1 rounded-lg border border-amber-200/80">
                            <span className="font-bold text-amber-600">⚠️ Risk:</span>
                            <span>{(s as any).risks[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Circular Match Score Ring & Actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-shrink-0">
                      {/* Circular Match Score Ring */}
                      <div className="flex items-center gap-3 md:flex-col md:items-end">
                        <div className="relative w-14 h-14 flex items-center justify-center">
                          <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-100"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className={`${
                                matchScore >= 80
                                  ? "text-emerald-500 stroke-emerald-500"
                                  : matchScore >= 60
                                  ? "text-amber-500 stroke-amber-500"
                                  : "text-rose-500 stroke-rose-500"
                              } transition-all duration-700 ease-out`}
                              strokeDasharray="100, 100"
                              strokeDashoffset={100 - matchScore}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xs font-black text-slate-800">{Math.round(matchScore)}</span>
                            <span className="text-[9px] font-bold text-slate-400 -mt-1">%</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}
                          >
                            {matchScore >= 80 ? "High Match" : matchScore >= 60 ? "Moderate Match" : "Low Match"}
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                            Trust: {s.trust_score || 95}/100
                          </div>
                        </div>
                      </div>

                      {/* CTA Buttons */}
                      <div className="flex items-center gap-2">
                        <Link to={`/suppliers/${s.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex items-center gap-1 border-slate-300 hover:bg-slate-50"
                          >
                            <span>Profile</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onRequestQuote(s.id, s.name)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        >
                          Request Quote
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Products */}
      {activeTab === "products" && (
        <div>
          {products.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200">
              <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No matching products found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Try searching for related commodities or relaxing specification chips above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* Product Image */}
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={
                        p.image_url ||
                        "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={p.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-semibold backdrop-blur-sm">
                      {p.category_name}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <Link
                        to={`/products/${p.slug}`}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                      >
                        {p.name}
                      </Link>

                      <div className="text-xs text-slate-500 mt-0.5">
                        By{" "}
                        <Link
                          to={`/suppliers/${p.supplier_id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {p.supplier_name}
                        </Link>{" "}
                        ({p.supplier_country})
                      </div>

                      {/* Specs */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block">Price:</span>
                          <span className="font-semibold text-slate-800">
                            {p.currency} ${p.price_min?.toFixed(2)} - ${p.price_max?.toFixed(2)} /{" "}
                            {p.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">MOQ:</span>
                          <span className="font-semibold text-slate-800">
                            {p.moq?.toLocaleString()} {p.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Origin:</span>
                          <span className="font-semibold text-slate-800">{p.origin_country}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Lead Time:</span>
                          <span className="font-semibold text-slate-800">
                            {p.lead_time_days} days
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-2">
                      <Link to={`/products/${p.slug}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-slate-300"
                        >
                          View Details
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onRequestQuote(p.supplier_id, p.supplier_name)}
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Request Quote
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
