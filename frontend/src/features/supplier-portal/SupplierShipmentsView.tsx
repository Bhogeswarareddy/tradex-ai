import React, { useState, useEffect } from "react";
import {
  Truck,
  AlertCircle,
  Navigation,
} from "lucide-react";
import {
  supplierPortalApi,
  SupplierShipmentResponse,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";

export const SupplierShipmentsView: React.FC = () => {
  const [shipments, setShipments] = useState<SupplierShipmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supplierPortalApi.getShipments();
      setShipments(data);
    } catch (err: any) {
      setError(err.message || "Failed to load supplier shipments.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_transit":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">In Transit</span>;
      case "customs_hold":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Customs Clearance</span>;
      case "delivered":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Delivered</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200">{status}</span>;
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
        <Button variant="primary" size="sm" onClick={loadShipments}>
          Retry Loading Shipments
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          Active Container Shipments & Logistics ({shipments.length})
        </h3>
        <p className="text-xs text-slate-500">
          Global ocean freight, vessel tracking, and port dispatch milestones
        </p>
      </div>

      {shipments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
          <Truck className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">No Active Shipments</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are no containers currently in transit for your orders.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-5">Shipment #</th>
                  <th className="p-3">Carrier / Tracking</th>
                  <th className="p-3">Origin Port</th>
                  <th className="p-3">Destination Port</th>
                  <th className="p-3">Current Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right pr-5">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 pl-5 font-mono font-bold text-blue-600">{s.shipment_number}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 block">{s.carrier}</span>
                      <span className="font-mono text-slate-400 text-[11px]">{s.tracking_number}</span>
                    </td>
                    <td className="p-3 text-slate-700">{s.origin}</td>
                    <td className="p-3 text-slate-700">{s.destination}</td>
                    <td className="p-3 text-slate-800 flex items-center gap-1.5 font-medium">
                      <Navigation className="w-3.5 h-3.5 text-blue-500" />
                      {s.current_location}
                    </td>
                    <td className="p-3">{getStatusBadge(s.status)}</td>
                    <td className="p-3 text-right pr-5 font-semibold text-slate-800">
                      {s.eta ? new Date(s.eta).toLocaleDateString() : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
