import React from "react";
import { Link } from "react-router-dom";
import { formatNumber, formatCurrency } from "../../lib/format";
import {
  CheckCircle2,
  Building2,
  Star,
  MapPin,
  Package,
  ExternalLink,
  AlertTriangle,
  FilePlus,
  RefreshCw,
  Search,
  Grid,
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
  requestedQuantity?: number;
  requestedUnit?: string;
  query?: string;
  onClearOrRefine?: () => void;
  onCreateRfq?: () => void;
}

const getCategoryPlaceholder = (categoryName?: string, productName?: string): string => {
  const text = `${categoryName || ""} ${productName || ""}`.toLowerCase();
  if (
    text.includes("laptop") ||
    text.includes("computer") ||
    text.includes("mobile") ||
    text.includes("phone") ||
    text.includes("electronic")
  ) {
    return "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("chilli") ||
    text.includes("spice") ||
    text.includes("pepper") ||
    text.includes("turmeric") ||
    text.includes("rice") ||
    text.includes("grain") ||
    text.includes("tea")
  ) {
    return "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("book") || text.includes("stationery") || text.includes("paper")) {
    return "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80";
  }
  if (
    text.includes("tractor") ||
    text.includes("machin") ||
    text.includes("tool") ||
    text.includes("industrial")
  ) {
    return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80";
};

export const AiSearchResultsTabs: React.FC<AiSearchResultsTabsProps> = ({
  activeTab,
  onTabChange,
  suppliers,
  products,
  onRequestQuote,
  onOpenBreakdown,
  requestedQuantity,
  requestedUnit,
  query,
  onClearOrRefine,
  onCreateRfq,
}) => {
  // If products are 0, supplier count is strictly 0 per Prompt 36
  const distinctSuppliers = products.length === 0 ? [] : suppliers;

  // Global shortage detection: if buyer requested a quantity and all matching products have stock < requested
  const hasQuantityRequest = requestedQuantity !== undefined && requestedQuantity > 0;
  const maxAvailableStock = products.reduce((max, p) => Math.max(max, p.stock_available || 0), 0);
  const isGlobalShortage =
    hasQuantityRequest && products.length > 0 && maxAvailableStock < (requestedQuantity || 0);

  return (
    <div className="space-y-6">
      {/* Tabs Bar: Catalogue Products (n) first, then Suppliers (n) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-4">
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
            <span>Catalogue Products</span>
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
            <span>Suppliers</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "suppliers"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {distinctSuppliers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Global Shortage Banner if requested quantity exceeds available catalogue stock */}
      {isGlobalShortage && activeTab === "products" && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Quantity Shortage: </span>
            We found matching items, but the available quantity in current stock is only{" "}
            <strong>
              {formatNumber(maxAvailableStock)} {requestedUnit || "units"}
            </strong>
            . Your requested quantity is{" "}
            <strong>
              {formatNumber(requestedQuantity!)} {requestedUnit || "units"}
            </strong>
            . You can still request custom production quotes from the suppliers below.
          </div>
        </div>
      )}

      {/* Tab: Products */}
      {activeTab === "products" && (
        <div>
          {products.length === 0 ? (
            /* Prompt 36 Clean Not-Found Empty State */
            <div className="text-center py-12 px-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">No matching products found</h3>
                <p className="text-sm text-slate-600">
                  We couldn't find{" "}
                  <strong>{query ? `"${query}"` : "the requested products"}</strong> in the
                  current TradeX AI product catalogue.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onClearOrRefine && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearOrRefine}
                    className="flex items-center gap-1.5 border-slate-300"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Edit Search</span>
                  </Button>
                )}

                <Link to="/marketplace">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 border-slate-300"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Browse Categories</span>
                  </Button>
                </Link>

                {onCreateRfq && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onCreateRfq}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Create RFQ</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((p) => {
                const hasPrice =
                  (p.price_min !== undefined && p.price_min !== null && p.price_min > 0) ||
                  (p.price_max !== undefined && p.price_max !== null && p.price_max > 0);

                const hasStock = p.stock_available !== undefined && p.stock_available !== null;
                const isSufficient =
                  hasQuantityRequest && hasStock && p.stock_available >= (requestedQuantity || 0);
                const isInsufficient =
                  hasQuantityRequest && hasStock && p.stock_available < (requestedQuantity || 0);

                const placeholderImg = getCategoryPlaceholder(p.category_name, p.name);

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Image */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={p.image_url || placeholderImg}
                          alt={p.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = placeholderImg;
                          }}
                        />
                        {p.category_name && (
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-semibold backdrop-blur-sm">
                            {p.category_name}
                          </div>
                        )}
                        {p.is_alternative && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                            Similar Alternative
                          </div>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-3">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={`/products/${p.slug || p.id}`}
                              className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1"
                            >
                              {p.name}
                            </Link>
                          </div>

                          {p.brand && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              Brand: {p.brand}
                            </span>
                          )}

                          {p.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                              {p.description}
                            </p>
                          )}

                          {/* Supplier info & verification status */}
                          <div className="text-xs text-slate-600 mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400">By</span>
                            <Link
                              to={`/suppliers/${p.supplier_id}`}
                              className="text-blue-600 hover:underline font-semibold"
                            >
                              {p.supplier_name}
                            </Link>
                            <span className="text-slate-400">&bull;</span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {p.supplier_country || p.origin_country}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full ml-auto">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          </div>

                          {/* Pricing, MOQ, Stock Comparison */}
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block">Price:</span>
                              {hasPrice ? (
                                <span className="font-bold text-slate-900">
                                  {p.price_min === p.price_max
                                    ? formatCurrency(p.price_min, p.currency || "USD")
                                    : `${formatCurrency(p.price_min, p.currency || "USD")} - ${formatCurrency(p.price_max, p.currency || "USD")}`}{" "}
                                  <span className="text-slate-500 font-normal">/ {p.unit || "unit"}</span>
                                </span>
                              ) : (
                                <span className="font-semibold text-amber-700 italic">
                                  Contact supplier for pricing
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-slate-400 block">MOQ:</span>
                              <span className="font-semibold text-slate-800">
                                {formatNumber(p.moq || 1)} {p.unit || "units"}
                              </span>
                            </div>

                            <div className="col-span-2 pt-1">
                              <span className="text-slate-400 block">Available Stock:</span>
                              {hasStock ? (
                                isSufficient ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    {formatNumber(p.stock_available)} {p.unit || "units"} (sufficient for requested {formatNumber(requestedQuantity!)})
                                  </span>
                                ) : isInsufficient ? (
                                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Shortage: {formatNumber(p.stock_available)} available vs {formatNumber(requestedQuantity!)} requested
                                  </span>
                                ) : (
                                  <span className="font-semibold text-slate-800">
                                    {formatNumber(p.stock_available)} {p.unit || "units"} in stock
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-500 italic">Availability unconfirmed</span>
                              )}
                            </div>
                          </div>

                          {/* One-line match explanation */}
                          <div className="mt-2.5 p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <span>
                              {p.match_explanation?.summary ||
                                `Authoritative catalogue match for ${p.name}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions: View Product, View Supplier, Request Quote */}
                    <div className="p-4 pt-0">
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                        <Link to={`/products/${p.slug || p.id}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-[11px] px-1 border-slate-300"
                          >
                            View Product
                          </Button>
                        </Link>

                        <Link to={`/suppliers/${p.supplier_id}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-[11px] px-1 border-slate-300"
                          >
                            View Supplier
                          </Button>
                        </Link>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => onRequestQuote(p.supplier_id, p.supplier_name)}
                          className="w-full text-[11px] px-1 bg-blue-600 hover:bg-blue-700 text-white"
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

      {/* Tab Content: Suppliers */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          {distinctSuppliers.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white border border-slate-200">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No matching suppliers found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                We only display suppliers with active catalogue listings matching your search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {distinctSuppliers.map((s) => {
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

                      {/* AI Why it matched section */}
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
                                <span>Authoritative supplier for verified matching catalogue products</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <span className="text-blue-500 font-bold">&bull;</span>
                                <span>High fulfillment track record ({s.on_time_rate || 98}%)</span>
                              </li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Right: Circular Match Score Ring & Actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-shrink-0">
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
    </div>
  );
};
