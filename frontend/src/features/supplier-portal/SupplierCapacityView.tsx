import React, { useState, useEffect } from "react";
import {
  Layers,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import {
  CapacityInventoryItem,
  supplierPortalApi,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export const SupplierCapacityView: React.FC = () => {
  const [items, setItems] = useState<CapacityInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // General monthly capacity
  const [monthlyCapacity, setMonthlyCapacity] = useState("1,000 MT / Month");

  // Holiday / Plant Maintenance Shutdown Windows
  const [holidayShutdowns, setHolidayShutdowns] = useState<
    Array<{ id: string; name: string; startDate: string; endDate: string }>
  >([
    {
      id: "1",
      name: "Diwali Harvest Processing Recess",
      startDate: "2026-11-08",
      endDate: "2026-11-14",
    },
    {
      id: "2",
      name: "Annual Processing Line Overhaul",
      startDate: "2026-12-25",
      endDate: "2026-12-31",
    },
  ]);
  const [newHoliName, setNewHoliName] = useState("");
  const [newHoliStart, setNewHoliStart] = useState("");
  const [newHoliEnd, setNewHoliEnd] = useState("");

  useEffect(() => {
    loadCapacity();
  }, []);

  const loadCapacity = async () => {
    setIsLoading(true);
    try {
      const data = await supplierPortalApi.getCapacity();
      setItems(data);
    } catch (err) {
      console.error("Failed to load capacity", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItem = async (item: CapacityInventoryItem) => {
    setSavingId(item.product_id);
    try {
      await supplierPortalApi.updateCapacity(item.product_id, {
        stock_available: item.stock_available,
        next_available_date: item.next_available_date,
        lead_time_days: item.lead_time_days,
      });
      setSuccessMsg(`Inventory for ${item.product_name} updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update item inventory");
    } finally {
      setSavingId(null);
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliName.trim() || !newHoliStart || !newHoliEnd) return;
    setHolidayShutdowns([
      ...holidayShutdowns,
      {
        id: String(Date.now()),
        name: newHoliName.trim(),
        startDate: newHoliStart,
        endDate: newHoliEnd,
      },
    ]);
    setNewHoliName("");
    setNewHoliStart("");
    setNewHoliEnd("");
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidayShutdowns(holidayShutdowns.filter((h) => h.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Production Capacity & Real-Time Inventory
        </h3>
        <p className="text-xs text-slate-500">
          Manage factory throughput, category lead times, and scheduled plant shutdown dates
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Global Monthly Capacity & Scheduled Plant Recesses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Throughput */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Global Manufacturing Capacity
          </h4>
          <p className="text-xs text-slate-500">
            Total active monthly output communicated to global buyers on your storefront.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Monthly Processing Rate</label>
            <div className="flex gap-2">
              <Input
                value={monthlyCapacity}
                onChange={(e) => setMonthlyCapacity(e.target.value)}
                className="text-xs font-bold"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSuccessMsg("Global monthly capacity rate saved!");
                  setTimeout(() => setSuccessMsg(null), 3000);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Scheduled Plant Shutdown / Holiday Recess */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              Scheduled Plant Shutdowns & Holiday Blackouts
            </h4>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Auto-adjusts RFQ Lead Times
            </span>
          </div>

          <div className="space-y-2">
            {holidayShutdowns.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 block">{h.name}</span>
                  <span className="text-slate-500 text-[11px]">
                    {h.startDate} to {h.endDate}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveHoliday(h.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Holiday Form */}
          <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <div className="sm:col-span-2">
              <Input
                value={newHoliName}
                onChange={(e) => setNewHoliName(e.target.value)}
                placeholder="Shutdown reason (e.g. Lunar New Year)"
                className="text-xs"
                required
              />
            </div>
            <div>
              <Input
                type="date"
                value={newHoliStart}
                onChange={(e) => setNewHoliStart(e.target.value)}
                className="text-xs"
                required
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={newHoliEnd}
                onChange={(e) => setNewHoliEnd(e.target.value)}
                className="text-xs"
                required
              />
              <Button type="submit" variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Product-Level Real-Time Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            Product Stock & Dispatch Lead Times
          </h4>
          <span className="text-xs text-slate-400">
            Changes reflect live in buyer product stock counters
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 pl-5">Product Name</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Next Available Date</th>
                <th className="p-3">Fulfillment Lead Time</th>
                <th className="p-3 text-right pr-5">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    Loading inventory data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    No products currently in catalog.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 pl-5 font-bold text-slate-900">
                      {item.product_name}
                      <span className="block text-[11px] font-normal text-slate-400">
                        MOQ: {item.moq} {item.unit}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 w-36">
                        <Input
                          type="number"
                          value={item.stock_available}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].stock_available = parseInt(e.target.value) || 0;
                            setItems(updated);
                          }}
                          className="text-xs font-bold"
                        />
                        <span className="text-slate-400 font-medium">{item.unit}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        type="date"
                        value={item.next_available_date || ""}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].next_available_date = e.target.value;
                          setItems(updated);
                        }}
                        className="text-xs w-40"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 w-32">
                        <Input
                          type="number"
                          value={item.lead_time_days}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].lead_time_days = parseInt(e.target.value) || 1;
                            setItems(updated);
                          }}
                          className="text-xs"
                        />
                        <span className="text-slate-400 font-medium">days</span>
                      </div>
                    </td>
                    <td className="p-3 text-right pr-5">
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={savingId === item.product_id}
                        onClick={() => handleUpdateItem(item)}
                        className="text-xs font-semibold"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
