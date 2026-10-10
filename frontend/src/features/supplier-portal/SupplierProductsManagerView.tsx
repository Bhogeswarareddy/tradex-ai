import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Upload,
  Download,
  Search,
  CheckSquare,
  Square,
  Edit2,
  Copy,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react";
import {
  PortalProductItem,
  supplierPortalApi,
  CsvImportResult,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

interface SupplierProductsManagerViewProps {
  onRefreshMetrics?: () => void;
}

export const SupplierProductsManagerView: React.FC<SupplierProductsManagerViewProps> = ({
  onRefreshMetrics,
}) => {
  const [products, setProducts] = useState<PortalProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PortalProductItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Product Form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Organic Spices & Herbs");
  const [formHsCode, setFormHsCode] = useState("");
  const [formOrigin, setFormOrigin] = useState("India");
  const [formLeadTime, setFormLeadTime] = useState(14);
  const [formMoq, setFormMoq] = useState(500);
  const [formUnit, setFormUnit] = useState("kg");
  const [formDesc, setFormDesc] = useState("");
  const [formStock, setFormStock] = useState(5000);
  const [formNextDate, setFormNextDate] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formPriceTiers, setFormPriceTiers] = useState<Array<{ min_qty: number; max_qty?: number; unit_price: number }>>([
    { min_qty: 500, max_qty: 2000, unit_price: 3.5 },
    { min_qty: 2001, max_qty: 10000, unit_price: 3.2 },
  ]);
  const [formSpecs, setFormSpecs] = useState<Array<{ key: string; value: string }>>([
    { key: "Curcumin Content", value: "5.2% Min" },
    { key: "Moisture", value: "9.5% Max" },
  ]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [page, statusFilter, searchQuery]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await supplierPortalApi.getProducts({
        q: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page,
        page_size: pageSize,
      });
      setProducts(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkStatus = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await supplierPortalApi.bulkUpdateStatus(selectedIds, isActive);
      setSelectedIds([]);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      alert("Bulk update failed.");
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("Organic Spices & Herbs");
    setFormHsCode("");
    setFormOrigin("India");
    setFormLeadTime(14);
    setFormMoq(500);
    setFormUnit("kg");
    setFormDesc("");
    setFormStock(5000);
    setFormNextDate("");
    setFormActive(true);
    setFormImageUrl("https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80");
    setFormPriceTiers([
      { min_qty: 500, max_qty: 2000, unit_price: 3.5 },
      { min_qty: 2001, max_qty: 10000, unit_price: 3.2 },
    ]);
    setFormSpecs([
      { key: "Curcumin Content", value: "5.2% Min" },
      { key: "Moisture", value: "9.5% Max" },
    ]);
    setModalError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (p: PortalProductItem) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category_name || "Organic Spices & Herbs");
    setFormHsCode(p.hs_code || "");
    setFormOrigin("India");
    setFormLeadTime(p.lead_time_days || 14);
    setFormMoq(p.moq || 500);
    setFormUnit(p.unit || "kg");
    setFormDesc("");
    setFormStock(p.stock_available || 0);
    setFormNextDate(p.next_available_date || "");
    setFormActive(p.is_active);
    setFormImageUrl(p.image_url || "");
    setFormPriceTiers(
      p.price_tiers && p.price_tiers.length > 0
        ? p.price_tiers.map((t) => ({ min_qty: t.min_qty, max_qty: t.max_qty, unit_price: t.unit_price }))
        : [{ min_qty: p.moq, unit_price: p.price_min }]
    );
    setFormSpecs(
      p.specifications
        ? Object.entries(p.specifications).map(([key, value]) => ({ key, value: String(value) }))
        : []
    );
    setModalError(null);
    setIsProductModalOpen(true);
  };

  const handleDuplicateProduct = (p: PortalProductItem) => {
    setEditingProduct(null);
    setFormName(`${p.name} (Copy)`);
    setFormCategory(p.category_name);
    setFormHsCode(p.hs_code || "");
    setFormOrigin("India");
    setFormLeadTime(p.lead_time_days);
    setFormMoq(p.moq);
    setFormUnit(p.unit);
    setFormDesc("");
    setFormStock(p.stock_available);
    setFormNextDate("");
    setFormActive(false); // set duplicate to draft
    setFormImageUrl(p.image_url || "");
    setFormPriceTiers(p.price_tiers);
    setFormSpecs(
      p.specifications
        ? Object.entries(p.specifications).map(([key, value]) => ({ key, value: String(value) }))
        : []
    );
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this product?")) return;
    try {
      await supplierPortalApi.deleteProduct(id);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError("Product name is required.");
      return;
    }
    setIsSavingProduct(true);
    setModalError(null);

    const specsObj: Record<string, any> = {};
    formSpecs.forEach((s) => {
      if (s.key.trim()) specsObj[s.key.trim()] = s.value;
    });

    const payload = {
      name: formName.trim(),
      category_name: formCategory,
      hs_code: formHsCode.trim() || undefined,
      origin_country: formOrigin,
      lead_time_days: Number(formLeadTime),
      moq: Number(formMoq),
      unit: formUnit,
      description: formDesc || undefined,
      stock_available: Number(formStock),
      next_available_date: formNextDate || undefined,
      is_active: formActive,
      image_url: formImageUrl || undefined,
      price_tiers: formPriceTiers.map((t) => ({
        min_qty: Number(t.min_qty),
        max_qty: t.max_qty ? Number(t.max_qty) : undefined,
        unit_price: Number(t.unit_price),
        currency: "USD",
      })),
      specifications: specsObj,
    };

    try {
      if (editingProduct) {
        await supplierPortalApi.updateProduct(editingProduct.id, payload);
      } else {
        await supplierPortalApi.createProduct(payload);
      }
      setIsProductModalOpen(false);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err: any) {
      setModalError(err.message || "Failed to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // CSV Template download
  const handleDownloadTemplate = async () => {
    try {
      const csvText = await supplierPortalApi.downloadCsvTemplate();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "tradex_products_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to download CSV template.");
    }
  };

  // CSV Import execution
  const handleExecuteCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsImporting(true);
    setCsvImportResult(null);
    try {
      const res = await supplierPortalApi.importCsv(csvFile);
      setCsvImportResult(res);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err: any) {
      alert(err.message || "CSV import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Product Catalog Management ({total})
          </h3>
          <p className="text-xs text-slate-500">
            Publish, edit pricing tiers, and manage inventory for verified international buyers
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="text-xs font-semibold">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV Template
          </Button>

          <Button variant="outline" size="sm" onClick={() => { setIsCsvModalOpen(true); setCsvImportResult(null); }} className="text-xs font-semibold">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            CSV Bulk Import
          </Button>

          <Button variant="primary" size="sm" onClick={handleOpenAddModal} className="text-xs font-bold shadow-md shadow-blue-500/20">
            <Plus className="w-4 h-4 mr-1" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Filter and Bulk Action Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name or HS code..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="draft">Draft / Inactive</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 text-xs">
            <span className="font-bold text-blue-900">
              {selectedIds.length} Selected:
            </span>
            <button
              onClick={() => handleBulkStatus(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkStatus(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-800 transition-colors"
            >
              Archive / Draft
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 w-10">
                  <button onClick={handleSelectAll} className="flex items-center">
                    {selectedIds.length === products.length && products.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3">Product</th>
                <th className="p-3">Category</th>
                <th className="p-3">HS Code</th>
                <th className="p-3">Price Range</th>
                <th className="p-3">MOQ</th>
                <th className="p-3">Stock Available</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    Loading catalog items...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isChecked ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="p-3 pl-4">
                        <button
                          onClick={() => handleToggleSelect(p.id)}
                          className="flex items-center"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              p.image_url ||
                              "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=80&q=80"
                            }
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Slug: {p.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {p.category_name}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-600">
                        {p.hs_code || "—"}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        ${p.price_min.toFixed(2)} - ${p.price_max.toFixed(2)} / {p.unit}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {p.moq} {p.unit}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">
                          {p.stock_available.toLocaleString()} {p.unit}
                        </span>
                        {p.next_available_date && (
                          <span className="block text-[10px] text-slate-400">
                            Avail: {p.next_available_date}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {p.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                            Draft / Archived
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateProduct(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-slate-100"
                            title="Duplicate as Draft"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProduct ? "Edit Product Catalog Item" : "Create New Export Product"}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure HS code, volume price tiers, specs and inventory availability
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Product Name *</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Organic Alleppey Finger Turmeric"
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <Input
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">HS Code</label>
                  <Input
                    value={formHsCode}
                    onChange={(e) => setFormHsCode(e.target.value)}
                    placeholder="e.g. 0910.30"
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Origin Country</label>
                  <Input
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Lead Time (Days)</label>
                  <Input
                    type="number"
                    value={formLeadTime}
                    onChange={(e) => setFormLeadTime(parseInt(e.target.value) || 1)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Minimum Order Qty (MOQ)</label>
                  <Input
                    type="number"
                    value={formMoq}
                    onChange={(e) => setFormMoq(parseInt(e.target.value) || 1)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Unit of Measure</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="MT">MT (Metric Tons)</option>
                    <option value="lbs">lbs (Pounds)</option>
                    <option value="units">units (Pieces)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Image URL</label>
                  <Input
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Available Stock</label>
                  <Input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Next Available Harvest/Batch Date</label>
                  <Input
                    type="date"
                    value={formNextDate}
                    onChange={(e) => setFormNextDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish to Public Storefront & Buyer Marketplace Immediately
                </label>
              </div>

              {/* Multi-Tier Pricing Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Multi-Tier Volume Pricing (USD / {formUnit})
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormPriceTiers([...formPriceTiers, { min_qty: 1000, unit_price: 3.0 }])}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    + Add Price Tier
                  </button>
                </div>

                <div className="space-y-2">
                  {formPriceTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={tier.min_qty}
                        onChange={(e) => {
                          const updated = [...formPriceTiers];
                          updated[idx].min_qty = parseInt(e.target.value) || 0;
                          setFormPriceTiers(updated);
                        }}
                        placeholder="Min Qty"
                        className="text-xs"
                      />
                      <span className="text-slate-400 text-xs">to</span>
                      <Input
                        type="number"
                        value={tier.max_qty || ""}
                        onChange={(e) => {
                          const updated = [...formPriceTiers];
                          updated[idx].max_qty = e.target.value ? parseInt(e.target.value) : undefined;
                          setFormPriceTiers(updated);
                        }}
                        placeholder="Max Qty (optional)"
                        className="text-xs"
                      />
                      <span className="text-slate-400 text-xs">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={tier.unit_price}
                        onChange={(e) => {
                          const updated = [...formPriceTiers];
                          updated[idx].unit_price = parseFloat(e.target.value) || 0;
                          setFormPriceTiers(updated);
                        }}
                        placeholder="Unit Price"
                        className="text-xs"
                      />
                      {formPriceTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormPriceTiers(formPriceTiers.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Technical Specifications (Key - Value Pairs)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormSpecs([...formSpecs, { key: "", value: "" }])}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    + Add Spec
                  </button>
                </div>

                <div className="space-y-2">
                  {formSpecs.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={s.key}
                        onChange={(e) => {
                          const updated = [...formSpecs];
                          updated[idx].key = e.target.value;
                          setFormSpecs(updated);
                        }}
                        placeholder="Spec Name (e.g. Curcumin Content)"
                        className="text-xs flex-1"
                      />
                      <Input
                        value={s.value}
                        onChange={(e) => {
                          const updated = [...formSpecs];
                          updated[idx].value = e.target.value;
                          setFormSpecs(updated);
                        }}
                        placeholder="Value (e.g. 5.2% Min)"
                        className="text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setFormSpecs(formSpecs.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSavingProduct} className="font-bold">
                  {editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal with Line-by-Line Error Reporting */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Bulk CSV Catalog Import
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload formatted spreadsheet to batch create export products
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCsvImport} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 hover:border-blue-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    id="csvFileInput"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="csvFileInput"
                    className="text-xs font-bold text-blue-600 cursor-pointer hover:underline"
                  >
                    {csvFile ? csvFile.name : "Select a .csv file from your computer"}
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Comma-separated values with header matching template
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download sample template (.csv)
                </button>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={!csvFile}
                  isLoading={isImporting}
                  className="font-bold text-xs"
                >
                  Run Import
                </Button>
              </div>
            </form>

            {/* Line-by-Line Error & Result Reporting */}
            {csvImportResult && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Processed {csvImportResult.total_rows} rows:
                  </span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {csvImportResult.successful_rows} successfully imported
                  </span>
                </div>

                {csvImportResult.errors && csvImportResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {csvImportResult.errors.length} validation errors encountered:
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-xl bg-rose-50/50 p-2 text-[11px] divide-y divide-rose-100">
                      {csvImportResult.errors.map((err, idx) => (
                        <div key={idx} className="py-1.5 px-2">
                          <span className="font-bold text-rose-800">Row {err.row}: </span>
                          <span className="text-rose-700">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
