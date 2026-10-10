import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  AlertTriangle,
  TrendingUp,
  FileCheck,
  Clock,
  ShieldCheck,
  Send,
} from "lucide-react";
import { ordersApi, TradeFinanceOverview } from "../lib/api/orders";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const TradeFinancePage: React.FC = () => {
  const [data, setData] = useState<TradeFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [facilityType, setFacilityType] = useState("Letter of Credit (LC)");
  const [requestedAmount, setRequestedAmount] = useState(50000);
  const [tenorDays, setTenorDays] = useState(90);
  const [counterparty, setCounterparty] = useState("Sri Bharat Spices Pvt Ltd");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.tradeFinanceOverview();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    try {
      const res = await ordersApi.applyTradeFinance({
        facility_type: facilityType,
        requested_amount: requestedAmount,
        tenor_days: tenorDays,
        counterparty_name: counterparty,
      });
      setApplyResult(res);
      await fetchOverview();
    } catch (err: any) {
      alert(`Application failed: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const facility = data?.credit_facility;
  const balances = data?.balances;
  const utilizedPercent = facility
    ? Math.min(100, Math.round((facility.utilized_credit / facility.credit_limit) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-indigo-600" />
            Trade Finance & Escrow Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Simulated Letter of Credit (LC) issuance, automated escrow milestone locking, and supplier settlements.
          </p>
        </div>

        {/* MUST-HAVE SIMULATED BANNER */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 md:p-5 flex items-start gap-4 text-amber-950 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-tight">Trade Finance is simulated for this project</h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              All credit facility lines, Letter of Credit (LC) pre-approvals, and escrow release ledger entries
              presented on this screen are entirely simulated for test demonstrations and academic validation. No real financial obligations or banking integrations are executed.
            </p>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Credit Facility Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Demo Credit Facility
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {facility?.facility_status || "Active"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">
                €{facility?.credit_limit?.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Approved Revolving Credit Limit</div>
            </div>
            {/* Progress bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Utilized: €{facility?.utilized_credit?.toLocaleString()}</span>
                <span>{utilizedPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${utilizedPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Locked in Escrow */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Locked In Escrow
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-amber-600">
              €{balances?.escrow_locked?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
            </div>
            <p className="text-xs text-slate-500">
              Secured in smart escrow smart-contracts awaiting delivery verification before release.
            </p>
          </div>

          {/* Settled / Released */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Settled to Suppliers
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">
              €{balances?.total_settled?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
            </div>
            <p className="text-xs text-slate-500">
              Released following verified delivery and inspection milestone completions.
            </p>
          </div>
        </div>

        {/* Lower Section: Transaction Ledger + Instant Apply Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ledger Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Simulated Escrow Ledger
              </h2>
              <span className="text-xs text-slate-400">Past 30 entries</span>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Milestone Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!data?.transactions || data.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-indigo-700">
                          {tx.transaction_ref}
                        </td>
                        <td className="p-3 capitalize text-slate-700">
                          {tx.payment_type?.replace("_", " ")}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          €{tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                              tx.status === "released" || tx.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {tx.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Apply Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Simulate LC Facility
            </h2>
            <p className="text-xs text-slate-500">
              Instant demo pre-approval for Letter of Credit or Trade Credit facilities.
            </p>

            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Facility Instrument</label>
                <select
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Letter of Credit (LC)">Letter of Credit (LC - at sight)</option>
                  <option value="Usance LC (60 Days)">Usance LC (60 Days)</option>
                  <option value="Bank Guarantee">Bank Payment Guarantee (BPG)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Requested Amount (€ EUR)</label>
                <input
                  type="number"
                  min="5000"
                  step="1000"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tenor (Days)</label>
                <select
                  value={tenorDays}
                  onChange={(e) => setTenorDays(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                  <option value="120">120 Days</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Counterparty Exporter</label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={applying}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mt-2"
              >
                <Send className="w-3.5 h-3.5" />
                {applying ? "Simulating Approval..." : "Apply & Approve LC"}
              </button>
            </form>

            {applyResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1 text-xs">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Facility Pre-Approved!
                </div>
                <div className="font-mono text-[11px] text-emerald-700">
                  Ref: {applyResult.application_reference}
                </div>
                <p className="text-[11px] text-emerald-800">{applyResult.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};