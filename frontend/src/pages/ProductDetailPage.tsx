import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { productsApi, ProductDetailResponse } from "../lib/api/products";
import { ProductDetailView } from "../features/products";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/Button";

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = React.useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.getBySlug(slug);
      setProduct(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Product not found");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (loading) {
    return (
      <div className="py-12 space-y-8 animate-pulse max-w-6xl mx-auto">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-96 bg-slate-200 rounded-2xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-28 bg-slate-200 rounded-2xl" />
            <div className="h-24 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Product Details Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          The requested trade catalog item could not be located or may have been unlisted by the supplier.
        </p>
        <div className="flex gap-3">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse Products</span>
          </Link>
          <Button variant="primary" size="sm" onClick={loadProduct} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProductDetailView
      product={product}
      onToggleSave={(pId, current) => productsApi.toggleSaveProduct(pId, current)}
    />
  );
};
