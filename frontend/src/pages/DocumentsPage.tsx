import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Trash2,
  Sparkles,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  RefreshCw,
  Clock,
  Award,
} from "lucide-react";
import { documentsApi, DocumentItem, DocumentDetail } from "../lib/api/documents";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";

const DOC_TYPES = [
  { id: "all", label: "All Documents" },
  { id: "invoice", label: "Invoices" },
  { id: "packing_list", label: "Packing Lists" },
  { id: "certificate", label: "Certificates" },
  { id: "bill_of_lading", label: "Bills of Lading" },
  { id: "company_registration", label: "Company Reg" },
  { id: "compliance_file", label: "Compliance" },
  { id: "other", label: "Other" },
];

const STATUS_FILTERS = [
  { id: "all", label: "All Statuses" },
  { id: "uploaded", label: "Uploaded" },
  { id: "processing", label: "Processing" },
  { id: "needs_review", label: "Needs Review" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
];

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("certificate");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review Drawer state
  const [activeDocDetail, setActiveDocDetail] = useState<DocumentDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [reviewFields, setReviewFields] = useState<Record<string, any>>({});
  const [applyToSupplier, setApplyToSupplier] = useState(true);
  const [applyToOrder, setApplyToOrder] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list({
        doc_type: selectedType !== "all" ? selectedType : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
      });
      setDocuments(res.items || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedStatus, searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDocuments();
    }, 250);
    return () => clearTimeout(handler);
  }, [fetchDocuments]);

  // Upload handler
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File exceeds 10MB maximum limit.");
      return;
    }
    setUploadLoading(true);
    setErrorMsg(null);
    try {
      await documentsApi.upload(file, {
        doc_type: uploadDocType,
        title: uploadTitle.trim() || file.name,
        expiry_date: uploadExpiry || undefined,
      });
      setSuccessMsg(`"${file.name}" uploaded successfully!`);
      setUploadTitle("");
      setUploadExpiry("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload document");
    } finally {
      setUploadLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Trigger AI OCR extraction
  const handleExtract = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await documentsApi.extract(id);
      setSuccessMsg("AI Document Intelligence extraction completed!");
      await fetchDocuments();
      openReviewDrawer(id);
    } catch (err: any) {
      setErrorMsg(err.message || "AI extraction failed");
    } finally {
      setActionLoading(false);
    }
  };

  const closeDrawer = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setDrawerOpen(false);
  };

  // Open review drawer
  const openReviewDrawer = async (id: string) => {
    setDrawerLoading(true);
    setDrawerOpen(true);
    setErrorMsg(null);
    try {
      const detail = await documentsApi.get(id);
      setActiveDocDetail(detail);
      const latestExt = detail.extractions && detail.extractions.length > 0
        ? detail.extractions[detail.extractions.length - 1]
        : null;
      if (latestExt && latestExt.extracted_json) {
        setReviewFields({ ...latestExt.extracted_json });
      } else {
        setReviewFields({});
      }

      // Fetch preview blob for live left-side preview
      try {
        const token = localStorage.getItem("tradex_access_token") || "";
        const r = await fetch(`/api/v1/documents/${id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          setPreviewBlobUrl(url);
        } else {
          setPreviewBlobUrl(null);
        }
      } catch {
        setPreviewBlobUrl(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to open document review");
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Confirm extraction
  const handleConfirmExtraction = async () => {
    if (!activeDocDetail) return;
    setActionLoading(true);
    try {
      const res = await documentsApi.confirm(activeDocDetail.id, {
        apply_to_supplier: applyToSupplier,
        apply_to_order: applyToOrder,
        override_data: reviewFields,
      });
      setSuccessMsg(
        `Document verified! Actions: ${res.applied_actions && res.applied_actions.length > 0 ? res.applied_actions.join(", ") : "Recorded to registry"}`
      );
      setDrawerOpen(false);
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to confirm document");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject extraction
  const handleRejectExtraction = async () => {
    if (!activeDocDetail) return;
    setActionLoading(true);
    try {
      await documentsApi.reject(activeDocDetail.id, {
        reason: "Rejected during compliance review",
      });
      setSuccessMsg("Document marked as rejected.");
      setDrawerOpen(false);
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reject document");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete document
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await documentsApi.delete(id);
      setSuccessMsg("Document deleted.");
      fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete document");
    }
  };

  // Download document
  const handleDownload = async (doc: DocumentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await documentsApi.download(doc.id, doc.original_filename);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to download document");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
          </span>
        );
      case "needs_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs Review
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Processing
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" /> Uploaded
          </span>
        );
    }
  };

  const getConfidenceBadge = (score?: number | null) => {
    if (score === undefined || score === null) return null;
    const pct = Math.round(score * 100);
    const isHigh = pct >= 70;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ${
          isHigh
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}
      >
        <Sparkles className="w-3 h-3" />
        {pct}% conf
      </span>
    );
  };

  const expiredDocsCount = documents.filter((d) => d.is_expired).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
              Document Center & AI Intelligence
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Cryptographically validated document vault with automated OCR extraction, multi-tenant RBAC, and human-in-the-loop verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">
              &times;
            </button>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">
              &times;
            </button>
          </div>
        )}

        {/* Expiry Warning Banner */}
        {expiredDocsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-semibold">{expiredDocsCount} Certificate(s) Expired or Expiring Soon:</span>
                <span className="text-sm text-amber-800 ml-1">
                  Please renew certificates or upload updated compliance documents to avoid audit failure.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-6 transition-all text-center ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/50"
              : "border-slate-300 hover:border-slate-400 bg-white"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
          />

          <div className="max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 mx-auto bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">
                Drag and drop trade documents here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supported formats: PDF, PNG, JPG, DOCX, XLSX (up to 10 MB). Executable spoofing strictly checked via magic bytes.
              </p>
            </div>

            {/* Quick Upload Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-left">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Doc Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="certificate">Certificate (Organic/ISO)</option>
                  <option value="invoice">Commercial Invoice</option>
                  <option value="packing_list">Packing List</option>
                  <option value="bill_of_lading">Bill of Lading</option>
                  <option value="company_registration">Company Registration</option>
                  <option value="compliance_file">Compliance Audit</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Optional Title</label>
                <input
                  type="text"
                  placeholder="e.g. APEDA Organic 2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={uploadExpiry}
                  onChange={(e) => setUploadExpiry(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {uploadLoading && (
              <div className="flex items-center justify-center gap-2 text-indigo-600 text-xs font-medium pt-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validating magic bytes and encrypting storage...
              </div>
            )}
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by title or filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
            {DOC_TYPES.map((tab) => {
              const active = selectedType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8 text-slate-400" />}
              title="No documents found"
              description="Upload certificates, invoices, packing lists or compliance files to trigger AI Document Intelligence."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3.5 px-4">Document Title</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">AI Extraction</th>
                    <th className="py-3.5 px-4">Expiry Date</th>
                    <th className="py-3.5 px-4">Uploaded</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => openReviewDrawer(doc.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{doc.title}</p>
                            <p className="text-xs text-slate-400 truncate">{doc.original_filename}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {doc.doc_type.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(doc.status)}</td>

                      <td className="py-3.5 px-4">
                        {doc.confidence_score ? (
                          getConfidenceBadge(doc.confidence_score)
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {doc.expiry_date ? (
                          <span
                            className={`text-xs ${
                              doc.is_expired ? "text-rose-600 font-semibold flex items-center gap-1" : "text-slate-600"
                            }`}
                          >
                            {doc.is_expired && <AlertTriangle className="w-3.5 h-3.5" />}
                            {doc.expiry_date}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Run AI Extraction"
                            onClick={(e) => handleExtract(doc.id, e)}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-md transition-colors"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            title="Review Details"
                            onClick={() => openReviewDrawer(doc.id)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Download Secure Document"
                            onClick={(e) => handleDownload(doc, e)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete"
                            onClick={(e) => handleDelete(doc.id, e)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Review Drawer / Modal */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    AI Document Extraction & Human Review
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verify extracted trade entities before syncing to Supplier profile or Orders.
                  </p>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg"
              >
                &times;
              </button>
            </div>

            {drawerLoading || !activeDocDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Pane: Live Document Preview & Overview */}
                <div className="space-y-4 border-r border-slate-100 pr-0 md:pr-6">
                  {/* Document Preview Box */}
                  <div className="bg-slate-900/5 rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        Document Live Preview
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-[180px]">
                        {activeDocDetail.original_filename}
                      </span>
                    </div>

                    {previewBlobUrl ? (
                      activeDocDetail.mime_type.startsWith("image/") ? (
                        <div className="w-full h-72 sm:h-80 bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                          <img
                            src={previewBlobUrl}
                            alt={activeDocDetail.title}
                            className="max-h-full max-w-full object-contain rounded"
                          />
                        </div>
                      ) : (
                        <iframe
                          src={previewBlobUrl}
                          title={activeDocDetail.title}
                          className="w-full h-72 sm:h-80 rounded-lg border border-slate-200 bg-white"
                        />
                      )
                    ) : (
                      <div className="w-full h-72 sm:h-80 bg-white rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center space-y-2">
                        <FileText className="w-10 h-10 text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">
                          Secure preview stream loading or ready for download.
                        </p>
                        <button
                          onClick={(e) => handleDownload(activeDocDetail, e)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Document
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Document Metadata
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Title:</span>
                        <span className="font-medium text-slate-800">{activeDocDetail.title}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Filename:</span>
                        <span className="font-mono text-slate-700">{activeDocDetail.original_filename}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Type:</span>
                        <span className="capitalize font-medium text-slate-800">
                          {activeDocDetail.doc_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">File Size:</span>
                        <span className="font-medium text-slate-800">
                          {(activeDocDetail.file_size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Status:</span>
                        <span>{getStatusBadge(activeDocDetail.status)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Uploader:</span>
                        <span className="font-medium text-slate-800">
                          {activeDocDetail.user?.name || activeDocDetail.user?.email || "Current User"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDownload(activeDocDetail, e)}
                      className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Verified Original
                    </button>
                  </div>

                  {/* Extraction Info Banner */}
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      doc_extract.v1 Intelligence Engine
                    </h4>
                    <p className="text-xs text-indigo-800/80">
                      OCR model extracts trade entities with confidence scores. Fields below 70% confidence are highlighted in red for mandatory human inspection.
                    </p>
                  </div>
                </div>

                {/* Right Pane: Extracted Entities Review with <70% Red Highlighting */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-600" />
                      Extracted Trade Entities
                    </h3>
                    {reviewFields.confidence_score && getConfidenceBadge(reviewFields.confidence_score)}
                  </div>

                  <div className="space-y-3">
                    {/* Helper to render editable field with red styling when confidence < 70% */}
                    {[
                      { label: "Company Name", key: "company_name", type: "text", placeholder: "e.g. Sri Bharat Spices Pvt Ltd" },
                      { label: "Product / Commodity", key: "product", type: "text", placeholder: "e.g. Organic Turmeric Powder" },
                      { label: "Certification Type", key: "certification_type", type: "text", placeholder: "e.g. EU Organic / ISO 22000" },
                      { label: "Certificate Number", key: "certificate_number", type: "text", placeholder: "e.g. IN-BIO-149-CU-892110" },
                      { label: "Issue Date", key: "issue_date", type: "date" },
                      { label: "Expiry Date", key: "expiry_date", type: "date" },
                      { label: "Quantity", key: "quantity", type: "number", placeholder: "e.g. 20000" },
                      { label: "Unit", key: "unit", type: "text", placeholder: "e.g. kg, MT" },
                      { label: "Capacity", key: "capacity", type: "text", placeholder: "e.g. 15,000 MT/year" },
                      { label: "Invoice Amount", key: "invoice_amount", type: "number", placeholder: "e.g. 57000.00" },
                      { label: "Currency", key: "currency", type: "text", placeholder: "e.g. EUR, USD" },
                    ].map((f) => {
                      const conf = reviewFields.field_confidences?.[f.key];
                      const isLowConf = conf !== undefined && conf !== null && conf < 0.70;
                      const pct = conf !== undefined && conf !== null ? Math.round(conf * 100) : null;

                      return (
                        <div key={f.key}>
                          <div className="flex justify-between items-center mb-1">
                            <label className={`text-xs font-medium ${isLowConf ? "text-red-700 font-bold" : "text-slate-700"}`}>
                              {f.label}
                            </label>
                            {pct !== null && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                  isLowConf
                                    ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                <Sparkles className="w-3 h-3" />
                                {pct}% conf {isLowConf && "(Review Required)"}
                              </span>
                            )}
                          </div>
                          <input
                            type={f.type}
                            placeholder={f.placeholder}
                            value={reviewFields[f.key] ?? ""}
                            onChange={(e) =>
                              setReviewFields({
                                ...reviewFields,
                                [f.key]: f.type === "number" ? (e.target.value ? parseFloat(e.target.value) : "") : e.target.value,
                              })
                            }
                            className={`w-full text-xs rounded-lg p-2 transition-all ${
                              isLowConf
                                ? "border-2 border-red-400 bg-red-50/60 text-red-950 font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                                : "border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            }`}
                          />
                          {isLowConf && (
                            <p className="text-[11px] text-red-600 mt-0.5 flex items-center gap-1 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                              Confidence below 70%. Untrusted input must be reviewed prior to confirmation.
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {/* HS Codes */}
                    <div>
                      {(() => {
                        const conf = reviewFields.field_confidences?.hs_codes;
                        const isLowConf = conf !== undefined && conf !== null && conf < 0.70;
                        const pct = conf !== undefined && conf !== null ? Math.round(conf * 100) : null;
                        return (
                          <>
                            <div className="flex justify-between items-center mb-1">
                              <label className={`text-xs font-medium ${isLowConf ? "text-red-700 font-bold" : "text-slate-700"}`}>
                                HS Codes
                              </label>
                              {pct !== null && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                    isLowConf
                                      ? "bg-red-100 text-red-800 border border-red-300"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3" />
                                  {pct}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={Array.isArray(reviewFields.hs_codes) ? reviewFields.hs_codes.join(", ") : reviewFields.hs_codes || ""}
                              onChange={(e) =>
                                setReviewFields({
                                  ...reviewFields,
                                  hs_codes: e.target.value.split(",").map((s) => s.trim()),
                                })
                              }
                              className={`w-full text-xs rounded-lg p-2 transition-all ${
                                isLowConf
                                  ? "border-2 border-red-400 bg-red-50/60 text-red-950 focus:ring-2 focus:ring-red-500"
                                  : "border border-slate-200 focus:ring-1 focus:ring-indigo-500"
                              }`}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Actions checkboxes */}
                  <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyToSupplier}
                        onChange={(e) => setApplyToSupplier(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 font-medium">Apply verified certificates to Supplier Profile</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyToOrder}
                        onChange={(e) => setApplyToOrder(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 font-medium">Match commercial invoice to linked Order</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={handleRejectExtraction}
                disabled={actionLoading}
                className="px-4 py-2 border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                Reject Extraction
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeDrawer}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmExtraction}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm & Apply Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
