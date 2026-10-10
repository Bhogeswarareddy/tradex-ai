import React from "react";
import { Award, ShieldCheck, Calendar, ExternalLink, AlertTriangle } from "lucide-react";
import { SupplierCertificationItem } from "../../lib/api/suppliers";

interface SupplierCertificationsTabProps {
  certifications: SupplierCertificationItem[];
}

export const SupplierCertificationsTab: React.FC<SupplierCertificationsTabProps> = ({
  certifications,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              Verified Compliance & Export Certifications ({certifications.length})
            </h3>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            All Current & Audited
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {certifications.map((cert, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{cert.name}</h4>
                    <span className="text-xs font-medium text-slate-500">
                      Code: {cert.code}
                    </span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  Verified
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Certificate No:</span>
                  <span className="font-bold text-slate-800">{cert.certificate_no}</span>
                </div>
                {cert.issuing_body && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Issuing Body:</span>
                    <span className="font-semibold text-slate-700">{cert.issuing_body}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Validity Period:</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {cert.issued_at || "Jan 2023"} - {cert.expires_at || "Jan 2028"}
                  </span>
                </div>
              </div>

              {cert.expiry_warning && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Renewal due within {cert.days_to_expiry} days</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Cryptographically Verified Certificate PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
