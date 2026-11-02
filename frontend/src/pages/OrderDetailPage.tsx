import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  Download,
  FileCheck,
} from "lucide-react";
import { ordersApi, OrderDetail } from "../lib/api/orders";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ActivityTimeline } from "../components/common/ActivityTimeline";
import { apiClient } from "../lib/api";

const STEP_FLOW = [
  "confirmed",
  "in_production",
  "quality_check",
  "ready_to_ship",
  "shipped",
  "delivered",
  "completed",
];

const STEP_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  in_production: "In Production",
  quality_check: "Quality Check",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
};

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal State
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState("advance");
  const [customAmount, setCustomAmount] = useState<number | "">("");

  // Document Generation State
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);

  const handleGenerateDoc = async (docType: string) => {
    if (!id) return;
    setGeneratingDoc(true);
    setDocSuccess(null);
    try {
      const res = await apiClient.post<any>(`/orders/${id}/documents/generate?doc_type=${docType}`);
      const docNum = res?.document_number || res?.data?.document_number || "Doc";
      const docTitle = res?.title || res?.data?.title || docType;
      setDocSuccess(`Generated: ${docNum} (${docTitle})`);
      fetchOrder();
    } catch (err) {
      console.error("Document generation failed:", err);
    } finally {
      setGeneratingDoc(false);
    }
  };

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await ordersApi.get(id);
      setOrder(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleTransition = async () => {
    if (!id || !targetStatus) return;
    setActionLoading(true);
    try {
      await ordersApi.transition(id, {
        status: targetStatus,
        notes: transitionNotes || undefined,
      });
      setShowTransitionModal(false);
      setTransitionNotes("");
      await fetchOrder();
    } catch (err: any) {
      alert(`Transition failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await ordersApi.simulatePayment(id, {
        payment_type: paymentType,
        amount: typeof customAmount === "number" ? customAmount : undefined,
      });
      setShowPaymentModal(false);
      setCustomAmount("");
      await fetchOrder();
    } catch (err: any) {
      alert(`Simulated payment failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-red-200 p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Order Not Found</h2>
          <p className="text-sm text-slate-600">{error || "Unable to display this order"}</p>
          <button
            onClick={() => navigate("/orders")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEP_FLOW.indexOf(order.status.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/orders")}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Orders
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900">{order.order_number}</h1>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                {order.status}
              </span>
              {order.incoterm && (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                  {order.incoterm}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const nextOptions: Record<string, string[]> = {
                  confirmed: ["in_production", "cancelled"],
                  in_production: ["quality_check", "cancelled"],
                  quality_check: ["ready_to_ship", "cancelled"],
                  ready_to_ship: ["shipped", "cancelled"],
                  shipped: ["delivered", "disputed"],
                  delivered: ["completed", "disputed"],
                  disputed: ["completed", "cancelled"],
                };
                const available = nextOptions[order.status.toLowerCase()] || [];
                setTargetStatus(available[0] || "");
                setShowTransitionModal(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
            >
              Update Status
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              Simulate Escrow Payment
            </button>
          </div>
        </div>

        {/* Simulated Ribbon */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-900 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <strong>Simulated Environment:</strong> All payments, escrow lockups, and milestone releases on this order are simulated for live demonstration.
          </div>
        </div>

        {/* 7-Step Progress Stepper */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Order Lifecycle Progress
          </h2>
          <div className="flex items-center justify-between min-w-[700px]">
            {STEP_FLOW.map((step, idx) => {
              const isPast = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              return (
                <div key={step} className="flex-1 flex items-center relative">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                        isPast
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium text-center ${
                        isCurrent
                          ? "text-indigo-600 font-bold"
                          : isPast
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                  {idx < STEP_FLOW.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 absolute top-4.5 left-1/2 w-full -z-0 ${
                        idx < currentStepIdx ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Line items table */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Line Items
              </h2>
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Product Description</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-900">{it.name}</td>
                        <td className="p-3 text-right text-slate-600">
                          {it.quantity?.toLocaleString()} {it.unit}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          €{it.unit_price?.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          €{it.total_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Simulated Payments Record */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Payments & Escrow Transactions
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Simulated Ledger
                </span>
              </div>

              {order.payments.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  No payment events recorded for this order yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {order.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700">{p.transaction_ref}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium capitalize">
                            {p.payment_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold capitalize ${
                              p.status === "released" || p.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {p.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-slate-500">{p.notes}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-bold text-slate-900">
                          €{p.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trade Documents Generator & Linked Documents (Prompt 42) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    Trade Documents & Compliance
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate legally structured, numbered export documents from real order data.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={generatingDoc}
                    onClick={() => handleGenerateDoc("proforma_invoice")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    + Proforma Invoice
                  </button>
                  <button
                    disabled={generatingDoc}
                    onClick={() => handleGenerateDoc("purchase_order")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    + Purchase Order
                  </button>
                  <button
                    disabled={generatingDoc}
                    onClick={() => handleGenerateDoc("packing_list")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    + Packing List
                  </button>
                </div>
              </div>

              {docSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
                  <span>{docSuccess}</span>
                  <button onClick={() => setDocSuccess(null)} className="text-emerald-600 font-bold">×</button>
                </div>
              )}

              {/* Document items list */}
              {(!order.documents || order.documents.length === 0) ? (
                <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                  No documents generated yet. Click above to generate Proforma Invoice, PO, or Packing List.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {order.documents.map((doc: any, dIdx: number) => (
                    <div key={doc.id || dIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-800 block truncate">{doc.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">{doc.doc_type?.replace("_", " ")}</span>
                      </div>
                      <a
                        href={`/api/v1/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 shrink-0"
                        title="Download / View Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Activity Timeline (Prompt 42) */}
            <ActivityTimeline entityType="order" entityId={order.id} />

            {/* Linked Shipment */}
            {order.shipment && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-600" />
                    Linked Freight Shipment
                  </h2>
                  <button
                    onClick={() => navigate(`/shipments/${order.shipment?.id}`)}
                    className="text-xs font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1"
                  >
                    View Tracking Map <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-4 bg-cyan-50/50 rounded-lg border border-cyan-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Shipment #</span>
                    <strong className="text-slate-900">{order.shipment.shipment_number}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Carrier</span>
                    <strong className="text-slate-900">{order.shipment.carrier}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Origin Port</span>
                    <strong className="text-slate-900">{order.shipment.origin}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Destination</span>
                    <strong className="text-slate-900">{order.shipment.destination}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Commercial Summary</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Contract Value:</span>
                  <span className="font-bold text-slate-900">
                    €{order.payment_summary?.total_due?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Locked in Escrow:</span>
                  <span className="font-semibold text-amber-600">
                    €{order.payment_summary?.escrow_locked?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Settled:</span>
                  <span className="font-semibold text-emerald-600">
                    €{order.payment_summary?.total_paid?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 pt-2">
                  <span className="font-bold text-slate-700">Balance Pending:</span>
                  <span className="font-bold text-slate-900">
                    €{order.payment_summary?.balance_due?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Parties */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Counterparties</h3>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Supplier</span>
                  <strong className="text-slate-900 text-sm block">{order.supplier?.name}</strong>
                  <span className="text-slate-500">{order.supplier?.city}, {order.supplier?.country}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Buyer</span>
                  <strong className="text-slate-900 text-sm block">{order.buyer?.name}</strong>
                  <span className="text-slate-500">{order.buyer?.city}, {order.buyer?.country}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address & Terms */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Delivery & Terms</h3>
              <div>
                <span className="text-slate-400 block">Payment Terms:</span>
                <span className="text-slate-700 font-medium">{order.payment_terms || "LC at sight"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Delivery Address:</span>
                <span className="text-slate-700 font-medium">{order.shipping_address || "Port of Destination"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Advance Order Status</h3>
            <p className="text-xs text-slate-500">
              Select the next validated status for this procurement lifecycle.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Target Status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="in_production">In Production</option>
                <option value="quality_check">Quality Check</option>
                <option value="ready_to_ship">Ready to Ship</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Notes / Audit Remarks</label>
              <textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Optional notes regarding this status change..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleTransition}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Confirm Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Simulate Escrow Payment</h3>
            <p className="text-xs text-slate-500">
              Trigger a simulated financial transfer to test escrow lockup and release flows.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Payment Milestone</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="advance">30% Advance Escrow Payment</option>
                <option value="balance">70% Commercial Balance</option>
                <option value="escrow_release">Release Escrow to Supplier</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulatePayment}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Process Simulated Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};