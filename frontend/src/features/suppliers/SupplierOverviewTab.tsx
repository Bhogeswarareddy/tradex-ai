import React from "react";
import {
  CheckCircle2,
  Globe,
  Package,
  Star,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Award,
} from "lucide-react";
import { SupplierProfileResponse } from "../../lib/api/suppliers";

interface SupplierOverviewTabProps {
  supplier: SupplierProfileResponse;
  onViewAllCertificates: () => void;
}

export const SupplierOverviewTab: React.FC<SupplierOverviewTabProps> = ({
  supplier,
  onViewAllCertificates,
}) => {
  return (
    <div className="space-y-6">
      {/* 4 Key Statistics Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* On-Time Delivery */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {supplier.on_time_rate}%
            </div>
            <div className="text-xs font-semibold text-slate-500">On-Time Delivery</div>
          </div>
        </div>

        {/* Global Buyers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {supplier.total_buyers_count}+
            </div>
            <div className="text-xs font-semibold text-slate-500">Global Buyers</div>
          </div>
        </div>

        {/* Monthly Capacity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {supplier.capacity_per_month}
            </div>
            <div className="text-xs font-semibold text-slate-500">Monthly Capacity</div>
          </div>
        </div>

        {/* Rating */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100">
            <Star className="w-6 h-6 fill-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {supplier.rating.toFixed(1)}/5
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Trust Score ({supplier.total_reviews} reviews)
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: About Company & Certifications Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: About Company & Export Destinations */}
        <div className="lg:col-span-8 space-y-6">
          {/* About Company Card */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              About Company
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {supplier.about_company}
            </p>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Headquarters</span>
                <span className="font-bold text-slate-800">{supplier.city}, {supplier.country}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Established</span>
                <span className="font-bold text-slate-800">{supplier.years_in_business} Years Ago</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Avg Response</span>
                <span className="font-bold text-slate-800">&lt; {supplier.response_time_hours} Hours</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Repeat Rate</span>
                <span className="font-bold text-emerald-600">{supplier.repeat_buyer_rate}%</span>
              </div>
            </div>

            {/* Platform Verified Facts vs Supplier Claims */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/70 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Platform-Verified Facts</span>
                </div>
                <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside">
                  <li>Business registration & tax ID authenticated</li>
                  <li>On-time delivery tracking: <strong>{supplier.on_time_rate}% verified</strong></li>
                  <li>{supplier.certifications.length} active third-party audited certificates</li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/70 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Supplier-Reported Claims</span>
                </div>
                <ul className="text-[11px] text-blue-900 space-y-1 list-disc list-inside">
                  <li>Self-reported monthly capacity: <strong>{supplier.capacity_per_month}</strong></li>
                  <li>Target export markets: {supplier.export_countries.slice(0, 3).join(", ")}</li>
                  <li>Sales team languages: {supplier.languages.join(", ") || "English, Hindi"}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Export Countries / Markets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Primary Export Destinations
            </h4>
            <div className="flex flex-wrap gap-2">
              {supplier.export_countries.map((country, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  {country}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Certifications Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white p-6 rounded-2xl shadow-xl space-y-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="font-bold text-sm text-white">Compliance & Quality</h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Audited
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Third-party verified agricultural certifications and international food safety management systems.
            </p>

            {/* Certifications List */}
            <div className="space-y-2.5">
              {supplier.certifications.map((cert, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-sm"
                >
                  <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-white truncate">
                      {cert.name}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>No: {cert.certificate_no}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onViewAllCertificates}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-[#38BDF8] flex items-center justify-center gap-2 transition-colors"
            >
              <span>View All Certificates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
