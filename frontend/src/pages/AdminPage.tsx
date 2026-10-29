import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  CheckCircle,
  XCircle,
  FileText,
  Settings,
  Download,
  AlertCircle,
  Search,
  ExternalLink,
  Lock,
  Cpu,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  adminApi,
  AdminOverview,
  AdminUser,
  VerificationQueueItem,
  AuditLogItem,
  SystemSettingItem,
} from "../lib/api/admin";

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "verification" | "moderation" | "doc_review" | "weights" | "audit" | "settings" | "ai_diagnostics" | "indexing"
  >("overview");

  // State
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState<string>("");
  const [verificationQueue, setVerificationQueue] = useState<VerificationQueueItem[]>([]);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [moderationProducts, setModerationProducts] = useState<any[]>([]);
  const [moderationRfqs, setModerationRfqs] = useState<any[]>([]);
  const [pendingReviewProducts, setPendingReviewProducts] = useState<any[]>([]);
  const [productReviewNotes, setProductReviewNotes] = useState<Record<string, string>>({});
  const [productRejectionReason, setProductRejectionReason] = useState<Record<string, string>>({});
  const [docReviewQueue, setDocReviewQueue] = useState<any[]>([]);
  const [matchingWeights, setMatchingWeights] = useState<Record<string, number>>({
    price: 0.35,
    lead_time: 0.25,
    rating: 0.20,
    compliance: 0.10,
    capacity: 0.10,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [aiDiagnostics, setAiDiagnostics] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testingAi, setTestingAi] = useState<boolean>(false);
  const [indexJobs, setIndexJobs] = useState<any[]>([]);
  const [indexTotal, setIndexTotal] = useState<number>(0);
  const [indexStatusFilter, setIndexStatusFilter] = useState<string>("all");
  const [indexEntityFilter, setIndexEntityFilter] = useState<string>("all");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [isReindexing, setIsReindexing] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "overview") {
        const ov = await adminApi.getOverview();
        setOverview(ov);
      } else if (activeTab === "users") {
        const u = await adminApi.listUsers({ search: userSearch || undefined });
        setUsers(u);
      } else if (activeTab === "verification") {
        const v = await adminApi.getVerificationQueue();
        setVerificationQueue(v);
      } else if (activeTab === "moderation") {
        const [prods, rfqs, pendingProds] = await Promise.all([
          adminApi.listProductsForModeration().catch(() => []),
          adminApi.listRfqsForModeration().catch(() => []),
          adminApi.getAdminProducts("pending_review").catch(() => []),
        ]);
        setModerationProducts(prods);
        setModerationRfqs(rfqs);
        setPendingReviewProducts(pendingProds);
      } else if (activeTab === "doc_review") {
        const docs = await adminApi.getDocumentReviewQueue();
        setDocReviewQueue(docs);
      } else if (activeTab === "weights") {
        const w = await adminApi.getMatchingWeights();
        setMatchingWeights(w);
      } else if (activeTab === "audit") {
        const a = await adminApi.listAuditLogs();
        setAuditLogs(a);
      } else if (activeTab === "settings") {
        const s = await adminApi.getSettings();
        setSettings(s);
      } else if (activeTab === "ai_diagnostics") {
        const diag = await adminApi.getAiDiagnostics();
        setAiDiagnostics(diag);
      } else if (activeTab === "indexing") {
        const jobs = await adminApi.listIndexJobs({
          status: indexStatusFilter !== "all" ? indexStatusFilter : undefined,
          entity_type: indexEntityFilter !== "all" ? indexEntityFilter : undefined,
        });
        setIndexJobs(jobs.items || []);
        setIndexTotal(jobs.total || 0);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, indexStatusFilter, indexEntityFilter]);

  const handleToggleUserActive = async (user: AdminUser) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      setActionMessage(`Updated status for ${user.email}`);
      const updated = await adminApi.listUsers({ search: userSearch || undefined });
      setUsers(updated);
    } catch (err: any) {
      alert(`Error updating user: ${err.message}`);
    }
  };

  const handleVerificationDecision = async (companyId: string, action: "approve" | "reject" | "request_info") => {
    try {
      const note = rejectionNotes[companyId] || `Admin decision: ${action}`;
      await adminApi.decideVerification(companyId, action as any, note);
      setActionMessage(`Supplier verification ${action} completed successfully`);
      const updated = await adminApi.getVerificationQueue();
      setVerificationQueue(updated);
    } catch (err: any) {
      alert(`Error processing verification: ${err.message}`);
    }
  };

  const handleModerateProduct = async (productId: string, action: string) => {
    try {
      await adminApi.moderateProduct(productId, action);
      setActionMessage(`Product ${action} action executed`);
      const prods = await adminApi.listProductsForModeration();
      setModerationProducts(prods);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleApprovePendingProduct = async (id: string) => {
    try {
      const note = productReviewNotes[id];
      await adminApi.approveProduct(id, note);
      setActionMessage("Product approved and published successfully.");
      const updated = await adminApi.getAdminProducts("pending_review");
      setPendingReviewProducts(updated);
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleRejectPendingProduct = async (id: string) => {
    const reason = productRejectionReason[id];
    if (!reason || !reason.trim()) {
      alert("A rejection reason is required.");
      return;
    }
    try {
      const note = productReviewNotes[id];
      await adminApi.rejectProduct(id, reason.trim(), note);
      setActionMessage("Product rejected.");
      const updated = await adminApi.getAdminProducts("pending_review");
      setPendingReviewProducts(updated);
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const handleModerateRfq = async (rfqId: string, action: string) => {
    try {
      await adminApi.moderateRfq(rfqId, action);
      setActionMessage(`RFQ ${action} action executed`);
      const rfqs = await adminApi.listRfqsForModeration();
      setModerationRfqs(rfqs);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDocumentDecision = async (docId: string, action: "verify" | "reject") => {
    try {
      await adminApi.decideDocumentReview(docId, action);
      setActionMessage(`Document ${action}ed successfully`);
      const docs = await adminApi.getDocumentReviewQueue();
      setDocReviewQueue(docs);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveWeights = async () => {
    try {
      await adminApi.updateMatchingWeights(matchingWeights);
      setActionMessage("Matching weights updated successfully");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      await adminApi.retryIndexJob(jobId);
      setActionMessage(`Index job ${jobId.slice(0, 8)} marked for retry.`);
      loadData();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleTriggerReindex = async () => {
    if (!window.confirm("Trigger reindexing across all published products and vector stores?")) return;
    setIsReindexing(true);
    try {
      const res = await adminApi.triggerReindex();
      setActionMessage(`Reindex triggered: ${res.enqueued_product_jobs ?? 0} jobs enqueued.`);
      loadData();
    } catch (err: any) {
      alert(`Reindexing failed: ${err.message}`);
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 text-white rounded-lg shadow">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Admin Platform Governance & Control
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restricted to administrators. Audit logs, verification queue, security enforcement, and settings.
              </p>
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className="text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5" />
            {actionMessage}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: "overview", label: "Overview", icon: Shield },
          { id: "users", label: "Users & Roles", icon: Users },
          { id: "verification", label: "Supplier Queue", icon: CheckCircle },
          { id: "moderation", label: "Moderation", icon: AlertCircle },
          { id: "doc_review", label: "Document Review", icon: FileText },
          { id: "indexing", label: "Indexing Status & Retry", icon: RefreshCw },
          { id: "weights", label: "Matching Weights", icon: Settings },
          { id: "audit", label: "Audit Logs", icon: Lock },
          { id: "settings", label: "Platform Settings", icon: Settings },
          { id: "ai_diagnostics", label: "AI Diagnostics", icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="text-xs text-slate-400 animate-pulse">Loading administrative records...</div>
      )}

      {/* Tab: Overview */}
      {activeTab === "overview" && overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Platform Users</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {overview.total_users}
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Purchase Orders Managed</span>
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {overview.total_orders}
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Cumulative Trade Value</span>
              <Shield className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              €{overview.cumulative_trade_value_eur.toLocaleString()}
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Pending Verifications</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {overview.pending_supplier_verifications}
            </p>
          </div>
        </div>
      )}

      {/* Tab: Users & Roles */}
      {activeTab === "users" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
            >
              Search
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {u.full_name || "Unnamed"}
                      </div>
                      <div className="text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {u.created_at ? u.created_at.slice(0, 10) : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleToggleUserActive(u)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                          u.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {u.is_active ? "Disable" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Verification Queue */}
      {activeTab === "verification" && (
        <div className="space-y-4">
          {verificationQueue.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
              No pending supplier verification requests in queue.
            </div>
          ) : (
            verificationQueue.map((item) => (
              <div
                key={item.company_id}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.company_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {item.city}, {item.country} • {item.years_in_business} years in business • Contact: {item.contact_email || "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Decision reason / notes..."
                      value={rejectionNotes[item.company_id] || ""}
                      onChange={(e) =>
                        setRejectionNotes({ ...rejectionNotes, [item.company_id]: e.target.value })
                      }
                      className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => handleVerificationDecision(item.company_id, "request_info")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                    >
                      Request Info
                    </button>
                    <button
                      onClick={() => handleVerificationDecision(item.company_id, "reject")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleVerificationDecision(item.company_id, "approve")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve & Verify
                    </button>
                  </div>
                </div>

                {/* Side-by-side documents viewer */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Uploaded Compliance Documents ({item.documents.length}):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {item.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {doc.title}
                          </p>
                          <span className="text-[10px] text-slate-500 capitalize">{doc.doc_type}</span>
                        </div>
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:text-primary transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Moderation */}
      {activeTab === "moderation" && (
        <div className="space-y-6">
          {/* Pending Product Approval Queue (Prompt 15) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Supplier Product Approval Queue ({pendingReviewProducts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Products submitted by suppliers pending compliance verification before public listing
                </p>
              </div>
            </div>

            {pendingReviewProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                No products currently pending review. All submissions processed!
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReviewProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{p.supplier_name || "Supplier"}</span> • {p.origin_country || "India"} • Category: {p.category_name} • HS: {p.hs_code || "N/A"}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        MOQ: {p.moq} {p.unit} • Price: ${p.price_min?.toFixed(2)} - ${p.price_max?.toFixed(2)} / {p.unit}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Rejection Reason (required for reject)..."
                        value={productRejectionReason[p.id] || ""}
                        onChange={(e) =>
                          setProductRejectionReason({
                            ...productRejectionReason,
                            [p.id]: e.target.value,
                          })
                        }
                        className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Internal Admin Notes (never shared publicly)..."
                        value={productReviewNotes[p.id] || ""}
                        onChange={(e) =>
                          setProductReviewNotes({
                            ...productReviewNotes,
                            [p.id]: e.target.value,
                          })
                        }
                        className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleRejectPendingProduct(p.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject Submission
                      </button>
                      <button
                        onClick={() => handleApprovePendingProduct(p.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Product Catalog Moderation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Supplier</th>
                    <th className="py-2 px-3">Country</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {moderationProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{p.name}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{p.supplier_name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.origin_country}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {p.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleModerateProduct(p.id, "approve")}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleModerateProduct(p.id, "flag")}
                          className="px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-medium"
                        >
                          Flag
                        </button>
                        <button
                          onClick={() => handleModerateProduct(p.id, "suspend")}
                          className="px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium"
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">RFQ Tender Moderation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">RFQ Number</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Buyer</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {moderationRfqs.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{r.rfq_number}</td>
                      <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">{r.title}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.buyer_name}</td>
                      <td className="py-2.5 px-3 capitalize text-slate-500">{r.status}</td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleModerateRfq(r.id, "approve")}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleModerateRfq(r.id, "flag")}
                          className="px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-medium"
                        >
                          Flag
                        </button>
                        <button
                          onClick={() => handleModerateRfq(r.id, "close")}
                          className="px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Document Review Queue */}
      {activeTab === "doc_review" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Document Compliance Review Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Title & File</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Uploader</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {docReviewQueue.map((doc) => (
                  <tr key={doc.id}>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{doc.title}</div>
                      <div className="text-[11px] text-slate-400">{doc.original_filename}</div>
                    </td>
                    <td className="py-2.5 px-3 uppercase text-slate-600 dark:text-slate-400 font-mono text-[11px]">{doc.doc_type}</td>
                    <td className="py-2.5 px-3 text-slate-500">{doc.uploaded_by}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <a
                        href={`/api/v1/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 font-medium inline-block"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDocumentDecision(doc.id, "reject")}
                        className="px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleDocumentDecision(doc.id, "verify")}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium"
                      >
                        Verify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Indexing Status & Retry */}
      {activeTab === "indexing" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                AI Knowledge Base & Indexing Jobs Queue ({indexTotal})
              </h3>
              <p className="text-xs text-slate-500">
                PostgreSQL is the source of truth for price and stock. Vector search indexes only descriptive text. Jobs are processed with up to 5 retries.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                onClick={handleTriggerReindex}
                disabled={isReindexing}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? "animate-spin" : ""}`} />
                {isReindexing ? "Reindexing..." : "Reindex All Published"}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Status:</span>
              <select
                value={indexStatusFilter}
                onChange={(e) => setIndexStatusFilter(e.target.value)}
                className="text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Entity:</span>
              <select
                value={indexEntityFilter}
                onChange={(e) => setIndexEntityFilter(e.target.value)}
                className="text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Entities</option>
                <option value="product">Product</option>
                <option value="company">Company</option>
                <option value="trade_guide">Trade Guide</option>
                <option value="certificate_document">Certificate</option>
              </select>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Entity ID</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Error / Diagnostics</th>
                  <th className="py-2.5 px-3">Updated At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {indexJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No indexing jobs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  indexJobs.map((job) => {
                    const st = (job.status || "").toLowerCase();
                    const isFailed = st === "failed";
                    const isReady = st === "ready";
                    const isProcessing = st === "processing";
                    const isPending = st === "pending";

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-500">
                          {job.id ? job.id.slice(0, 8) : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold capitalize text-slate-800 dark:text-slate-200">
                          {job.entity_type}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                          {job.entity_id ? job.entity_id.slice(0, 13) + "..." : "—"}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-500">
                          {job.operation || "upsert"}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReady && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Ready
                            </span>
                          )}
                          {isProcessing && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                              Processing
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Activity className="w-3 h-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                          {job.attempts ?? 0}/5
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-rose-600 font-mono text-[11px]" title={job.error || ""}>
                          {job.error ? job.error : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {job.updated_at ? job.updated_at.slice(0, 19).replace("T", " ") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {(isFailed || isPending) && (
                            <button
                              onClick={() => handleRetryJob(job.id)}
                              disabled={retryingJobId === job.id}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50"
                            >
                              {retryingJobId === job.id ? "Retrying..." : "Retry"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Matching Weights */}
      {activeTab === "weights" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-4 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Supplier Matching Algorithm Weights</h3>
            <p className="text-xs text-slate-500">Configure multi-attribute scoring weights. Sum of weights must equal 1.00.</p>
          </div>
          <div className="space-y-3 pt-2">
            {Object.keys(matchingWeights).map((key) => (
              <div key={key} className="flex items-center justify-between gap-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">{key.replace("_", " ")}</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={matchingWeights[key]}
                  onChange={(e) =>
                    setMatchingWeights({ ...matchingWeights, [key]: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24 px-2 py-1 text-xs text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Sum: {Object.values(matchingWeights).reduce((a, b) => a + b, 0).toFixed(2)}
              </span>
              <button
                onClick={handleSaveWeights}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
              >
                Save Algorithmic Weights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                Immutable Append-Only Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                All security events, role alterations, and verification decisions logged with timestamp.
              </p>
            </div>
            <a
              href={adminApi.getAuditLogsExportUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Entity ID</th>
                  <th className="py-2.5 px-3">Actor ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {log.created_at ? log.created_at.slice(0, 19).replace("T", " ") : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-slate-600 dark:text-slate-400">
                      {log.entity_type}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {log.entity_id || "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {log.user_id ? `${log.user_id.slice(0, 8)}...` : "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Platform Settings */}
      {activeTab === "settings" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            System Configuration & Rate Limiting Controls
          </h3>
          <p className="text-xs text-slate-500">
            Platform-wide security toggles, API rate limits, and verification thresholds.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Rate Limiting Enforcement
                </p>
                <p className="text-[11px] text-slate-500">
                  5 attempts per minute per IP on authentication routes (HTTP 429 + Retry-After).
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Enforced
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  HTTP Security Headers
                </p>
                <p className="text-[11px] text-slate-500">
                  CSP, Strict HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Active
              </span>
            </div>

            {settings.map((s) => (
              <div key={s.key} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{s.key}</p>
                  <p className="text-[11px] text-slate-500">{s.description || JSON.stringify(s.value)}</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Configured
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: AI Diagnostics */}
      {activeTab === "ai_diagnostics" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                AI Service Layer Diagnostics & Provider Telemetry
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor local/cloud LLM providers, circuit breaker state, embedding dimensions, and live connection health.
              </p>
            </div>
            <button
              onClick={async () => {
                setTestingAi(true);
                try {
                  const res = await adminApi.testAiConnection();
                  setTestResult(res);
                  const diag = await adminApi.getAiDiagnostics();
                  setAiDiagnostics(diag);
                } catch (e: any) {
                  setTestResult({ status: "failed", error: e.message });
                } finally {
                  setTestingAi(false);
                }
              }}
              disabled={testingAi}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingAi ? "animate-spin" : ""}`} />
              {testingAi ? "Testing..." : "Test AI Connection"}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-lg text-xs border flex items-center justify-between ${
                testResult.status === "connected"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
              }`}
            >
              <div>
                <p className="font-bold">
                  {testResult.status === "connected" ? "✓ Connection Successful" : "⚠️ Connection Failed / Fallback Active"}
                </p>
                <p className="text-[11px] mt-0.5">
                  {testResult.message || testResult.error} ({testResult.latency_ms ? `${testResult.latency_ms} ms` : "timeout"})
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/70 dark:bg-black/30">
                {testResult.model || testResult.provider}
              </span>
            </div>
          )}

          {aiDiagnostics && (
            <div className="space-y-6">
              {/* Provider Config Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Provider</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1 capitalize">
                    {aiDiagnostics.provider}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {aiDiagnostics.is_fallback_active ? "Fallback / Demo AI" : "Live API"}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Inference Model</span>
                  <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 truncate" title={aiDiagnostics.model}>
                    {aiDiagnostics.model}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Timeout: {aiDiagnostics.timeout_seconds}s
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">pgvector Embedding</span>
                  <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 truncate">
                    {aiDiagnostics.embedding_model}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dim: {aiDiagnostics.embedding_dim} floats
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Circuit Breaker</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        aiDiagnostics.circuit_breaker?.state === "CLOSED" ? "bg-emerald-500" : "bg-red-500 animate-ping"
                      }`}
                    />
                    <p className="text-base font-bold text-slate-900 dark:text-white">
                      {aiDiagnostics.circuit_breaker?.state || "CLOSED"}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Threshold: {aiDiagnostics.circuit_breaker?.failure_threshold} failures
                  </p>
                </div>
              </div>

              {/* Telemetry Stats */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Live Circuit Breaker & Fallback Telemetry
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Total Calls</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {aiDiagnostics.circuit_breaker?.total_calls || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Successes</span>
                    <p className="text-lg font-bold text-emerald-600">
                      {aiDiagnostics.circuit_breaker?.total_successes || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Failures / Tripped</span>
                    <p className="text-lg font-bold text-red-600">
                      {aiDiagnostics.circuit_breaker?.total_failures || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Rate Limit Hits (429)</span>
                    <p className="text-lg font-bold text-amber-600">
                      {aiDiagnostics.circuit_breaker?.rate_limit_errors || 0}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
                  <span>API Key Configured: <strong>{aiDiagnostics.api_key_configured ? "Yes (Protected)" : "None (Demo AI default)"}</strong></span>
                  <span>Ollama Base URL: <strong>{aiDiagnostics.ollama_base_url || "Not applicable"}</strong></span>
                  <span>Last Error: <strong>{aiDiagnostics.circuit_breaker?.last_error || "None"}</strong></span>
                  <span>Last Latency: <strong>{aiDiagnostics.circuit_breaker?.last_latency_ms || 0} ms</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
