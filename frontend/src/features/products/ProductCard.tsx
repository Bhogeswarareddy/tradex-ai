import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCurrency } from "../settings/SettingsContext";
import { formatNumber, formatCurrency } from "../../lib/format";
import {
  Heart,
  Star,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { ProductItem } from "../../lib/api/products";
import { communicationApi } from "../../lib/api/communication";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";

interface ProductCardProps {
  product: ProductItem;
  viewMode?: "grid" | "list";
  isCompared?: boolean;
  onToggleCompare?: (product: ProductItem) => void;
  onToggleSave?: (productId: string, current: boolean) => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  India: "🇮🇳",
  Germany: "🇩🇪",
  USA: "🇺🇸",
  UAE: "🇦🇪",
  Vietnam: "🇻🇳",
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode = "grid",
  isCompared = false,
  onToggleCompare,
  onToggleSave,
}) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [saved, setSaved] = React.useState(product.is_saved);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [ineligibleModalOpen, setIneligibleModalOpen] = React.useState(false);

  const priceMinRes = formatPrice(product.price_min, product.currency || "USD");
  const priceMaxRes = formatPrice(product.price_max, product.currency || "USD");

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !saved;
    setSaved(nextState);
    if (onToggleSave) onToggleSave(product.id, saved);
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleCompare) onToggleCompare(product);
  };

  const handleChatNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatLoading(true);
    try {
      const recipientId = (product as any).supplier_company_id || (product as any).company_id || product.supplier_id;
      const res = await communicationApi.createThread({
        recipient_id: recipientId,
        product_id: product.id,
        subject: `Inquiry regarding ${product.name}`,
        initial_message: `Hello, I would like to inquire about ${product.name}. Please provide availability, MOQ, and quotation details.`,
        context_type: "product",
        context_id: product.id,
      });
      navigate(`/messages?threadId=${res.thread_id}`);
    } catch (err: any) {
      console.warn("Chat Now failed:", err);
      setIneligibleModalOpen(true);
    } finally {
      setChatLoading(false);
    }
  };

  const flag = COUNTRY_FLAGS[product.origin_country] || "🌐";

  if (viewMode === "list") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
          {/* Compare Checkbox */}
          <div className="pt-1 sm:pt-0">
            <input
              type="checkbox"
              checked={isCompared}
              onChange={() => onToggleCompare && onToggleCompare(product)}
              className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-blue-500 cursor-pointer"
              title="Select to compare"
            />
          </div>

          {/* Thumbnail */}
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              loading="lazy"
            />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                {product.category_name}
              </span>
              <span className="text-xs text-slate-400">HS: {product.hs_code || "N/A"}</span>
            </div>

            <Link
              to={`/products/${product.slug}`}
              className="block font-bold text-slate-900 text-base group-hover:text-[#2563EB] transition-colors truncate"
            >
              {product.name}
            </Link>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <span>{flag}</span>
                <span>{product.origin_country}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span>By {product.supplier_name}</span>
                {product.supplier_verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{product.supplier_rating.toFixed(1)}</span>
              </span>
            </div>

            {/* Certifications */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {product.certifications.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-2">
          <div className="text-left sm:text-right">
            <div
              className="text-lg font-black text-slate-900 dark:text-slate-100"
              title={priceMinRes.approx ? `Original: ${formatCurrency(product.price_min, product.currency || "USD")} - ${formatCurrency(product.price_max, product.currency || "USD")}` : undefined}
            >
              {priceMinRes.formatted} - {priceMaxRes.formatted}{" "}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {product.unit}</span>
              {priceMinRes.approx && (
                <span className="text-[10px] text-slate-400 block font-normal">
                  Orig: {formatCurrency(product.price_min, product.currency || "USD")} - {formatCurrency(product.price_max, product.currency || "USD")}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              MOQ: <strong className="text-slate-700">{formatNumber(product.moq)} {product.unit}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleHeartClick}
              className={`p-2 rounded-xl border transition-colors ${
                saved
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }`}
              title="Save to favorites"
            >
              <Heart className={`w-4 h-4 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChatNow}
              isLoading={chatLoading}
              className="text-xs gap-1 border-blue-200 text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="Chat Now with supplier"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Now</span>
            </Button>
            <Link
              to={`/products/${product.slug}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors shadow-sm"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Grid Mode (Default)
  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all flex flex-col justify-between group">
        <div>
          {/* Image Header */}
          <div className="relative h-44 bg-slate-100 overflow-hidden">
            <Link to={`/products/${product.slug}`}>
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </Link>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

            {/* Top Bar on Image: Category Tag, Demo Badge & Heart */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-slate-950/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20">
                  {product.category_name}
                </span>
                {product.is_demo && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-amber-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-amber-500/30" data-testid="demo-data-badge">
                    Demo data
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleHeartClick}
                className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                  saved
                    ? "bg-rose-50 text-rose-600 shadow"
                    : "bg-slate-900/50 text-white hover:bg-white hover:text-slate-900"
                }`}
                title="Save item"
              >
                <Heart className={`w-4 h-4 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
              </button>
            </div>

            {/* Bottom Bar on Image: Compare Checkbox */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
              <label
                onClick={handleCompareClick}
                className="inline-flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer border border-white/10 hover:bg-slate-900"
              >
                <input
                  type="checkbox"
                  checked={isCompared}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 rounded text-[#2563EB] border-white/40 focus:ring-0 cursor-pointer"
                />
                <span>Compare</span>
              </label>

              <span className="text-[10px] font-mono bg-blue-600/80 px-1.5 py-0.5 rounded">
                HS {product.hs_code || "0910.30"}
              </span>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <div>
              <Link
                to={`/products/${product.slug}`}
                className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2 group-hover:text-[#2563EB] dark:group-hover:text-blue-400 transition-colors"
              >
                {product.name}
              </Link>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                <span>{flag}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{product.origin_country}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{product.supplier_rating.toFixed(1)}</span>
                </span>
              </p>
            </div>

            {/* Supplier Name with Verified Badge */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="truncate">{product.supplier_name}</span>
              {product.supplier_verified && (
                <span title="Verified Supplier">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </span>
              )}
            </div>

            {/* Pricing & MOQ Spec Box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div
                className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight"
                title={priceMinRes.approx ? `Original: ${formatCurrency(product.price_min, product.currency || "USD")} - ${formatCurrency(product.price_max, product.currency || "USD")}` : undefined}
              >
                {priceMinRes.formatted} - {priceMaxRes.formatted}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {product.unit}</span>
                {priceMinRes.approx && (
                  <span className="text-[10px] text-slate-400 block font-normal">
                    Orig: ${formatCurrency(product.price_min, product.currency || "USD")} - ${formatCurrency(product.price_max, product.currency || "USD")}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>MOQ: <strong className="text-slate-800 dark:text-slate-200">{formatNumber(product.moq)} {product.unit}</strong></span>
                <span>Lead: <strong className="text-slate-800 dark:text-slate-200">{product.lead_time_days ?? "Not available"}d</strong></span>
              </div>
            </div>

            {/* Certifications Chips */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {product.certifications.slice(0, 3).map((cert) => (
                <span
                  key={cert}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer CTA: Chat Now & View Details */}
        <div className="p-4 pt-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleChatNow}
            disabled={chatLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold transition-all"
            title="Chat directly with supplier"
          >
            {chatLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5" />
            )}
            <span>Chat Now</span>
          </button>
          <Link
            to={`/products/${product.slug}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#2563EB] dark:hover:bg-[#2563EB] text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white text-xs font-bold transition-all"
          >
            <span>Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

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
                  navigate(`/rfqs?productId=${product.id}&productName=${encodeURIComponent(product.name)}`);
                }}
              >
                Create an RFQ
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
