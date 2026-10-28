import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Award,
  Clock,
  Users,
  Globe,
  AlertCircle,
  Package,
} from "lucide-react";
import { supplierPortalApi } from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";

export const SupplierAnalyticsView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supplierPortalApi.getAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load supplier analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-800">{error || "Failed to load analytics"}</p>
        <Button variant="primary" size="sm" onClick={loadAnalytics}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Export Operations & Performance Analytics
        </h3>
        <p className="text-xs text-slate-500">
          Real-time trade fulfillment KPIs, buyer trust metrics, and global distribution
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Time Delivery</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.on_time_delivery_rate}%</div>
            <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Verified Tier-1 Exporter
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Response Time</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.response_time_hours} hrs</div>
            <div className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Fast Inbound Support
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Repeat Buyer Rate</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.repeat_buyer_rate}%</div>
            <div className="text-xs font-bold text-purple-600 mt-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              High Retention Rate
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dispatched Quotes</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.quotes_count}</div>
            <div className="text-xs font-bold text-amber-600 mt-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              Active Pipeline
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid: Top Export Products & Regional Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Top Products by Ready Volume */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            Top Export Products by Available Capacity
          </h4>
          <div className="divide-y divide-slate-100">
            {data.top_products?.map((p: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">{p.name}</span>
                  <span className="text-slate-400 text-[11px]">Status: {p.status}</span>
                </div>
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  {p.volume}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Regional Buyer Export Share */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            Export Destinations Share
          </h4>
          <div className="space-y-3 pt-2">
            {data.sales_by_destination?.map((d: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{d.country}</span>
                  <span className="font-mono text-slate-900">{d.share}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: `${d.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
