import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  productsApi,
  ProductItem,
  CategoryNode,
  ProductFilterParams,
  CompareProductsResponse,
} from "../lib/api/products";
import {
  ProductCard,
  ProductFilterSidebar,
  CompareFloatingBar,
  ProductCompareModal,
} from "../features/products";
import {
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
  PackageOpen,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state sync
  const initialQ = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || undefined;
  const initialCountry = searchParams.get("country") || undefined;
  const initialSort = (searchParams.get("sort") as ProductFilterParams["sort"]) || "relevance";
  const initialVerified = searchParams.get("verified_only") === "true";
  const initialCertifications = searchParams.get("certifications") ? searchParams.get("certifications")!.split(",") : undefined;
  const initialMaxMoq = searchParams.get("max_moq") ? Number(searchParams.get("max_moq")) : undefined;
  const initialMaxLead = searchParams.get("max_lead_time") ? Number(searchParams.get("max_lead_time")) : undefined;
  const initialPage = searchParams.get("page") ? Number(searchParams.get("page")) : 1;

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize] = useState(12);

  const [searchInput, setSearchInput] = useState(initialQ);
  const [filters, setFilters] = useState<ProductFilterParams>({
    q: initialQ || undefined,
    category: initialCategory,
    country: initialCountry,
    sort: initialSort,
    verified_only: initialVerified || undefined,
    certifications: initialCertifications,
    max_moq: initialMaxMoq,
    max_lead_time: initialMaxLead,
    page: initialPage,
    page_size: 12,
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [comparedProducts, setComparedProducts] = useState<ProductItem[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState<CompareProductsResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  // Load categories
  useEffect(() => {
    productsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({
        ...filters,
        page: currentPage,
        page_size: pageSize,
      });
      setProducts(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounced search input handler (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== (filters.q || "")) {
        const nextFilters = { ...filters, q: searchInput || undefined, page: 1 };
        setFilters(nextFilters);
        setCurrentPage(1);

        // Update URL query params
        const newParams = new URLSearchParams(searchParams);
        if (searchInput) newParams.set("q", searchInput);
        else newParams.delete("q");
        setSearchParams(newParams, { replace: true });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput, filters, searchParams, setSearchParams]);

  // Handle filter change
  const handleFilterChange = (newFilters: ProductFilterParams) => {
    setFilters(newFilters);
    setCurrentPage(newFilters.page || 1);

    const newParams = new URLSearchParams();
    if (newFilters.q) newParams.set("q", newFilters.q);
    if (newFilters.category) newParams.set("category", newFilters.category);
    if (newFilters.country) newParams.set("country", newFilters.country);
    if (newFilters.sort && newFilters.sort !== "relevance") newParams.set("sort", newFilters.sort);
    if (newFilters.verified_only) newParams.set("verified_only", "true");
    if (newFilters.certifications && newFilters.certifications.length > 0) {
      newParams.set("certifications", newFilters.certifications.join(","));
    }
    if (newFilters.max_moq) newParams.set("max_moq", String(newFilters.max_moq));
    if (newFilters.max_lead_time) newParams.set("max_lead_time", String(newFilters.max_lead_time));
    if (newFilters.page && newFilters.page > 1) newParams.set("page", String(newFilters.page));

    setSearchParams(newParams, { replace: true });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilters({ sort: "relevance", page: 1, page_size: pageSize });
    setCurrentPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Compare toggling
  const handleToggleCompare = (product: ProductItem) => {
    setComparedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 4) return prev;
      return [...prev, product];
    });
  };

  const handleOpenCompare = async () => {
    if (comparedProducts.length < 2) return;
    setCompareModalOpen(true);
    setCompareLoading(true);
    try {
      const res = await productsApi.compare(comparedProducts.map((p) => p.id));
      setCompareData(res);
    } catch {
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  };

  // Active filter chips list
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.q) {
    activeChips.push({
      key: "q",
      label: `Search: "${filters.q}"`,
      onRemove: () => {
        setSearchInput("");
        handleFilterChange({ ...filters, q: undefined });
      },
    });
  }
  if (filters.category) {
    const catName = categories.find((c) => c.slug === filters.category)?.name || filters.category;
    activeChips.push({
      key: "cat",
      label: `Category: ${catName}`,
      onRemove: () => handleFilterChange({ ...filters, category: undefined }),
    });
  }
  if (filters.country) {
    activeChips.push({
      key: "country",
      label: `Country: ${filters.country}`,
      onRemove: () => handleFilterChange({ ...filters, country: undefined }),
    });
  }
  if (filters.certifications && filters.certifications.length > 0) {
    filters.certifications.forEach((c) => {
      activeChips.push({
        key: `cert-${c}`,
        label: `Cert: ${c}`,
        onRemove: () =>
          handleFilterChange({
            ...filters,
            certifications: filters.certifications?.filter((x) => x !== c),
          }),
      });
    });
  }
  if (filters.verified_only) {
    activeChips.push({
      key: "verified",
      label: "Verified Only",
      onRemove: () => handleFilterChange({ ...filters, verified_only: false }),
    });
  }
  if (filters.max_moq) {
    activeChips.push({
      key: "moq",
      label: `MOQ ≤ ${filters.max_moq} kg`,
      onRemove: () => handleFilterChange({ ...filters, max_moq: undefined }),
    });
  }
  if (filters.max_lead_time) {
    activeChips.push({
      key: "lead_time",
      label: `Lead Time ≤ ${filters.max_lead_time} days`,
      onRemove: () => handleFilterChange({ ...filters, max_lead_time: undefined }),
    });
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] uppercase tracking-wider">
            Verified Global Catalog
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight">
          Product Discovery Marketplace
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Source farm-gate agricultural commodities, high-grade spices, and industrial components with verified volume pricing.
        </p>
      </div>

      {/* Top Toolbar: Search, Sort, Views, Mobile Filters Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products by title, HS code, keywords..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Sort, View Toggle, Mobile Filter Trigger */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          {/* Mobile Filter Button */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>Filters</span>
            {activeChips.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeChips.length}
              </span>
            )}
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={filters.sort || "relevance"}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  sort: e.target.value as ProductFilterParams["sort"],
                })
              }
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:border-blue-500 text-xs"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest Listed</option>
              <option value="rating">Highest Trust Score</option>
            </select>
          </div>

          {/* Grid / List Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-white text-[#2563EB] shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list" ? "bg-white text-[#2563EB] shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Toolbar */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-semibold mr-1">Active Filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-200 text-xs font-semibold"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:text-blue-900 ml-0.5"
                title="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-slate-500 hover:text-slate-800 underline font-medium ml-2"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Main Layout: Left Sidebar + Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Filter Sidebar (3 Cols) */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <ProductFilterSidebar
            categories={categories}
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </div>

        {/* Mobile Filter Drawer */}
        <Drawer
          isOpen={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          title="Filter Products"
          position="left"
          size="sm"
        >
          <ProductFilterSidebar
            categories={categories}
            filters={filters}
            onChange={(f) => {
              handleFilterChange(f);
              setMobileFilterOpen(false);
            }}
            onClear={() => {
              handleClearFilters();
              setMobileFilterOpen(false);
            }}
            className="border-none shadow-none p-0"
          />
        </Drawer>

        {/* Products Results Grid / List (9 Cols) */}
        <div className="lg:col-span-9 space-y-5">
          {/* Result Count Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{products.length}</strong> of{" "}
              <strong className="text-slate-800">{totalCount}</strong> verified products
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {/* Loading Skeletons */}
          {loading ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                  : "space-y-4"
              }
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-44 bg-slate-100 rounded-xl" />
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-10 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <PackageOpen className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">No matching products found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Try adjusting your keywords, expanding your MOQ thresholds, or resetting active category filters.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleClearFilters}
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            /* Results List/Grid */
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                  : "space-y-4"
              }
            >
              {products.map((product) => {
                const isCompared = comparedProducts.some((p) => p.id === product.id);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    viewMode={viewMode}
                    isCompared={isCompared}
                    onToggleCompare={handleToggleCompare}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                &larr; Previous Page
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        currentPage === pNum
                          ? "bg-[#2563EB] text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next Page &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Compare Bar */}
      <CompareFloatingBar
        selectedProducts={comparedProducts}
        onCompareClick={handleOpenCompare}
        onClear={() => setComparedProducts([])}
        onRemove={(pId) => setComparedProducts((prev) => prev.filter((p) => p.id !== pId))}
      />

      {/* Compare Modal */}
      <ProductCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        data={compareData}
        isLoading={compareLoading}
      />
    </div>
  );
};
