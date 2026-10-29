import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Package,
  Building2,
  Search,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { productsApi, ProductItem } from "../lib/api/products";
import { ProductCard } from "../features/products/ProductCard";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

interface SavedSupplier {
  id: string;
  company_id: string;
  name: string;
  country: string;
  city: string;
  logo_url?: string;
  banner_url?: string;
  description: string;
  trust_score: number;
  rating: number;
  on_time_rate: number;
  response_time_hours: number;
  capacity?: string;
  verified_status: string;
  certifications: string[];
  is_saved: boolean;
}

interface SavedSearch {
  id: string;
  search_id: string;
  query: string;
  requirement?: any;
  filters?: any;
  results_count: number;
  created_at: string;
}

export const SavedPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<"products" | "suppliers" | "searches">("products");
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<SavedSupplier[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  const loadSavedData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getAllSaved();
      setProducts(res.products || []);
      setSuppliers(res.suppliers || []);
      setSearches(res.searches || []);
    } catch {
      toastError("Failed to fetch saved items.");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const handleRemoveProduct = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await productsApi.toggleSaveProduct(id, true);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      success("Removed product from favorites");
    } catch {
      toastError("Failed to remove product");
    }
  };

  const handleRemoveSupplier = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await productsApi.toggleSaveSupplier(id, true);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      success("Removed supplier from bookmarks");
    } catch {
      toastError("Failed to remove supplier");
    }
  };

  const handleRemoveSearch = async (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/saved/searches/${searchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSearches((prev) => prev.filter((s) => s.search_id !== searchId));
      success("Removed saved search");
    } catch {
      toastError("Failed to remove saved search");
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] uppercase tracking-wider">
            Workspace Bookmarks
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight">
          Saved Items & Sourcing Watchlist
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Access your shortlisted catalog products, vetted global suppliers, and recurring AI search criteria.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors ${
            activeTab === "products"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Saved Products</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("suppliers")}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors ${
            activeTab === "suppliers"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Saved Suppliers</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("searches")}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-xs transition-colors ${
            activeTab === "searches"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Saved Searches</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
            {searches.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse py-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
      ) : (
        <>
          {/* TAB 1: Products */}
          {activeTab === "products" && (
            <div>
              {products.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">No Saved Products Yet</h3>
                  <p className="text-xs text-slate-500">
                    Bookmark commodities and industrial parts while exploring our verified catalog to quickly compare quotes and initiate RFQs.
                  </p>
                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate("/products")}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Browse Product Catalog
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((p) => (
                    <div key={p.id} className="relative group">
                      <ProductCard
                        product={{ ...p, is_saved: true }}
                        onToggleSave={(id) => handleRemoveProduct(id, {} as any)}
                      />
                      <button
                        onClick={(e) => handleRemoveProduct(p.id, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-rose-500 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 shadow-sm opacity-90 transition-opacity z-10"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Suppliers */}
          {activeTab === "suppliers" && (
            <div>
              {suppliers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">No Saved Suppliers Yet</h3>
                  <p className="text-xs text-slate-500">
                    Bookmark high-performing manufacturing partners to build reliable international procurement channels.
                  </p>
                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate("/suppliers")}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Explore Verified Suppliers
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {suppliers.map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A1230] to-[#2563EB] text-white flex items-center justify-center font-bold text-lg shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                                {s.name}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {s.city}, {s.country}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleRemoveSupplier(s.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Remove bookmark"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2">
                          {s.description}
                        </p>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Trust</span>
                            <p className="font-black text-slate-900 text-xs mt-0.5">{s.trust_score}%</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">On-Time</span>
                            <p className="font-black text-emerald-700 text-xs mt-0.5">{s.on_time_rate}%</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Response</span>
                            <p className="font-black text-slate-900 text-xs mt-0.5">&lt; {s.response_time_hours}h</p>
                          </div>
                        </div>

                        {/* Certs */}
                        {s.certifications.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {s.certifications.map((cert) => (
                              <span
                                key={cert}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                        <Link
                          to={`/suppliers/${s.id}`}
                          className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                        >
                          <span>View Supplier Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/rfqs?supplier=${s.id}`)}
                        >
                          Request RFQ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Searches */}
          {activeTab === "searches" && (
            <div>
              {searches.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">No Saved Searches</h3>
                  <p className="text-xs text-slate-500">
                    Save complex sourcing inquiries in AI Search to easily re-execute market analyses and monitor new vendor entries.
                  </p>
                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate("/search")}
                      icon={<Sparkles className="w-4 h-4" />}
                    >
                      Try AI Trade Search
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searches.map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
                              <Search className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {s.created_at || "Recent"}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleRemoveSearch(s.search_id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Delete search"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm leading-snug">
                          &ldquo;{s.query}&rdquo;
                        </h3>

                        {s.requirement?.target_product && (
                          <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div className="flex justify-between">
                              <span>Target Product:</span>
                              <strong className="text-slate-800">{s.requirement.target_product}</strong>
                            </div>
                            {s.requirement.max_target_price && (
                              <div className="flex justify-between">
                                <span>Target Price:</span>
                                <strong className="text-slate-800">${s.requirement.max_target_price}</strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                          icon={<RotateCcw className="w-3.5 h-3.5" />}
                        >
                          Run Search Again
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
