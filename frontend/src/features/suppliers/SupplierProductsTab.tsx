import React from "react";
import { Link } from "react-router-dom";
import { Package, Send } from "lucide-react";
import { SupplierProductSummaryItem } from "../../lib/api/suppliers";
import { Button } from "../../components/ui/Button";

interface SupplierProductsTabProps {
  products: SupplierProductSummaryItem[];
  isLoading?: boolean;
  onRequestQuote: (product: SupplierProductSummaryItem) => void;
}

export const SupplierProductsTab: React.FC<SupplierProductsTabProps> = ({
  products,
  isLoading,
  onRequestQuote,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 animate-pulse">
        Loading supplier product catalog...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <Package className="w-10 h-10 text-slate-300 mx-auto" />
        <h4 className="font-bold text-slate-800 text-base">No products currently published</h4>
        <p className="text-xs text-slate-500">This supplier hasn't published public catalog items yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-slate-900">
          Published Catalog Items ({products.length})
        </h3>
        <span className="text-xs font-semibold text-slate-500">
          Volume tier discounts available on RFQ
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((p) => (
          <div
            key={p.id}
            className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Product Thumbnail */}
              <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                <img
                  src={p.image_url || "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80"}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                  {p.category_name}
                </span>
              </div>

              {/* Body */}
              <div className="p-4 space-y-2">
                <Link
                  to={`/products/${p.slug}`}
                  className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2"
                >
                  {p.name}
                </Link>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <div className="text-base font-black text-slate-900">
                    ${p.price_min.toFixed(2)} - ${p.price_max.toFixed(2)}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {p.unit}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    MOQ: <span className="font-bold text-slate-700">{p.moq} {p.unit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 pt-0 border-t border-slate-100 flex items-center gap-2">
              <Link to={`/products/${p.slug}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Details
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 text-xs font-semibold"
                onClick={() => onRequestQuote(p)}
              >
                <Send className="w-3 h-3 mr-1" />
                Quote
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
