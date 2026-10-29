import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatNumber, formatCurrency } from "../../lib/format";
import { ProductDetailResponse } from "../../lib/api/products";
import {
  Star,
  CheckCircle2,
  ShieldCheck,
  Heart,
  Send,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Tabs } from "../../components/ui/Tabs";
import { ProductCard } from "./ProductCard";
import { RfqRequestModal } from "./RfqRequestModal";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { communicationApi } from "../../lib/api/communication";

interface ProductDetailViewProps {
  product: ProductDetailResponse;
  onToggleSave?: (productId: string, current: boolean) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  onToggleSave,
}) => {
  const navigate = useNavigate();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSaved, setIsSaved] = useState(product.is_saved);
  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [ineligibleModalOpen, setIneligibleModalOpen] = useState(false);
  const { success } = useToast();

  const handleChatNow = async () => {
    setChatLoading(true);
    try {
      const recipientId = product.supplier.company_id || product.supplier.id;
      const res = await communicationApi.createThread({
        recipient_id: recipientId,
        product_id: product.id,
        subject: `Inquiry regarding ${product.name}`,
        initial_message: `Hello, I am interested in sourcing ${product.name}. Could you please provide your formal FOB/CIF quotation, MOQ tiers, and confirmed lead time?`,
        context_type: "product",
        context_id: product.id,
      });
      navigate(`/messages?threadId=${res.thread_id}`);
    } catch (err: any) {
      console.warn("Could not initiate chat with supplier:", err);
      setIneligibleModalOpen(true);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveToggle = () => {
    const nextState = !isSaved;
    setIsSaved(nextState);
    if (onToggleSave) onToggleSave(product.id, isSaved);
    success(nextState ? "Saved to Favorites" : "Removed from Favorites");
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "specs", label: "Specifications" },
    { id: "certs", label: "Certifications", badge: product.certifications.length },
    { id: "shipping", label: "Shipping & Incoterms" },
    { id: "reviews", label: "Reviews", badge: product.reviews_summary.total_reviews },
  ];

  const currentImage = product.images[selectedImageIdx] || product.images[0];

  return (
    <div className="space-y-10 pb-16">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-900">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-slate-900">Products</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Top Main Section: Gallery & Purchase Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Image Gallery (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Main Large Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
            <img
              src={currentImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20">
                {product.category_name}
              </span>
            </div>
            <button
              onClick={handleSaveToggle}
              className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md shadow-md transition-colors ${
                isSaved
                  ? "bg-rose-50 text-rose-600"
                  : "bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
              title="Save item"
            >
              <Heart className={`w-4 h-4 ${isSaved ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
          </div>

          {/* Thumbnails Row */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImageIdx === idx
                      ? "border-[#2563EB] ring-2 ring-blue-100"
                      : "border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Details & Price Tiers (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Title & Origin */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                HS Code: {product.hs_code || "0910.30.20"}
              </span>
              <span className="text-xs text-slate-500">Origin: <strong>{product.origin_country}</strong></span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Rating & Supplier line */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
              <div className="flex items-center text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-amber-400 mr-1" />
                <span>{product.reviews_summary.average_rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal ml-1">
                  ({product.reviews_summary.total_reviews} verified trade reviews)
                </span>
              </div>
              <span>•</span>
              <span className="font-semibold text-slate-800">
                Export Lead Time: {product.lead_time_days} days
              </span>
            </div>
          </div>

          {/* Volume Tiered Pricing Table */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Volume Tiered Pricing
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {product.price_tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs"
                >
                  <p className="text-[11px] text-slate-400 font-medium">
                    {tier.max_qty
                      ? `${formatNumber(tier.min_qty)} - ${formatNumber(tier.max_qty)} ${product.unit}`
                      : `${formatNumber(tier.min_qty)}+ ${product.unit}`}
                  </p>
                  <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                    {formatCurrency(tier.unit_price, tier.currency || "USD")}
                  </p>
                  <p className="text-[10px] text-slate-400">{tier.currency} / {product.unit}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>MOQ: <strong className="text-slate-800">{formatNumber(product.moq)} {product.unit}</strong></span>
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                Incoterms: FOB / CIF / EXW Supported
              </span>
            </div>
          </div>

          {/* AI Summary Card */}
          <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/60 rounded-2xl border border-blue-200/70 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB]">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>AI Trade Intelligence Summary</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {product.ai_summary.key_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-blue-200/50 flex items-start gap-2 text-[11px] text-amber-800 bg-amber-500/10 p-2 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span><strong>Inspection Caution:</strong> {product.ai_summary.caution}</span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setRfqModalOpen(true)}
              className="flex-1 text-sm shadow-md shadow-blue-500/20"
              icon={<Send className="w-4 h-4" />}
            >
              Request Quote (RFQ)
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleChatNow}
              isLoading={chatLoading}
              icon={<MessageSquare className="w-4 h-4" />}
            >
              Chat Now
            </Button>
          </div>
        </div>
      </div>

      {/* Supplier Trust Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A1230] to-[#2563EB] text-white flex items-center justify-center font-bold text-xl shadow-md">
            {product.supplier.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">{product.supplier.name}</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified Exporter
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {product.supplier.city || "Mundra"}, {product.supplier.country} • {product.supplier.years_in_business} years in business
            </p>
          </div>
        </div>

        {/* Supplier Trust Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Trust Score</p>
            <p className="text-base font-black text-slate-900 mt-0.5">{product.supplier.trust_score.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">On-Time Rate</p>
            <p className="text-base font-black text-emerald-700 mt-0.5">{product.supplier.on_time_rate.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Response Time</p>
            <p className="text-base font-black text-slate-900 mt-0.5">&lt; {product.supplier.response_time_hours} hrs</p>
          </div>
        </div>

        <div className="shrink-0">
          <Link
            to="/suppliers"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>View Full Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs Section: Overview, Specs, Certifications, Shipping, Reviews */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="px-6 pt-2" />

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <h3 className="font-bold text-slate-900 text-base">Product Description & Harvest Notes</h3>
              <p>{product.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">HS Code</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{product.hs_code || "0910.30.20"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Export Country</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{product.origin_country}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Standard Packaging</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{product.packaging || "25kg / 50kg Export Bags"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Supported Terms</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{product.incoterms || "FOB, CIF"}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "specs" && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base">Technical Specifications</h3>
              {product.specifications && Object.keys(product.specifications).length > 0 ? (
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs text-left text-slate-700 divide-y divide-slate-200">
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {Object.entries(product.specifications).map(([key, val]) => (
                        <tr key={key} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-600 w-1/3">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {String(val)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-700 divide-y divide-slate-100">
                  <tbody>
                    <tr className="py-2.5 flex justify-between"><td className="font-semibold text-slate-500">Curcumin Content / Purity</td><td className="font-bold text-slate-900">&ge; 5.0% by HPLC</td></tr>
                    <tr className="py-2.5 flex justify-between"><td className="font-semibold text-slate-500">Moisture Percentage</td><td className="font-bold text-slate-900">&le; 9.5%</td></tr>
                    <tr className="py-2.5 flex justify-between"><td className="font-semibold text-slate-500">Total Ash</td><td className="font-bold text-slate-900">&le; 7.0%</td></tr>
                    <tr className="py-2.5 flex justify-between"><td className="font-semibold text-slate-500">Particle Fineness</td><td className="font-bold text-slate-900">80 - 100 Mesh Screen</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "certs" && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base">Active Supplier Compliance Certifications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {product.certifications.map((c) => (
                  <div key={c} className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-slate-900">{c}</p>
                      <p className="text-[10px] text-emerald-700">Verified & Authenticated</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="space-y-3 text-xs text-slate-600">
              <h3 className="font-bold text-slate-900 text-base">Logistics & Incoterms Protocols</h3>
              <p>Supported standard terms: <strong>{product.incoterms || "FOB, CIF, EXW"}</strong> originating from <strong>{product.origin_country}</strong> ports.</p>
              <p>Packaging configuration: <strong>{product.packaging || "Export standard palletized bulk packing"}</strong>.</p>
              <p>Standard lead time for dispatch: <strong>{product.lead_time_days} business days</strong> from LC confirmation.</p>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-3 text-xs text-slate-600">
              <h3 className="font-bold text-slate-900 text-base">Recent Importer Reviews</h3>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">BioKräuter Import GmbH (Germany)</span>
                  <div className="flex items-center text-amber-500"><Star className="w-3 h-3 fill-amber-400" /><span>5.0</span></div>
                </div>
                <p className="text-slate-600">Clean analytical COA report matching EU pesticide regulations. Dispatched on schedule via Hamburg corridor.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products Grid */}
      {product.related_products.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Related Products in {product.category_name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {product.related_products.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}

      {/* RFQ Modal Dialog */}
      <RfqRequestModal
        isOpen={rfqModalOpen}
        onClose={() => setRfqModalOpen(false)}
        product={product}
      />

      {/* Ineligible Contact Fallback Modal */}
      {ineligibleModalOpen && (
        <Modal
          isOpen={ineligibleModalOpen}
          onClose={() => setIneligibleModalOpen(false)}
          title="Supplier Contact Unavailable"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This supplier does not have an active direct chat contact at the moment. You can submit an inquiry or create a formal RFQ.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIneligibleModalOpen(false);
                  navigate(`/messages?productName=${encodeURIComponent(product.name)}&contextId=${product.id}`);
                }}
              >
                Send an Inquiry
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIneligibleModalOpen(false);
                  setRfqModalOpen(true);
                }}
              >
                Create an RFQ
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
