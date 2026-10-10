import React from "react";
import { Modal } from "../../components/ui/Modal";
import { CompareProductsResponse } from "../../lib/api/products";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface ProductCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CompareProductsResponse | null;
  isLoading?: boolean;
}

export const ProductCompareModal: React.FC<ProductCompareModalProps> = ({
  isOpen,
  onClose,
  data,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product Specification Comparison Matrix"
      maxWidth="xl"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      {isLoading || !data ? (
        <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
          Generating aligned attribute matrix...
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            {/* Table Header: Product Thumbnails & Titles */}
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3 w-40 text-slate-400 font-semibold uppercase tracking-wider text-[11px] bg-slate-50">
                  Attribute
                </th>
                {data.products.map((p) => (
                  <th key={p.id} className="p-3 min-w-[200px] align-top bg-white">
                    <div className="space-y-2">
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200"
                      />
                      <h4 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                      <div className="text-emerald-700 font-black text-sm">
                        ${p.price_min.toFixed(2)} - ${p.price_max.toFixed(2)} / {p.unit}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: Aligned Attribute Matrix Rows */}
            <tbody className="divide-y divide-slate-100">
              {data.matrix.map((row) => (
                <tr key={row.attribute} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-bold text-slate-900 bg-slate-50/60 text-[11px]">
                    {row.attribute}
                  </td>
                  {data.products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-700">
                      {row.attribute === "Verified Supplier" ? (
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span>{row.values[p.id]}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                      ) : (
                        <span>{row.values[p.id] || "—"}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};
