import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Sparkles, Printer } from "lucide-react";
import { apiClient } from "../lib/api";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const SharedQuotesPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShared = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<any>(`/shared/quotes/${token}`);
        setData(res?.data || res);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Shared quote comparison link has expired or is invalid.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchShared();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner size="lg" message="Loading shared quote comparison..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-lg">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            ✕
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Link Expired or Invalid</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
          >
            Go to TradeX AI Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                Read-Only Shared View
              </span>
              <span className="text-xs text-slate-400 font-mono">Expires in 7 days</span>
            </div>
            <h1 className="text-2xl font-black mt-2 text-slate-900 dark:text-slate-100">
              Comparative Bid Report: {data.rfq_number}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Procurement requirement: <strong>{data.product}</strong> • {data.quantity?.toLocaleString()} {data.unit} to {data.destination_country} ({data.incoterm})
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>

        {/* Quotes Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Competitive Supplier Quotations ({data.total_quotes ?? (data.quotes?.length || 0)})
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI Scored & Landed Cost Calibrated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Rank & Quote</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4 text-right">Unit Price</th>
                  <th className="p-4 text-right">Total Landed Cost</th>
                  <th className="p-4 text-right">Lead Time</th>
                  <th className="p-4 text-center">AI Match Score</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data.quotes || []).map((q: any, idx: number) => (
                  <tr key={q.quote_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{q.quote_number}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <strong className="text-slate-900 dark:text-slate-100 block">{q.supplier_name}</strong>
                      <span className="text-xs text-slate-500">{q.supplier_country}</span>
                    </td>

                    <td className="p-4 text-right font-medium">
                      {q.currency} {q.unit_price?.toFixed(2)}/kg
                    </td>

                    <td className="p-4 text-right">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {q.currency} {q.landed_cost?.toFixed(2)}/kg
                      </span>
                    </td>

                    <td className="p-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {q.lead_time_days} days
                    </td>

                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                        {q.ai_score}%
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        q.status === "accepted"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Powered by TradeX AI Global Sourcing Intelligence</span>
          <Link to="/ai-search" className="text-emerald-600 font-semibold hover:underline">
            Launch your own AI procurement inquiry →
          </Link>
        </div>
      </div>
    </div>
  );
};
export default SharedQuotesPage;
