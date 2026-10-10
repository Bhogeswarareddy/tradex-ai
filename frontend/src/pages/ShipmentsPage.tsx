import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Search,
  ChevronRight,
  Anchor,
  Compass,
  Calendar,
  Building2,
  Plane,
} from "lucide-react";
import { shipmentsApi, Shipment } from "../lib/api/shipments";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";

const STATUS_TABS = [
  { id: "all", label: "All Shipments" },
  { id: "in_transit", label: "In Transit" },
  { id: "arrived", label: "Arrived at Port" },
  { id: "customs_cleared", label: "Customs Cleared" },
  { id: "delivered", label: "Delivered" },
];

export const ShipmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shipmentsApi.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setShipments(res.items || []);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchShipments();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchShipments]);

  const getModeIcon = (mode?: string) => {
    if (mode === "air") return <Plane className="w-4 h-4 text-sky-600" />;
    if (mode === "road") return <Truck className="w-4 h-4 text-emerald-600" />;
    return <Anchor className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-indigo-600" />
              Shipments & Freight Logistics
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Live container vessel tracking, maritime corridor telemetry, and Bill of Lading verification.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by shipment #, container number, or port..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
              {shipments.length} active consignments tracked
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shipments List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : shipments.length === 0 ? (
          <EmptyState
            title="No shipments found"
            description="No active consignments match your selected search or filter options."
            actionLabel="Reset Filters"
            onAction={() => {
              setStatusFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <div className="grid gap-4">
            {shipments.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/shipments/${s.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {getModeIcon(s.mode)}
                      {s.shipment_number}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 capitalize">
                      {s.status?.replace("_", " ")}
                    </span>
                    {s.vessel_or_flight && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                        🚢 {s.vessel_or_flight}
                      </span>
                    )}
                    {s.container_number && (
                      <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        Box: {s.container_number}
                      </span>
                    )}
                  </div>

                  {/* Route corridor */}
                  <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                    <span>{s.origin}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold text-indigo-700">{s.destination}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Current Position: <strong className="text-slate-800">{s.current_location || "Maritime Transit"}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>ETA: {s.eta || s.estimated_delivery || "In Transit"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Carrier: {s.carrier || "Ocean Freight"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  <span className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                    Live Telemetry Map
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};