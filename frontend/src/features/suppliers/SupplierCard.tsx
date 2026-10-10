import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Star,
  CheckCircle2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { SupplierListItem } from "../../lib/api/suppliers";
import { Button } from "../../components/ui/Button";

interface SupplierCardProps {
  supplier: SupplierListItem;
  onToggleSave?: (supplierId: string, current: boolean) => void;
  onRequestQuote?: (supplier: SupplierListItem) => void;
}

export const SupplierCard: React.FC<SupplierCardProps> = ({
  supplier,
  onToggleSave,
  onRequestQuote,
}) => {
  const [isSaved, setIsSaved] = useState(supplier.is_saved);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (onToggleSave) {
      onToggleSave(supplier.id, isSaved);
    }
  };

  const bannerImg =
    supplier.banner_url ||
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80";
  const logoImg =
    supplier.logo_url ||
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80";

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      {/* Top Banner with Heart Button */}
      <div className="relative h-28 w-full bg-slate-100 overflow-hidden">
        <img
          src={bannerImg}
          alt={supplier.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Save to Favorites Heart Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-colors ${
            isSaved
              ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
              : "bg-white/80 text-slate-600 hover:text-rose-500 hover:bg-white"
          }`}
          title="Save Supplier"
        >
          <Heart className={`w-4 h-4 ${isSaved ? "fill-white" : ""}`} />
        </button>

        {/* Circular Logo overlapping the banner bottom */}
        <div className="absolute -bottom-4 left-4">
          <div className="w-14 h-14 rounded-full border-2 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
            <img src={logoImg} alt={supplier.name} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="pt-6 p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Header: Name, Verified Badge & Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/suppliers/${supplier.id}`}
                className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
              >
                {supplier.name}
              </Link>
              {supplier.verified_status === "verified" && (
                <span title="Verified Exporter">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {supplier.city}, {supplier.country}
              </span>
              <span>•</span>
              <span className="font-medium text-slate-700">{supplier.years_in_business} Years in Business</span>
            </div>
          </div>

          {/* Description */}
          {supplier.description && (
            <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
              {supplier.description}
            </p>
          )}

          {/* Stats Bar: Rating, Capacity, Response */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center mt-3">
            <div>
              <div className="flex items-center justify-center gap-1 text-amber-500 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{supplier.rating.toFixed(1)}</span>
              </div>
              <span className="text-[10px] text-slate-400">({supplier.total_reviews} reviews)</span>
            </div>
            <div className="border-x border-slate-200">
              <div className="text-xs font-bold text-slate-900 truncate">{supplier.capacity_per_month}</div>
              <span className="text-[10px] text-slate-400">Capacity</span>
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-600">{supplier.on_time_rate}%</div>
              <span className="text-[10px] text-slate-400">On-Time</span>
            </div>
          </div>

          {/* Certifications Chips */}
          {supplier.certifications && supplier.certifications.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              {supplier.certifications.slice(0, 3).map((cert, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold"
                >
                  {cert}
                </span>
              ))}
              {supplier.certifications.length > 3 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  +{supplier.certifications.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Main Products */}
          {supplier.main_products && supplier.main_products.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Main:</span>
              {supplier.main_products.slice(0, 2).map((prod, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] truncate max-w-[140px]"
                >
                  {prod}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          <Link to={`/suppliers/${supplier.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs font-semibold">
              View Profile
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs font-semibold shadow-sm"
            onClick={() => onRequestQuote && onRequestQuote(supplier)}
          >
            Request Quote
          </Button>
        </div>
      </div>
    </div>
  );
};
