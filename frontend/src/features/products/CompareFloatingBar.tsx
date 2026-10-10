import React from "react";
import { ProductItem } from "../../lib/api/products";
import { Scale, X, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface CompareFloatingBarProps {
  selectedProducts: ProductItem[];
  onCompareClick: () => void;
  onClear: () => void;
  onRemove: (productId: string) => void;
}

export const CompareFloatingBar: React.FC<CompareFloatingBarProps> = ({
  selectedProducts,
  onCompareClick,
  onClear,
  onRemove,
}) => {
  if (selectedProducts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] sm:w-full bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 p-3 sm:p-4 animate-in slide-in-from-bottom-6 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Selected Thumbnails & Count */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 text-[#38BDF8] flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white">
                Compare Products
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                {selectedProducts.length} of 4
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Select 2 to 4 items for aligned attribute breakdown
            </p>
          </div>
        </div>

        {/* Selected Products Badges */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {selectedProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-[11px] shrink-0"
            >
              <span className="truncate max-w-[100px]">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="text-slate-400 hover:text-white"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            Clear
          </button>
          <Button
            variant="primary"
            size="sm"
            disabled={selectedProducts.length < 2}
            onClick={onCompareClick}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Compare Now
          </Button>
        </div>
      </div>
    </div>
  );
};
