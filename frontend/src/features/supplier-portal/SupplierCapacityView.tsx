import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  CheckCircle2,
  Save,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  X,
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk CSV modal state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<{ updated_count: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCapacity();
  }, []);

  const loadCapacity = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await supplierPortalApi.getCapacity();
      setItems(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load capacity");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (productId: string, field: keyof CapacityInventoryItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, [field]: val } : item))
    );
  };

  const handleInlineSave = async (item: CapacityInventoryItem) => {
    setSavingId(item.product_id);
    try {
      await supplierPortalApi.updateCapacity(item.product_id, {
        available_quantity: item.available_quantity,
        reserved_quantity: item.reserved_quantity,
        availability_status: item.availability_status,
        monthly_capacity: item.monthly_capacity,
        next_available_date: item.next_available_date,
        lead_time_days: item.lead_time_days,
      });
      // Mark as fresh locally
      setItems((prev) =>
        prev.map((p) =>
          p.product_id === item.product_id
            ? { ...p, is_stale: false, confirmed_at: new Date().toISOString() }
            : p
        )
      );
      setSuccessMsg(`Capacity & inventory for "${item.product_name}" saved and confirmed!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update capacity item");
    } finally {
      setSavingId(null);
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsUploadingCsv(true);
    setCsvResult(null);
    try {
      const res = await supplierPortalApi.bulkUpdateCapacityCsv(csvFile);
      setCsvResult(res);
      loadCapacity();
    } catch (err: any) {
      alert(err.message || "Failed to upload CSV");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      "product_id,product_name,available_quantity,reserved_quantity,availability_status,monthly_capacity\n" +
      items
        .map(
          (p) =>
            `"${p.product_id}","${p.product_name.replace(/"/g, '""')}",${p.available_quantity || 1000},${p.reserved_quantity || 0},${p.availability_status || "in_stock"},"${p.monthly_capacity || "2000 kg/month"}"`
        )
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tradex_capacity_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Capacity & Real-Time Inventory Table ({items.length} Products)
          </h3>
          <p className="text-xs text-slate-500">
            Inline editable stock counters, reserved volumes, availability status, and monthly production rates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSampleCsv}
            className="text-xs font-semibold text-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Download CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setIsCsvModalOpen(true);
              setCsvResult(null);
            }}
            className="text-xs font-bold shadow-md shadow-blue-500/20"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Bulk Update by CSV
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Inventory & Capacity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 pl-5 min-w-[200px]">Product</th>
                <th className="p-3 w-32">Available Qty</th>
                <th className="p-3 w-28">Reserved Qty</th>
                <th className="p-3 w-36">Availability Status</th>
                <th className="p-3 w-40">Monthly Capacity</th>
                <th className="p-3 w-36">Next Available Date</th>
                <th className="p-3 w-32">Freshness</th>
                <th className="p-3 text-right pr-5">Inline Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.product_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 pl-5">
                    <span className="font-bold text-slate-900 block">{item.product_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">MOQ: {item.moq} {item.unit}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={item.available_quantity ?? 0}
                        onChange={(e) =>
                          handleFieldChange(item.product_id, "available_quantity", parseInt(e.target.value) || 0)
                        }
                        className="text-xs font-bold w-20 py-1 px-2 text-right"
                      />
                      <span className="text-[11px] text-slate-400">{item.unit}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={item.reserved_quantity ?? 0}
                        onChange={(e) =>
                          handleFieldChange(item.product_id, "reserved_quantity", parseInt(e.target.value) || 0)
                        }
                        className="text-xs font-semibold w-16 py-1 px-2 text-right"
                      />
                      <span className="text-[11px] text-slate-400">{item.unit}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      value={item.availability_status || "in_stock"}
                      onChange={(e) =>
                        handleFieldChange(item.product_id, "availability_status", e.target.value)
                      }
                      className="text-xs font-bold py-1.5 px-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="in_stock">In Stock</option>
                      <option value="limited">Limited Stock</option>
                      <option value="made_to_order">Made to Order</option>
                      <option value="out_of_stock">Out of Stock</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <Input
                      value={item.monthly_capacity || ""}
                      onChange={(e) =>
                        handleFieldChange(item.product_id, "monthly_capacity", e.target.value)
                      }
                      placeholder="e.g. 500 MT/month"
                      className="text-xs font-semibold py-1 px-2"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="date"
                      value={item.next_available_date || ""}
                      onChange={(e) =>
                        handleFieldChange(item.product_id, "next_available_date", e.target.value)
                      }
                      className="text-xs py-1 px-2"
                    />
                  </td>
                  <td className="p-3">
                    {item.is_stale ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Stale (&gt;30d)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Confirmed
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right pr-5">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={savingId === item.product_id}
                      onClick={() => handleInlineSave(item)}
                      className="text-xs font-bold py-1 px-3"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {savingId === item.product_id ? "Saving..." : "Save"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Bulk Update Inventory by CSV</h3>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload a UTF-8 CSV containing columns <code>product_id</code>, <code>available_quantity</code>, <code>reserved_quantity</code>, <code>availability_status</code>, <code>monthly_capacity</code>.
            </p>

            <form onSubmit={handleUploadCsv} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2 bg-slate-50"
              >
                <FileSpreadsheet className="w-8 h-8 text-blue-500 mx-auto" />
                <span className="text-xs font-bold text-slate-700 block">
                  {csvFile ? csvFile.name : "Click to select CSV file"}
                </span>
                <span className="text-[10px] text-slate-400 block">Maximum file size 10MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {csvResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 space-y-1">
                  <div>Updated {csvResult.updated_count} product capacity rows successfully!</div>
                  {csvResult.errors && csvResult.errors.length > 0 && (
                    <div className="text-rose-700 text-[11px] pt-1 border-t border-emerald-200">
                      Errors in {csvResult.errors.length} rows.
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCsvModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!csvFile || isUploadingCsv}
                  className="text-xs font-bold"
                >
                  {isUploadingCsv ? "Processing CSV..." : "Apply Bulk Update"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
