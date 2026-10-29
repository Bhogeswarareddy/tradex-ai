import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Building2,
  X,
} from "lucide-react";
import {
  SupplierFilterParams,
  SupplierListItem,
  suppliersApi,
} from "../lib/api/suppliers";
import {
  SupplierCard,
  SupplierFilterSidebar,
} from "../features/suppliers";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";

export const SuppliersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQ = searchParams.get("q") || "";
  const initialCountry = searchParams.get("country") || undefined;
  const initialCategory = searchParams.get("product_category") || undefined;
  const initialSort = (searchParams.get("sort") as SupplierFilterParams["sort"]) || "trust";
  const initialVerified = searchParams.get("verified_only") === "true";
  const initialRating = searchParams.get("min_rating") ? Number(searchParams.get("min_rating")) : undefined;
  const initialYears = searchParams.get("min_years") ? Number(searchParams.get("min_years")) : undefined;
  const initialOnTime = searchParams.get("min_on_time") ? Number(searchParams.get("min_on_time")) : undefined;
  const initialMaxMoq = searchParams.get("max_moq") ? Number(searchParams.get("max_moq")) : undefined;
  const initialExport = searchParams.get("export_country") || undefined;
  const initialCerts = searchParams.get("certifications") ? searchParams.get("certifications")!.split(",") : undefined;
  const initialPage = searchParams.get("page") ? Number(searchParams.get("page")) : 1;

  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize] = useState(12);

  const [searchInput, setSearchInput] = useState(initialQ);
  const [filters, setFilters] = useState<SupplierFilterParams>({
    q: initialQ || undefined,
    country: initialCountry,
    product_category: initialCategory,
    sort: initialSort,
    verified_only: initialVerified || undefined,
    min_rating: initialRating,
    min_years: initialYears,
    min_on_time: initialOnTime,
    max_moq: initialMaxMoq,
    export_country: initialExport,
    certifications: initialCerts,
    page: initialPage,
    page_size: 12,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [selectedSupplierForQuote, setSelectedSupplierForQuote] = useState<SupplierListItem | null>(null);

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.country) params.set("country", filters.country);
    if (filters.product_category) params.set("product_category", filters.product_category);
    if (filters.sort && filters.sort !== "trust") params.set("sort", filters.sort);
    if (filters.verified_only) params.set("verified_only", "true");
    if (filters.min_rating) params.set("min_rating", String(filters.min_rating));
    if (filters.min_years) params.set("min_years", String(filters.min_years));
    if (filters.min_on_time) params.set("min_on_time", String(filters.min_on_time));
    if (filters.max_moq) params.set("max_moq", String(filters.max_moq));
    if (filters.export_country) params.set("export_country", filters.export_country);
    if (filters.certifications && filters.certifications.length > 0) {
      params.set("certifications", filters.certifications.join(","));
    }
    if (currentPage > 1) params.set("page", String(currentPage));
    setSearchParams(params, { replace: true });
  }, [filters, currentPage, setSearchParams]);

  // Fetch data
  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await suppliersApi.list({
        ...filters,
        page: currentPage,
        page_size: pageSize,
      });
      setSuppliers(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [filters, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({
      ...prev,
      q: searchInput.trim() || undefined,
      page: 1,
    }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilters({ page: 1, page_size: pageSize, sort: "trust" });
    setCurrentPage(1);
  };

  const activeChipsCount = [
    filters.q,
    filters.country,
    filters.product_category,
    filters.min_rating,
    filters.min_years,
    filters.verified_only,
    filters.min_on_time,
    ...(filters.certifications || []),
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Verified Directory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Global Supplier Discovery
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
              Connect with audited direct manufacturers, certified commodity exporters, and reliable global trade partners.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              {totalCount} Verified Exporters
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeChipsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeChipsCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search input with category & sort selectors */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by supplier name, organic turmeric, spices, textiles, city..."
              className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-3 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filters.sort || "trust"}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sort: e.target.value as SupplierFilterParams["sort"],
                  page: 1,
                }))
              }
              aria-label="Sort suppliers by"
              className="text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-3 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="trust">Sort: Highest Trust Score</option>
              <option value="rating">Sort: Customer Rating</option>
              <option value="response_time">Sort: Fastest Response</option>
              <option value="capacity">Sort: Most Experienced</option>
            </select>

            <Button type="submit" variant="primary" size="md" className="font-bold shrink-0">
              Search
            </Button>
          </div>
        </form>

        {/* Active Filter Chips Toolbar */}
        {activeChipsCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400">Active Filters:</span>
            {filters.q && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                Q: {filters.q}
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setFilters((prev) => ({ ...prev, q: undefined, page: 1 }));
                  }}
                  className="hover:text-blue-900"
                  aria-label="Remove search query filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.country && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                Country: {filters.country}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, country: undefined, page: 1 }))}
                  className="hover:text-blue-900"
                  aria-label="Remove country filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.verified_only && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                Verified Only
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, verified_only: false, page: 1 }))}
                  className="hover:text-emerald-900"
                  aria-label="Remove verified filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.max_moq && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                MOQ &le; {filters.max_moq} kg
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, max_moq: undefined, page: 1 }))}
                  className="hover:text-blue-900"
                  aria-label="Remove MOQ filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.export_country && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                Market: {filters.export_country}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, export_country: undefined, page: 1 }))}
                  className="hover:text-blue-900"
                  aria-label="Remove export market filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.min_on_time && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                On-Time &ge; {filters.min_on_time}%
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, min_on_time: undefined, page: 1 }))}
                  className="hover:text-blue-900"
                  aria-label="Remove on-time filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.certifications?.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
              >
                {c}
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      certifications: prev.certifications?.filter((x) => x !== c),
                      page: 1,
                    }))
                  }
                  className="hover:text-blue-900"
                  aria-label={`Remove certification filter ${c}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 ml-2"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main 2-Column Marketplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Left Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-3 sticky top-6">
          <SupplierFilterSidebar
            filters={filters}
            onChange={(newFilters) => {
              setFilters(newFilters);
              setCurrentPage(1);
            }}
            onClear={handleClearFilters}
          />
        </div>

        {/* Right Suppliers Grid Column */}
        <div className="lg:col-span-9 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-80 rounded-2xl bg-white border border-slate-200 p-5 animate-pulse space-y-4"
                >
                  <div className="h-28 bg-slate-200 rounded-xl" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-10 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-lg text-slate-800">No suppliers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No matching verified suppliers met your selected filter criteria. Try adjusting your parameters.
              </p>
              <Button variant="primary" size="sm" onClick={handleClearFilters}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {suppliers.map((s) => (
                  <SupplierCard
                    key={s.id}
                    supplier={s}
                    onRequestQuote={(supp) => setSelectedSupplierForQuote(supp)}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Showing Page <span className="font-bold text-slate-800">{currentPage}</span> of{" "}
                    <span className="font-bold text-slate-800">{totalPages}</span> ({totalCount} total)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    {[...Array(totalPages)].map((_, i) => {
                      const pNum = i + 1;
                      if (pNum === 1 || pNum === totalPages || Math.abs(pNum - currentPage) <= 1) {
                        return (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => setCurrentPage(pNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                              currentPage === pNum
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      }
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filters Slide-out Drawer */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Supplier Filters"
        position="left"
      >
        <SupplierFilterSidebar
          filters={filters}
          onChange={(newFilters) => {
            setFilters(newFilters);
            setCurrentPage(1);
            setIsMobileFilterOpen(false);
          }}
          onClear={() => {
            handleClearFilters();
            setIsMobileFilterOpen(false);
          }}
        />
      </Drawer>

      {/* Quick Quote Modal Simulation */}
      {selectedSupplierForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                Request RFQ: {selectedSupplierForQuote.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSupplierForQuote(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close request quote modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct inquiry to verified exporter with accredited EU/US documentation.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Commodity Specification</label>
                <input
                  type="text"
                  defaultValue="Organic Spices / Agricultural Bulk Export"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Target Quantity</label>
                <input
                  type="text"
                  defaultValue="20 Metric Tons"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Destination Port</label>
                <input
                  type="text"
                  defaultValue="Port of Hamburg, Germany (DEHAM)"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 mt-1"
                />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSupplierForQuote(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  alert("RFQ request dispatched to " + selectedSupplierForQuote.name);
                  setSelectedSupplierForQuote(null);
                }}
              >
                Submit RFQ to Exporter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
