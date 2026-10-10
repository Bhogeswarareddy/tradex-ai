import React, { useState, useEffect } from "react";
import {
  Award,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import { supplierPortalApi } from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export const SupplierCertificationsView: React.FC = () => {
  const [certs, setCerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("ISO 22000 Food Safety");
  const [formCertNo, setFormCertNo] = useState("");
  const [formBody, setFormBody] = useState("TUV SUD South Asia");
  const [formIssued, setFormIssued] = useState("");
  const [formExpires, setFormExpires] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCertifications();
  }, []);

  const loadCertifications = async () => {
    setIsLoading(true);
    try {
      const data = await supplierPortalApi.getCertifications();
      setCerts(data);
    } catch (err) {
      console.error("Failed to load certs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCertNo.trim()) {
      setErrorMsg("Certificate number is required.");
      return;
    }
    setIsUploading(true);
    setErrorMsg(null);
    try {
      await supplierPortalApi.uploadCertification({
        certification_name: formName,
        certificate_no: formCertNo.trim(),
        issued_at: formIssued || undefined,
        expires_at: formExpires || undefined,
      });
      setIsModalOpen(false);
      setFormCertNo("");
      loadCertifications();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload certification");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm("Are you sure you want to remove this certification?")) return;
    try {
      await supplierPortalApi.deleteCertification(id);
      loadCertifications();
    } catch (err) {
      alert("Failed to delete certification.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            Compliance Certifications & Audit Documents ({certs.length})
          </h3>
          <p className="text-xs text-slate-500">
            Verified international standards build high buyer trust score and qualify for enterprise RFQs
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => { setIsModalOpen(true); setErrorMsg(null); }}
          className="text-xs font-bold shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add / Upload Certificate
        </Button>
      </div>

      {/* Certifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading compliance certifications...
          </div>
        ) : certs.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            No certifications uploaded yet. Add USDA Organic, ISO 22000, or HACCP.
          </div>
        ) : (
          certs.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {c.issuing_body || "Official Accredited Registrar"}
                      </span>
                    </div>
                  </div>

                  {c.expiry_warning ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Expires in {c.days_to_expiry} days
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold shrink-0">
                      Verified Active
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Certificate No:</span>
                    <span className="font-mono font-bold text-slate-800">{c.certificate_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Valid From:</span>
                    <span className="text-slate-700 font-medium">{c.issued_at || "2023-01-15"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Expires On:</span>
                    <span className={`font-semibold ${c.expiry_warning ? "text-amber-600" : "text-slate-700"}`}>
                      {c.expires_at || "2028-01-14"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View Audit PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCert(c.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Remove Certification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Certificate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upload Compliance Certificate
                </h3>
                <p className="text-xs text-slate-500">
                  Third-party verified agricultural or food safety certification
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUploadCert} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Certification Name</label>
                <select
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="USDA Organic & NPOP">USDA Organic & NPOP</option>
                  <option value="ISO 22000 Food Safety">ISO 22000 Food Safety</option>
                  <option value="HACCP Codex Alimentarius">HACCP Codex Alimentarius</option>
                  <option value="APEDA Export Certified">APEDA Export Certified</option>
                  <option value="BRCGS Global Food Standard">BRCGS Global Food Standard</option>
                  <option value="Halal International Certified">Halal International Certified</option>
                  <option value="Kosher Certified">Kosher Certified</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Certificate Number *</label>
                <Input
                  value={formCertNo}
                  onChange={(e) => setFormCertNo(e.target.value)}
                  placeholder="e.g. ORG-IND-88421"
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Issuing Registrar / Body</label>
                <Input
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="e.g. OneCert International / TUV SUD"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Issued Date</label>
                  <Input
                    type="date"
                    value={formIssued}
                    onChange={(e) => setFormIssued(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Expiration Date</label>
                  <Input
                    type="date"
                    value={formExpires}
                    onChange={(e) => setFormExpires(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* PDF Document Upload Mock */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-1 bg-slate-50">
                <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                <span className="text-xs font-bold text-slate-700 block">
                  Attach Official Audit PDF (Optional)
                </span>
                <span className="text-[10px] text-slate-400">
                  TradeX OCR will verify the certificate seal & issuer public key
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isUploading} className="font-bold text-xs">
                  Upload Certification
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
