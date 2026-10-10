import React from "react";
import { CategoryNode, ProductFilterParams } from "../../lib/api/products";
import { Filter, ShieldCheck, RotateCcw } from "lucide-react";

interface ProductFilterSidebarProps {
  categories: CategoryNode[];
  filters: ProductFilterParams;
  onChange: (newFilters: ProductFilterParams) => void;
  onClear: () => void;
  className?: string;
}

const COUNTRIES = ["India", "Vietnam", "Germany", "USA", "UAE"];
const CERTIFICATIONS = ["Organic", "ISO 22000", "FSSAI", "HACCP", "GMP"];

export const ProductFilterSidebar: React.FC<ProductFilterSidebarProps> = ({
  categories,
  filters,
  onChange,
  onClear,
  className = "",
}) => {
  const activeCerts = filters.certifications || [];

  const handleCertToggle = (cert: string) => {
    const updated = activeCerts.includes(cert)
      ? activeCerts.filter((c) => c !== cert)
      : [...activeCerts, cert];
    onChange({ ...filters, certifications: updated, page: 1 });
  };

  return (
    <aside className={`bg-white rounded-2xl border border-slate-200 p-5 space-y-6 ${className}`}>
      {/* Title & Clear Action */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-bold text-slate-900 text-sm">Filters</h3>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-[#2563EB] hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear all</span>
        </button>
      </div>

      {/* 1. Category Tree */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Categories</h4>
        <div className="space-y-1 text-xs">
          <button
            type="button"
            onClick={() => onChange({ ...filters, category: undefined, page: 1 })}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              !filters.category
                ? "bg-blue-50 text-[#2563EB] font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>All Categories</span>
          </button>
          {categories.map((cat) => {
            const isSelected = filters.category === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onChange({ ...filters, category: cat.slug, page: 1 })}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  isSelected
                    ? "bg-blue-50 text-[#2563EB] font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({cat.product_count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Verified Only Toggle */}
      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors border border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-800">Verified Suppliers Only</span>
          </div>
          <input
            type="checkbox"
            checked={!!filters.verified_only}
            onChange={(e) => onChange({ ...filters, verified_only: e.target.checked, page: 1 })}
            className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
        </label>
      </div>

      {/* 3. Origin Country */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Country of Origin</h4>
        <div className="space-y-1.5 text-xs">
          {COUNTRIES.map((country) => {
            const isChecked = filters.country === country;
            return (
              <label
                key={country}
                className="flex items-center gap-2.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <input
                  type="radio"
                  name="origin_country"
                  checked={isChecked}
                  onChange={() => onChange({ ...filters, country, page: 1 })}
                  className="w-3.5 h-3.5 text-[#2563EB] border-slate-300 focus:ring-0 cursor-pointer"
                />
                <span>{country}</span>
              </label>
            );
          })}
          {filters.country && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, country: undefined, page: 1 })}
              className="text-[11px] text-[#2563EB] hover:underline pt-1 block"
            >
              Reset country
            </button>
          )}
        </div>
      </div>

      {/* 4. Certifications Checklist */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Certifications</h4>
        <div className="space-y-1.5 text-xs">
          {CERTIFICATIONS.map((cert) => {
            const isChecked = activeCerts.includes(cert);
            return (
              <label
                key={cert}
                className="flex items-center gap-2.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCertToggle(cert)}
                  className="w-3.5 h-3.5 rounded text-[#2563EB] border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>{cert}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. MOQ Range Filter */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Max MOQ (kg)</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={500}
            placeholder="e.g. 2000"
            value={filters.max_moq || ""}
            onChange={(e) =>
              onChange({
                ...filters,
                max_moq: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-[10px] text-slate-400">Under 2,000 kg (2 MT)</p>
      </div>

      {/* 6. Lead Time Days */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Max Lead Time</h4>
        <select
          value={filters.max_lead_time || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              max_lead_time: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
        >
          <option value="">Any lead time</option>
          <option value="7">Under 7 days</option>
          <option value="14">Under 14 days</option>
          <option value="30">Under 30 days</option>
        </select>
      </div>
    </aside>
  );
};
