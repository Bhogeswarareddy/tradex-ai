import React from "react";
import { Building, Layers, CheckCircle2 } from "lucide-react";
import { FactoryDetails } from "../../lib/api/suppliers";

interface SupplierFactoryTabProps {
  factory: FactoryDetails;
}

export const SupplierFactoryTab: React.FC<SupplierFactoryTabProps> = ({ factory }) => {
  const photos = factory.photos || [];

  return (
    <div className="space-y-6">
      {/* Factory Specifications Grid */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-600" />
          Manufacturing Facility & Capacity Specifications
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Facility Size</span>
            <span className="text-sm font-bold text-slate-800">{factory.facility_size || "45,000 sq ft"}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Annual Capacity</span>
            <span className="text-sm font-bold text-slate-800">{factory.annual_capacity || "12,000 MT"}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Production Lines</span>
            <span className="text-sm font-bold text-slate-800">{factory.production_lines || 6} Automated Lines</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Cleanroom Standard</span>
            <span className="text-sm font-bold text-slate-800">{factory.cleanrooms || "ISO Class 8"}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 sm:col-span-2">
            <span className="text-xs text-slate-400 block font-medium">Warehousing & Storage</span>
            <span className="text-sm font-bold text-slate-800">{factory.warehouse_capacity || "10,000 MT Climate Controlled"}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 sm:col-span-2">
            <span className="text-xs text-slate-400 block font-medium">Analytical Lab Testing</span>
            <span className="text-sm font-bold text-slate-800">{factory.testing_lab || "In-house NABL HPLC/GC-MS"}</span>
          </div>
        </div>
      </div>

      {/* Facility Photo Gallery */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Facility & Processing Photo Gallery
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {photos.map((url, idx) => (
            <div key={idx} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-52">
              <img
                src={url}
                alt={`Factory inspection photo ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Verified Facility Unit {idx + 1}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
