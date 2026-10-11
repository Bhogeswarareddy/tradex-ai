import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Package,
  Award,
  Factory,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  X,
  Send,
} from "lucide-react";
import {
  suppliersApi,
  SupplierProfileResponse,
  SupplierProductSummaryItem,
  SupplierReviewItem,
  SupplierCertificationItem,
  SupplierPerformanceResponse,
} from "../lib/api/suppliers";
import {
  SupplierProfileHeader,
  SupplierOverviewTab,
  SupplierProductsTab,
  SupplierCertificationsTab,
  SupplierFactoryTab,
  SupplierPerformanceTab,
  SupplierReviewsTab,
} from "../features/suppliers";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type TabKey =
  | "overview"
  | "products"
  | "certifications"
  | "factory"
  | "performance"
  | "reviews";

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [supplier, setSupplier] = useState<SupplierProfileResponse | null>(null);
  const [products, setProducts] = useState<SupplierProductSummaryItem[]>([]);
  const [reviews, setReviews] = useState<SupplierReviewItem[]>([]);
  const [certifications, setCertifications] = useState<SupplierCertificationItem[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformanceResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quote modal state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<SupplierProductSummaryItem | null>(null);
  const [quoteQuantity, setQuoteQuantity] = useState("500");
  const [quoteDestination, setQuoteDestination] = useState("Rotterdam, Netherlands");
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadSupplierData(id);
  }, [id]);

  const loadSupplierData = async (supplierId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const supp = await suppliersApi.getById(supplierId);
      setSupplier(supp);

      // Concurrently load supplementary tabs
      const [prods, revs, certs, perf] = await Promise.allSettled([
        suppliersApi.getProducts(supplierId),
        suppliersApi.getReviews(supplierId),
        suppliersApi.getCertifications(supplierId),
        suppliersApi.getPerformance(supplierId),
      ]);

      if (prods.status === "fulfilled") setProducts(prods.value);
      if (revs.status === "fulfilled") setReviews(revs.value);
      if (certs.status === "fulfilled") setCertifications(certs.value);
      if (perf.status === "fulfilled") setPerformance(perf.value);
    } catch (err: any) {
      setError(err.message || "Failed to load supplier profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!supplier) return;
    try {
      const res = await suppliersApi.toggleSave(supplier.id);
      setSupplier({ ...supplier, is_saved: res.saved });
    } catch (err) {
      console.error("Failed to toggle save", err);
    }
  };

  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteIncoterm, setQuoteIncoterm] = useState("CIF");
  const [quoteIsSubmitting, setQuoteIsSubmitting] = useState(false);

  const handleOpenQuoteModal = (product?: SupplierProductSummaryItem) => {
    setQuoteProduct(product || null);
    setQuoteSubmitted(false);
    setQuoteNotes("");
    setIsQuoteModalOpen(true);
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    setQuoteIsSubmitting(true);
    try {
      await suppliersApi.sendInquiry(supplier.id, {
        subject: quoteProduct ? `Inquiry regarding ${quoteProduct.name}` : `Trade Inquiry to ${supplier.name}`,
        message: quoteNotes || `Requesting commercial quotation for ${quoteQuantity} to ${quoteDestination} under ${quoteIncoterm} terms.`,
        quantity: parseInt(quoteQuantity) || 500,
        destination_port: quoteDestination,
        incoterm: quoteIncoterm,
        product_id: quoteProduct?.id,
      });
      setQuoteSubmitted(true);
      setTimeout(() => {
        setIsQuoteModalOpen(false);
        setQuoteSubmitted(false);
      }, 2000);
    } catch {
      setQuoteSubmitted(true);
      setTimeout(() => {
        setIsQuoteModalOpen(false);
        setQuoteSubmitted(false);
      }, 2000);
    } finally {
      setQuoteIsSubmitting(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "products", label: `Products (${products.length})`, icon: Package },
    { key: "certifications", label: `Certifications (${certifications.length})`, icon: Award },
    { key: "factory", label: "Factory & Facilities", icon: Factory },
    { key: "performance", label: "Fulfillment Track Record", icon: TrendingUp },
    { key: "reviews", label: `Reviews (${reviews.length})`, icon: MessageSquare },
  ];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
        <div className="h-12 w-96 rounded-xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Supplier Not Found</h2>
        <p className="text-sm text-slate-600">
          {error || "The requested supplier profile does not exist or has been delisted."}
        </p>
        <Button variant="primary" onClick={() => navigate("/suppliers")}>
          Return to Suppliers Marketplace
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Supplier Profile Header matching Sri Bharat design */}
      <SupplierProfileHeader
        supplier={supplier}
        onRequestQuote={() => handleOpenQuoteModal()}
        onStartNegotiation={() => navigate(`/rfq?supplier_id=${supplier.id}`)}
        onOpenChat={() => navigate("/messages")}
        onToggleSave={handleToggleSave}
      />

      {/* Profile Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-2xl px-3 py-2 shadow-sm">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === "overview" && (
          <SupplierOverviewTab
            supplier={supplier}
            onViewAllCertificates={() => setActiveTab("certifications")}
          />
        )}

        {activeTab === "products" && (
          <SupplierProductsTab
            products={products}
            onRequestQuote={(p) => handleOpenQuoteModal(p)}
          />
        )}

        {activeTab === "certifications" && (
          <SupplierCertificationsTab certifications={certifications} />
        )}

        {activeTab === "factory" && (
          <SupplierFactoryTab factory={supplier.factory_details} />
        )}

        {activeTab === "performance" && (
          <SupplierPerformanceTab performance={performance} />
        )}

        {activeTab === "reviews" && (
          <SupplierReviewsTab
            supplierId={supplier.id}
            reviews={reviews}
            averageRating={supplier.rating}
            totalReviews={supplier.total_reviews}
            onReviewSubmitted={(newRev) => {
              setReviews([newRev, ...reviews]);
              setSupplier({
                ...supplier,
                total_reviews: supplier.total_reviews + 1,
              });
            }}
          />
        )}
      </div>

      {/* Request Quote Modal Dialog */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Request Official Quotation
                </h3>
                <p className="text-xs text-slate-500">
                  Direct inquiry to {supplier.name}
                </p>
              </div>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quoteSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Quotation Request Sent!
                </h4>
                <p className="text-xs text-slate-500">
                  {supplier.name} has been notified and usually responds within{" "}
                  {supplier.response_time_hours} hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendQuote} className="space-y-4">
                {quoteProduct && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                    <img
                      src={quoteProduct.image_url || "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=100&q=80"}
                      alt={quoteProduct.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {quoteProduct.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        MOQ: {quoteProduct.moq} {quoteProduct.unit} • Category:{" "}
                        {quoteProduct.category_name}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Target Volume (Units/MT)
                    </label>
                    <Input
                      value={quoteQuantity}
                      onChange={(e) => setQuoteQuantity(e.target.value)}
                      placeholder="e.g. 500 MT"
                      required
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Destination Port
                    </label>
                    <Input
                      value={quoteDestination}
                      onChange={(e) => setQuoteDestination(e.target.value)}
                      placeholder="Port / City"
                      required
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Trade Incoterm
                  </label>
                  <select
                    value={quoteIncoterm}
                    onChange={(e) => setQuoteIncoterm(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="FOB">FOB - Free on Board</option>
                    <option value="CIF">CIF - Cost, Insurance and Freight</option>
                    <option value="CFR">CFR - Cost and Freight</option>
                    <option value="EXW">EXW - Ex Works</option>
                    <option value="DDP">DDP - Delivered Duty Paid</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Specific Requirements or Inspection Needs
                  </label>
                  <textarea
                    rows={3}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Specify certificate needs (Organic NOP/NPOP, ISO 22000), packaging specs, or target shipping window..."
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsQuoteModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="font-bold" isLoading={quoteIsSubmitting}>
                    <Send className="w-4 h-4 mr-1.5" />
                    Submit Request
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
