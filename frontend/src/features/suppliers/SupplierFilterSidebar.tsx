import React from "react";
import { SupplierFilterParams } from "../../lib/api/suppliers";
import { Filter, ShieldCheck, RotateCcw } from "lucide-react";

interface SupplierFilterSidebarProps {
  filters: SupplierFilterParams;
  onChange: (newFilters: SupplierFilterParams) => void;
  onClear: () => void;
  className?: string;
}

const COUNTRIES = ["India", "Vietnam", "Germany", "USA", "UAE"];
const CATEGORIES = [
  { label: "All Categories", value: "" },
  { label: "Spices & Condiments", value: "spices" },
  { label: "Agricultural Commodities", value: "agri" },
  { label: "Textiles & Yarns", value: "textiles" },
  { label: "Industrial Machinery", value: "machinery" },
];
const CERTIFICATIONS = [
  "Organic",
  "ISO 22000",
  "HACCP",
  "APEDA",
  "FSSAI",
  "ISO 9001",
];

export const SupplierFilterSidebar: React.FC<SupplierFilterSidebarProps> = ({
  filters,
  onChange,
  onClear,
  className = "",
}) => {
  const handleCountryToggle = (c: string) => {
    if (filters.country === c) {
      onChange({ ...filters, country: undefined, page: 1 });
    } else {
      onChange({ ...filters, country: c, page: 1 });
    }
  };

  const handleCertToggle = (cert: string) => {
    const current = filters.certifications || [];
    const updated = current.includes(cert)
      ? current.filter((item) => item !== cert)
      : [...current, cert];
    onChange({
      ...filters,
      certifications: updated.length > 0 ? updated : undefined,
      page: 1,
    });
  };

  const handleRatingChange = (r: number) => {
    if (filters.min_rating === r) {
      onChange({ ...filters, min_rating: undefined, page: 1 });
    } else {
      onChange({ ...filters, min_rating: r, page: 1 });
    }
  };

  const handleYearsChange = (y: number) => {
    if (filters.min_years === y) {
      onChange({ ...filters, min_years: undefined, page: 1 });
    } else {
      onChange({ ...filters, min_years: y, page: 1 });
    }
  };

  return (
    <aside className={`bg-white rounded-2xl border border-slate-200 p-5 space-y-6 ${className}`}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-sm">Supplier Filters</h3>
        </div>
        <button
          onClick={onClear}
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Verified Supplier Only Switch */}
      <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <label htmlFor="verified-suppliers-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
            Verified Only
          </label>
        </div>
        <input
          id="verified-suppliers-toggle"
          type="checkbox"
          checked={!!filters.verified_only}
          onChange={(e) => onChange({ ...filters, verified_only: e.target.checked, page: 1 })}
          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
        />
      </div>

      {/* Product Category Dropdown */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Product Category
        </label>
        <select
          value={filters.product_category || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              product_category: e.target.value || undefined,
              page: 1,
            })
          }
          className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-white p-2.5 focus:border-blue-500 focus:outline-none"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Supplier Origin Country */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Origin Country
        </label>
        <div className="space-y-1.5">
          {COUNTRIES.map((c) => {
            const isChecked = filters.country === c;
            return (
              <label
                key={c}
                className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer py-0.5"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCountryToggle(c)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>{c}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Certifications Multi-select */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Accreditations
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CERTIFICATIONS.map((cert) => {
            const active = (filters.certifications || []).includes(cert);
            return (
              <button
                key={cert}
                type="button"
                onClick={() => handleCertToggle(cert)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {cert}
              </button>
            );
          })}
        </div>
      </div>

      {/* Minimum Rating */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Minimum Trust Rating
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[4.0, 4.5, 4.8].map((score) => {
            const active = filters.min_rating === score;
            return (
              <button
                key={score}
                type="button"
                onClick={() => handleRatingChange(score)}
                className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                  active
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                ★ {score}+
              </button>
            );
          })}
        </div>
      </div>

      {/* Minimum Years in Business */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Years Established
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[5, 10, 15].map((yrs) => {
            const active = filters.min_years === yrs;
            return (
              <button
                key={yrs}
                type="button"
                onClick={() => handleYearsChange(yrs)}
                className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {yrs}+ Years
              </button>
            );
          })}
        </div>
      </div>

      {/* Min On-Time Rate */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          On-Time Delivery Rate
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={80}
            max={99}
            step={1}
            value={filters.min_on_time || 80}
            onChange={(e) =>
              onChange({
                ...filters,
                min_on_time: Number(e.target.value) > 80 ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <span className="text-xs font-bold text-slate-700 min-w-[42px] text-right">
            {filters.min_on_time ? `${filters.min_on_time}%` : "Any"}
          </span>
        </div>
      </div>
    </aside>
  );
};
