import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  ChevronRight,
  Building2,
  Calendar,
  CreditCard,
  Truck,
} from "lucide-react";
import { ordersApi, Order } from "../lib/api/orders";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";

const STATUS_TABS = [
  { id: "all", label: "All Orders" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_production", label: "In Production" },
  { id: "quality_check", label: "Quality Check" },
  { id: "ready_to_ship", label: "Ready to Ship" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const getStatusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Confirmed" },
    in_production: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", label: "In Production" },
    quality_check: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Quality Check" },
    ready_to_ship: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "Ready to Ship" },
    shipped: { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", label: "Shipped" },
    delivered: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Delivered" },
    completed: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "Completed" },
    cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Cancelled" },
    disputed: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Disputed" },
  };
  return map[status.toLowerCase()] || { bg: "bg-slate-50 border-slate-200", text: "text-slate-700", label: status };
};

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setOrders(res.items || []);
      setTotalCount(res.total || 0);
    } catch {
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchOrders]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-indigo-600" />
              Orders & Procurement
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track confirmed orders, milestones, escrow payments, and fulfilment workflows.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/trade-finance")}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5 transition"
            >
              <CreditCard className="w-4 h-4" />
              Trade Finance Overview
            </button>
            <button
              onClick={() => navigate("/shipments")}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition"
            >
              <Truck className="w-4 h-4" />
              Track Shipments
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Order #, Incoterm, or buyer/supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Showing {orders.length} of {totalCount} orders
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

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="There are no orders matching your current filter criteria."
            actionLabel="Clear Filters"
            onAction={() => {
              setStatusFilter("all");
              setSearchQuery("");
            }}
          />
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => {
              const badge = getStatusBadge(order.status);
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-bold text-slate-900">
                        {order.order_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                      {order.incoterm && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                          {order.incoterm}
                        </span>
                      )}
                      {order.shipment_number && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 rounded flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {order.shipment_number}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Supplier: <strong>{order.supplier_name || "Supplier"}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Buyer: <strong>{order.buyer_name || "Buyer"}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <div className="text-lg font-bold text-slate-900">
                        €{order.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-500">
                        Paid: €{(order.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
