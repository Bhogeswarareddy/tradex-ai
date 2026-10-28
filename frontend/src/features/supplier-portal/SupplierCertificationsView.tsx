import React, { useState, useEffect } from "react";
import {
  Award,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  CheckCircle2,
} from "lucide-react";
import { supplierPortalApi } from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export const SupplierCertificationsView: React.FC = () => {
  const [certs, setCerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("ISO 9001 Quality Management");
  const [formCertNo, setFormCertNo] = useState("");
  const [formIssued, setFormIssued] = useState("");
  const [formExpires, setFormExpires] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Link to products state
  const [selectedCertForLink, setSelectedCertForLink] = useState<any | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);

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

  const handleOpenLinkModal = async (cert: any) => {
    setSelectedCertForLink(cert);
    setLinkSuccessMsg(null);
    try {
      const prodsRes = await supplierPortalApi.getProducts({ page_size: 50 });
      setSupplierProducts(prodsRes.items || []);
      // Check which products currently have this cert
      const linked = (prodsRes.items || [])
        .filter((p: any) =>
          p.certifications_json?.some((c: any) =>
            (typeof c === "string" ? c : c.name) === cert.name
          )
        )
        .map((p: any) => p.id);
      setSelectedProductIds(linked);
    } catch (err) {
      console.error("Failed to load products for linking", err);
    }
  };

  const handleSaveProductLinks = async () => {
    if (!selectedCertForLink) return;
    setIsLinking(true);
    try {
      await supplierPortalApi.linkCertificationToProducts(selectedCertForLink.id, selectedProductIds);
      setLinkSuccessMsg(`Linked "${selectedCertForLink.name}" to ${selectedProductIds.length} products.`);
      setTimeout(() => {
        setSelectedCertForLink(null);
        setLinkSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message || "Failed to link certification to products");
    } finally {
      setIsLinking(false);
    }
  };

  const getStatusBadge = (cert: any) => {
    if (!cert.is_valid || (cert.days_to_expiry !== undefined && cert.days_to_expiry < 0)) {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">Expired</span>;
    }
    if (cert.expiry_warning) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Expiring in {cert.days_to_expiry}d
        </span>
      );
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Verified</span>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

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
          onClick={() => {
            setIsModalOpen(true);
            setErrorMsg(null);
          }}
          className="text-xs font-bold shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Upload Certificate
        </Button>
      </div>

      {/* Grid of Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map((c) => (
          <div
            key={c.id}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{c.name}</h4>
                    <span className="text-[11px] font-mono text-slate-400">{c.certificate_no}</span>
                  </div>
                </div>
                {getStatusBadge(c)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Issuer</span>
                  <span className="font-medium text-slate-700">{c.issuing_body || "Accredited Body"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Expiry Date</span>
                  <span className={`font-semibold ${c.expiry_warning ? "text-amber-700 font-bold" : "text-slate-700"}`}>
                    {c.expires_at || "Permanent"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenLinkModal(c)}
                className="text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <LinkIcon className="w-3.5 h-3.5 mr-1" />
                Link to Products
              </Button>
              <button
                type="button"
                onClick={() => handleDeleteCert(c.id)}
                className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Remove certification"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Upload Compliance Certificate</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUploadCert} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Standard / Certificate Name *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. ISO 9001, HACCP, USDA Organic"
                  className="text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Certificate / License Number *</label>
                <Input
                  value={formCertNo}
                  onChange={(e) => setFormCertNo(e.target.value)}
                  placeholder="e.g. CERT-ISO-9001-2024"
                  className="text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Issue Date</label>
                  <Input
                    type="date"
                    value={formIssued}
                    onChange={(e) => setFormIssued(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Expiry Date</label>
                  <Input
                    type="date"
                    value={formExpires}
                    onChange={(e) => setFormExpires(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isUploading} className="text-xs font-bold">
                  {isUploading ? "Uploading..." : "Save Certificate"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link to Products Modal */}
      {selectedCertForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Link Certification to Products</h3>
                <p className="text-xs text-slate-500">{selectedCertForLink.name} ({selectedCertForLink.certificate_no})</p>
              </div>
              <button onClick={() => setSelectedCertForLink(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {linkSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-emerald-900 text-sm">{linkSuccessMsg}</h4>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Select which products in your catalog carry this audit certification. Certified badges display in buyer search results.
                </p>

                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 divide-y divide-slate-100">
                  {supplierProducts.map((p) => {
                    const isChecked = selectedProductIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProductIds([...selectedProductIds, p.id]);
                            } else {
                              setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{p.category_name}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCertForLink(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isLinking}
                    onClick={handleSaveProductLinks}
                    className="text-xs font-bold"
                  >
                    {isLinking ? "Saving..." : `Save Links (${selectedProductIds.length})`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
