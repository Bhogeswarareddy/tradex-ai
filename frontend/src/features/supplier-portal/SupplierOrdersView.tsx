import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Globe,
  AlertCircle,
  X,
} from "lucide-react";
import {
  supplierPortalApi,
  SupplierOrderResponse,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { useCurrency } from "../settings/SettingsContext";

export const SupplierOrdersView: React.FC = () => {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<SupplierOrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrderResponse | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supplierPortalApi.getOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "Failed to load supplier orders.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      await supplierPortalApi.updateOrderStatus(orderId, nextStatus);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err: any) {
      alert(err.message || "Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Confirmed</span>;
      case "processing":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Processing</span>;
      case "ready_for_shipment":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Ready for Shipment</span>;
      case "shipped":
      case "in_transit":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Shipped</span>;
      case "completed":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Completed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <Button variant="primary" size="sm" onClick={loadOrders}>
          Retry Loading Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          Supplier Export Orders ({orders.length})
        </h3>
        <p className="text-xs text-slate-500">
          Orders scoped exclusively to your company products and fulfillment workflows
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">No Orders Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You do not have any active export purchase orders at this time.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-5">Order #</th>
                  <th className="p-3">Buyer Company</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Total Value</th>
                  <th className="p-3">Incoterm</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 pl-5 font-mono font-bold text-blue-600">{o.order_number}</td>
                    <td className="p-3 font-semibold text-slate-800">{o.buyer_company}</td>
                    <td className="p-3 text-slate-600 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      {o.buyer_country}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {(() => {
                        const pr = formatPrice(o.total_amount, o.currency || "USD");
                        return (
                          <span title={pr.approx ? `Original: $${o.total_amount?.toLocaleString()} ${o.currency || "USD"}` : undefined}>
                            {pr.formatted}
                            {pr.approx && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                Orig: ${o.total_amount?.toLocaleString()} {o.currency || "USD"}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{o.incoterm}</td>
                    <td className="p-3">{getStatusBadge(o.status)}</td>
                    <td className="p-3 text-slate-400">{o.created_at}</td>
                    <td className="p-3 text-right pr-5">
                      <div className="flex items-center justify-end gap-2">
                        {o.status === "confirmed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === o.id}
                            onClick={() => handleUpdateStatus(o.id, "processing")}
                            className="text-xs font-bold text-blue-600"
                          >
                            Mark Processing
                          </Button>
                        )}
                        {o.status === "processing" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === o.id}
                            onClick={() => handleUpdateStatus(o.id, "ready_for_shipment")}
                            className="text-xs font-bold text-purple-600"
                          >
                            Ready to Ship
                          </Button>
                        )}
                        {o.status === "ready_for_shipment" && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={updatingId === o.id}
                            onClick={() => handleUpdateStatus(o.id, "shipped")}
                            className="text-xs font-bold"
                          >
                            Mark Shipped
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(o)}
                          className="text-xs"
                        >
                          View Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Order {selectedOrder.order_number}</h3>
                <p className="text-xs text-slate-500">Buyer: {selectedOrder.buyer_company} ({selectedOrder.buyer_country})</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                <span className="font-black text-slate-900 text-sm">
                  {formatPrice(selectedOrder.total_amount, selectedOrder.currency || "USD").formatted}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Status</span>
                <div className="mt-0.5">{getStatusBadge(selectedOrder.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Incoterm</span>
                <span className="font-semibold text-slate-800">{selectedOrder.incoterm}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Shipping Address</span>
                <span className="font-medium text-slate-700">{selectedOrder.shipping_address || "Port of Destination Container Depot"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Line Items ({selectedOrder.items?.length || 0})</h4>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">{item.product_name}</span>
                      <span className="text-slate-500 text-[11px]">{item.quantity} {item.unit} @ ${item.unit_price}/{item.unit}</span>
                    </div>
                    <span className="font-bold text-slate-900">${item.total_price?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
