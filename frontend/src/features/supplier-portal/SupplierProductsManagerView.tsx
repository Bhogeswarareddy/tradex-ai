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
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Send,
  EyeOff,
  Archive,
  Clock,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  FileText,
  Sparkles,
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

const COMMON_SPEC_PRESETS = [
  { key: "Curcumin Content", value: "5.2% Min" },
  { key: "Moisture", value: "9.5% Max" },
  { key: "Mesh Size", value: "80 Mesh" },
  { key: "Total Ash", value: "6.0% Max" },
  { key: "Purity", value: "99.5% Min" },
  { key: "Grade", value: "Premium Food Grade" },
  { key: "Crop Year", value: "2026" },
];

const INCOTERMS_OPTIONS = ["FOB", "CIF", "CFR", "EXW", "FCA", "DDP", "CIP"];
const PAYMENT_TERMS_OPTIONS = [
  "LC at sight",
  "30% Advance, 70% against BL",
  "TT Net 30",
  "TT Net 60",
  "TradeX Secure Escrow",
];
const AVAILABILITY_STATUS_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "limited", label: "Limited Stock" },
  { value: "made_to_order", label: "Made to Order" },
  { value: "out_of_stock", label: "Out of Stock" },
];

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
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal & Step state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PortalProductItem | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // CSV Modal state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Step 1: Basics
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Organic Spices & Herbs");
  const [formProductForm, setFormProductForm] = useState("Powder");
  const [formHsCode, setFormHsCode] = useState("");
  const [formOrigin, setFormOrigin] = useState("India");
  const [formRegion, setFormRegion] = useState("Alleppey, Kerala");
  const [formDesc, setFormDesc] = useState("");

  // Step 2: Specifications
  const [formSpecs, setFormSpecs] = useState<Array<{ key: string; value: string }>>([
    { key: "Curcumin Content", value: "5.2% Min" },
    { key: "Moisture", value: "9.5% Max" },
  ]);

  // Step 3: Pricing and MOQ
  const [formMoq, setFormMoq] = useState(500);
  const [formUnit, setFormUnit] = useState("kg");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formPriceValidFrom, setFormPriceValidFrom] = useState("");
  const [formPriceValidUntil, setFormPriceValidUntil] = useState("");
  const [formPriceTiers, setFormPriceTiers] = useState<
    Array<{ min_qty: number; max_qty?: number; unit_price: number }>
  >([
    { min_qty: 500, max_qty: 2000, unit_price: 3.5 },
    { min_qty: 2001, max_qty: 10000, unit_price: 3.2 },
  ]);

  // Step 4: Inventory & Capacity
  const [formStock, setFormStock] = useState(5000);
  const [formReservedStock, setFormReservedStock] = useState(0);
  const [formAvailabilityStatus, setFormAvailabilityStatus] = useState("in_stock");
  const [formMonthlyCapacity, setFormMonthlyCapacity] = useState("100 MT/month");
  const [formLeadTime, setFormLeadTime] = useState(14);
  const [formNextDate, setFormNextDate] = useState("");

  // Step 5: Logistics & Commercial Terms
  const [formPackaging, setFormPackaging] = useState(
    "25 kg vacuum bags inside multiwall kraft paper sacks"
  );
  const [formStorage, setFormStorage] = useState(
    "Store in ambient, cool, dry conditions away from sunlight"
  );
  const [formExportDetails, setFormExportDetails] = useState(
    "FOB Port of Nhava Sheva (INNSA) / Chennai Port"
  );
  const [formDestinations, setFormDestinations] = useState<string>("Germany, USA, Netherlands, UAE, Japan");
  const [formIncoterms, setFormIncoterms] = useState<string[]>(["FOB", "CIF"]);
  const [formPaymentTerms, setFormPaymentTerms] = useState<string[]>([
    "LC at sight",
    "30% Advance, 70% against BL",
  ]);

  // Step 6: Documents & Certificates
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formSupportingDocs, setFormSupportingDocs] = useState<
    Array<{ name: string; url: string; doc_type: string }>
  >([]);
  const [formCertifications, setFormCertifications] = useState<
    Array<{
      certification_name: string;
      certificate_no: string;
      issuer: string;
      issued_at: string;
      expires_at: string;
    }>
  >([]);

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

  const resetForm = () => {
    setEditingProduct(null);
    setCurrentStep(1);
    setFormName("");
    setFormCategory("Organic Spices & Herbs");
    setFormProductForm("Powder");
    setFormHsCode("");
    setFormOrigin("India");
    setFormRegion("Alleppey, Kerala");
    setFormDesc("");
    setFormSpecs([
      { key: "Curcumin Content", value: "5.2% Min" },
      { key: "Moisture", value: "9.5% Max" },
    ]);
    setFormMoq(500);
    setFormUnit("kg");
    setFormCurrency("USD");
    setFormPriceValidFrom("");
    setFormPriceValidUntil("");
    setFormPriceTiers([
      { min_qty: 500, max_qty: 2000, unit_price: 3.5 },
      { min_qty: 2001, max_qty: 10000, unit_price: 3.2 },
    ]);
    setFormStock(5000);
    setFormReservedStock(0);
    setFormAvailabilityStatus("in_stock");
    setFormMonthlyCapacity("100 MT/month");
    setFormLeadTime(14);
    setFormNextDate("");
    setFormPackaging("25 kg vacuum bags inside multiwall kraft paper sacks");
    setFormStorage("Store in ambient, cool, dry conditions away from sunlight");
    setFormExportDetails("FOB Port of Nhava Sheva (INNSA) / Chennai Port");
    setFormDestinations("Germany, USA, Netherlands, UAE, Japan");
    setFormIncoterms(["FOB", "CIF"]);
    setFormPaymentTerms(["LC at sight", "30% Advance, 70% against BL"]);
    setFormImageUrl("");
    setFormImages([]);
    setFormSupportingDocs([]);
    setFormCertifications([]);
    setModalError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (p: PortalProductItem) => {
    setEditingProduct(p);
    setCurrentStep(1);
    setFormName(p.name || "");
    setFormCategory(p.category_name || "Organic Spices & Herbs");
    setFormProductForm(p.product_form || "Powder");
    setFormHsCode(p.hs_code || "");
    setFormOrigin(p.origin_country || "India");
    setFormRegion(p.production_region || "");
    setFormDesc(p.description || "");

    const specsArr = p.specifications
      ? Object.entries(p.specifications).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      : [{ key: "Curcumin Content", value: "5.2% Min" }];
    setFormSpecs(specsArr);

    setFormMoq(p.moq || 500);
    setFormUnit(p.unit || "kg");
    setFormCurrency(p.currency || "USD");
    setFormPriceValidFrom(p.price_valid_from ? p.price_valid_from.split("T")[0] : "");
    setFormPriceValidUntil(p.price_valid_until ? p.price_valid_until.split("T")[0] : "");

    if (p.price_tiers && p.price_tiers.length > 0) {
      setFormPriceTiers(
        p.price_tiers.map((t) => ({
          min_qty: t.min_qty,
          max_qty: t.max_qty,
          unit_price: t.unit_price,
        }))
      );
    } else {
      setFormPriceTiers([
        { min_qty: p.moq || 500, max_qty: 2000, unit_price: p.price_min || 3.5 },
      ]);
    }

    setFormStock(p.available_quantity ?? p.stock_available ?? 5000);
    setFormReservedStock(p.reserved_quantity ?? 0);
    setFormAvailabilityStatus(p.availability_status || "in_stock");
    setFormMonthlyCapacity(p.monthly_capacity || "100 MT/month");
    setFormLeadTime(p.lead_time_days || 14);
    setFormNextDate(p.next_available_date ? p.next_available_date.split("T")[0] : "");

    setFormPackaging(p.packaging || "25 kg vacuum bags");
    setFormStorage(p.storage || "Cool, dry conditions");
    setFormExportDetails(p.export_details || "Port of Nhava Sheva");
    setFormDestinations(
      p.supported_destinations ? p.supported_destinations.join(", ") : "Germany, USA, UAE"
    );
    setFormIncoterms(p.incoterms && p.incoterms.length > 0 ? p.incoterms : ["FOB", "CIF"]);
    setFormPaymentTerms(
      p.payment_terms && p.payment_terms.length > 0
        ? p.payment_terms
        : ["LC at sight", "30% Advance, 70% against BL"]
    );

    setFormImageUrl(p.image_url || (p.images && p.images[0]) || "");
    setFormImages(p.images || []);
    setFormSupportingDocs(
      (p.supporting_documents || []).map((d) => ({
        name: d.name,
        url: d.url,
        doc_type: d.doc_type || "spec_sheet",
      }))
    );
    setFormCertifications(
      (p.certifications_json || []).map((c) => ({
        certification_name: c.certification_name,
        certificate_no: c.certificate_no || "",
        issuer: c.issuer || "",
        issued_at: c.issued_at ? c.issued_at.split("T")[0] : "",
        expires_at: c.expires_at ? c.expires_at.split("T")[0] : "",
      }))
    );

    setModalError(null);
    setIsProductModalOpen(true);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleBulkStatus = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await supplierPortalApi.bulkUpdateStatus(selectedIds, isActive);
      setSelectedIds([]);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err: any) {
      alert(err.message || "Failed to update selected products");
    }
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

  const handleSubmitForReview = async (id: string) => {
    try {
      const res = await supplierPortalApi.submitProduct(id);
      setActionMessage(`Product submitted: ${res.status}`);
      loadProducts();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await supplierPortalApi.publishProduct(id);
      setActionMessage(`Product published: ${res.status}`);
      loadProducts();
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      const res = await supplierPortalApi.unpublishProduct(id);
      setActionMessage(`Product unpublished: ${res.status}`);
      loadProducts();
    } catch (err: any) {
      alert(`Unpublish failed: ${err.message}`);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await supplierPortalApi.archiveProduct(id);
      setActionMessage(`Product archived: ${res.status}`);
      loadProducts();
    } catch (err: any) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  const validateForm = (): string | null => {
    if (!formName.trim()) return "Product name is required.";
    if (Number(formMoq) <= 0) return "Minimum Order Quantity (MOQ) must be greater than zero.";
    if (formPriceTiers.length === 0) return "At least one price tier is required.";

    // Sort tiers and validate overlap
    const sorted = [...formPriceTiers].sort((a, b) => a.min_qty - b.min_qty);
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];
      if (tier.min_qty <= 0) return `Tier ${i + 1}: min quantity must be greater than 0.`;
      if (tier.unit_price <= 0) return `Tier ${i + 1}: unit price must be positive.`;
      if (tier.max_qty !== undefined && tier.max_qty !== null) {
        if (tier.max_qty < tier.min_qty) {
          return `Tier ${i + 1}: max quantity (${tier.max_qty}) cannot be less than min quantity (${tier.min_qty}).`;
        }
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.max_qty === undefined || prev.max_qty === null) {
          return `Tier ${i}: previous tier is open-ended. Only the final tier may omit max quantity.`;
        }
        if (tier.min_qty <= prev.max_qty) {
          return `Price tiers overlap between tier ${i} and tier ${i + 1}.`;
        }
      }
    }
    return null;
  };

  const buildPayload = (submitDirectly: boolean = false) => {
    const specsObj: Record<string, any> = {};
    formSpecs.forEach((s) => {
      if (s.key.trim()) specsObj[s.key.trim()] = s.value;
    });

    const destinationsList = formDestinations
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    const imagesList = formImageUrl ? [formImageUrl, ...formImages.filter((img) => img !== formImageUrl)] : formImages;

    return {
      name: formName.trim(),
      category_name: formCategory,
      product_form: formProductForm,
      hs_code: formHsCode.trim() || undefined,
      origin_country: formOrigin,
      production_region: formRegion || undefined,
      description: formDesc || undefined,
      lead_time_days: Number(formLeadTime),
      moq: Number(formMoq),
      unit: formUnit,
      currency: formCurrency,
      price_valid_from: formPriceValidFrom || undefined,
      price_valid_until: formPriceValidUntil || undefined,
      available_quantity: Number(formStock),
      reserved_quantity: Number(formReservedStock),
      availability_status: formAvailabilityStatus,
      monthly_capacity: formMonthlyCapacity || undefined,
      packaging: formPackaging || undefined,
      storage: formStorage || undefined,
      export_details: formExportDetails || undefined,
      supported_destinations: destinationsList,
      incoterms: formIncoterms,
      payment_terms: formPaymentTerms,
      stock_available: Number(formStock),
      next_available_date: formNextDate || undefined,
      image_url: formImageUrl || undefined,
      images: imagesList,
      supporting_documents: formSupportingDocs,
      certifications: formCertifications,
      price_tiers: formPriceTiers.map((t) => ({
        min_qty: Number(t.min_qty),
        max_qty: t.max_qty ? Number(t.max_qty) : undefined,
        unit_price: Number(t.unit_price),
        currency: formCurrency,
      })),
      specifications: specsObj,
      submit: submitDirectly,
    };
  };

  const handleSaveProduct = async (submitDirectly: boolean = false) => {
    const errorMsg = validateForm();
    if (errorMsg) {
      setModalError(errorMsg);
      return;
    }

    setIsSavingProduct(true);
    setModalError(null);

    try {
      const payload = buildPayload(submitDirectly);
      if (editingProduct) {
        await supplierPortalApi.updateProduct(editingProduct.id, payload);
        if (submitDirectly) {
          await supplierPortalApi.submitProduct(editingProduct.id);
        }
      } else {
        const created = await supplierPortalApi.createProduct(payload);
        if (submitDirectly && created.id) {
          await supplierPortalApi.submitProduct(created.id);
        }
      }
      setIsProductModalOpen(false);
      loadProducts();
      if (onRefreshMetrics) onRefreshMetrics();
      setActionMessage(
        submitDirectly ? "Product saved and submitted for review!" : "Product saved as draft."
      );
    } catch (err: any) {
      setModalError(err.message || "Failed to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // CSV Template & Import
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

  const getStatusBadge = (status?: string, _isActive?: boolean, rejectionReason?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "published") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Published
        </span>
      );
    }
    if (s === "pending_review") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending Review
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-help"
          title={rejectionReason ? `Rejected: ${rejectionReason}` : "Rejected by admin"}
        >
          <AlertCircle className="w-3 h-3 text-rose-600" />
          Rejected
        </span>
      );
    }
    if (s === "unpublished") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
          <EyeOff className="w-3 h-3 text-slate-500" />
          Unpublished
        </span>
      );
    }
    if (s === "archived") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-bold">
          <Archive className="w-3 h-3 text-zinc-500" />
          Archived
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
        Draft
      </span>
    );
  };

  const getIndexBadge = (p: PortalProductItem) => {
    const isPublished = (p.status || "").toLowerCase() === "published";
    const isPending = (p.status || "").toLowerCase() === "pending_review";
    const status = p.index_status || (isPublished ? "Ready" : isPending ? "Pending" : "Inactive");
    const st = status.toLowerCase();

    if (st === "ready") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold"
          title="Indexed in AI Knowledge Base — available for Grounded RAG"
        >
          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
          AI: Ready
        </span>
      );
    }
    if (st === "pending" || st === "processing") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold"
          title="Indexing in progress"
        >
          <Clock className="w-2.5 h-2.5 text-amber-600" />
          AI: Indexing
        </span>
      );
    }
    if (st === "failed") {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold"
          title="Vector indexing failed"
        >
          <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
          AI: Failed
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold"
        title="Inactive in vector index (Product unpublished/draft)"
      >
        AI: Inactive
      </span>
    );
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
            Publish export-grade products, manage approval lifecycle, volume price tiers & freshness
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCsvModalOpen(true);
              setCsvImportResult(null);
            }}
            className="text-xs font-semibold"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            CSV Bulk Import
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            className="text-xs font-bold shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add New Product
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Bulk Action Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by product name or HS code..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium rounded-xl border border-slate-200 p-2 focus:border-blue-500 focus:outline-none bg-white min-w-[130px]"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending Review</option>
            <option value="draft">Draft</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 text-xs">
            <span className="font-bold text-blue-900">{selectedIds.length} Selected:</span>
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
              Draft / Deactivate
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
                <th className="p-3">Category & Form</th>
                <th className="p-3">HS Code</th>
                <th className="p-3">Price Range & Freshness</th>
                <th className="p-3">MOQ & Capacity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    Loading catalog items...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isChecked = selectedIds.includes(p.id);
                  const isPending = p.status === "pending_review";
                  const isPublished = p.status === "published";
                  const isRejected = p.status === "rejected";

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
                              (p.images && p.images[0]) ||
                              "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=80&q=80"
                            }
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {p.origin_country || "India"}{" "}
                              {p.production_region ? `• ${p.production_region}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{p.category_name}</div>
                        <div className="text-[10px] text-slate-400">{p.product_form || "Standard"}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-600">
                        {p.hs_code || "—"}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          ${p.price_min?.toFixed(2)} - ${p.price_max?.toFixed(2)} / {p.unit}
                        </div>
                        {p.price_badge && (
                          <div
                            className={`text-[10px] font-medium inline-block mt-0.5 px-1.5 py-0.2 rounded ${
                              p.price_status === "stale"
                                ? "bg-amber-100 text-amber-800 font-bold"
                                : "text-slate-400"
                            }`}
                          >
                            {p.price_badge}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">
                          MOQ: {p.moq} {p.unit}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Stock: {(p.available_quantity ?? p.stock_available ?? 0).toLocaleString()} {p.unit}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {getStatusBadge(p.status, p.is_active, p.rejection_reason)}
                            {getIndexBadge(p)}
                          </div>
                          {isRejected && p.rejection_reason && (
                            <div className="text-[10px] text-rose-600 max-w-xs truncate" title={p.rejection_reason}>
                              Reason: {p.rejection_reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Workflow action buttons */}
                          {!isPublished && !isPending && (
                            <button
                              onClick={() => handleSubmitForReview(p.id)}
                              className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold transition flex items-center gap-1"
                              title="Submit for Approval"
                            >
                              <Send className="w-3 h-3" />
                              Submit
                            </button>
                          )}
                          {isPublished && (
                            <button
                              onClick={() => handleUnpublish(p.id)}
                              className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold transition flex items-center gap-1"
                              title="Unpublish product"
                            >
                              <EyeOff className="w-3 h-3" />
                              Unpublish
                            </button>
                          )}
                          {!isPublished && (
                            <button
                              onClick={() => handlePublish(p.id)}
                              className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition"
                              title="Publish directly"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchive(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                            title="Delete"
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

      {/* 7-Step Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : "Create New Export Product"}
                </h3>
                <p className="text-xs text-slate-500">
                  Step {currentStep} of 7:{" "}
                  {currentStep === 1 && "Basic Information"}
                  {currentStep === 2 && "Technical Specifications"}
                  {currentStep === 3 && "Pricing & Volume Tiers"}
                  {currentStep === 4 && "Inventory & Capacity"}
                  {currentStep === 5 && "Logistics & Commercial Terms"}
                  {currentStep === 6 && "Documents & Certifications"}
                  {currentStep === 7 && "Review & Submit"}
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Stepper Bar */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 border-b border-slate-100 text-[11px] font-bold">
              {[
                "1. Basics",
                "2. Specs",
                "3. Pricing",
                "4. Inventory",
                "5. Logistics",
                "6. Documents",
                "7. Review",
              ].map((name, idx) => {
                const stepNum = idx + 1;
                const isActive = currentStep === stepNum;
                const isPassed = currentStep > stepNum;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStep(stepNum)}
                    className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : isPassed
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {isPassed && <Check className="w-3 h-3" />}
                    {name}
                  </button>
                );
              })}
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Step Body */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* STEP 1: BASICS */}
              {currentStep === 1 && (
                <div className="space-y-4">
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
                        placeholder="e.g. Organic Spices & Herbs"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Product Form</label>
                      <select
                        value={formProductForm}
                        onChange={(e) => setFormProductForm(e.target.value)}
                        className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="Powder">Powder</option>
                        <option value="Whole / Raw">Whole / Raw</option>
                        <option value="Flakes">Flakes</option>
                        <option value="Slices">Slices</option>
                        <option value="Extract">Liquid / Extract</option>
                        <option value="Granules">Granules</option>
                      </select>
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
                        placeholder="e.g. India"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700">Production Region</label>
                      <Input
                        value={formRegion}
                        onChange={(e) => setFormRegion(e.target.value)}
                        placeholder="e.g. Alleppey, Kerala / Erode, Tamil Nadu"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700">Product Description</label>
                      <textarea
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        rows={3}
                        placeholder="Detailed export grade specification, harvesting method, chemical purity profile..."
                        className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SPECIFICATIONS */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Technical Specifications</h4>
                      <p className="text-[11px] text-slate-500">
                        Add standardized chemical and physical properties verified by testing labs
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormSpecs([...formSpecs, { key: "", value: "" }])}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      + Add Custom Row
                    </button>
                  </div>

                  {/* Preset Pills */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Quick Preset Inserts:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_SPEC_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (!formSpecs.some((s) => s.key === preset.key)) {
                              setFormSpecs([...formSpecs, preset]);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition"
                        >
                          + {preset.key}: {preset.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {formSpecs.map((spec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="Specification Parameter (e.g. Curcumin Content)"
                          value={spec.key}
                          onChange={(e) => {
                            const updated = [...formSpecs];
                            updated[idx].key = e.target.value;
                            setFormSpecs(updated);
                          }}
                          className="text-xs flex-1"
                        />
                        <Input
                          placeholder="Value / Range (e.g. 5.2% Min)"
                          value={spec.value}
                          onChange={(e) => {
                            const updated = [...formSpecs];
                            updated[idx].value = e.target.value;
                            setFormSpecs(updated);
                          }}
                          className="text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setFormSpecs(formSpecs.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: PRICING AND MOQ */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Minimum Order Qty (MOQ) *</label>
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
                        <option value="bags">bags</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Currency</label>
                      <select
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value)}
                        className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white font-mono"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Price Valid From</label>
                      <Input
                        type="date"
                        value={formPriceValidFrom}
                        onChange={(e) => setFormPriceValidFrom(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700">Price Valid Until</label>
                      <Input
                        type="date"
                        value={formPriceValidUntil}
                        onChange={(e) => setFormPriceValidUntil(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Volume Pricing Tiers */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                        Volume-Based Price Tiers ({formCurrency} / {formUnit})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const lastTier = formPriceTiers[formPriceTiers.length - 1];
                          const nextMin = lastTier && lastTier.max_qty ? lastTier.max_qty + 1 : 10001;
                          setFormPriceTiers([
                            ...formPriceTiers,
                            { min_qty: nextMin, unit_price: 3.0 },
                          ]);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        + Add Price Tier
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formPriceTiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-28">
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
                          </div>
                          <span className="text-xs text-slate-400">to</span>
                          <div className="w-28">
                            <Input
                              type="number"
                              value={tier.max_qty ?? ""}
                              onChange={(e) => {
                                const updated = [...formPriceTiers];
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                updated[idx].max_qty = val;
                                setFormPriceTiers(updated);
                              }}
                              placeholder="Max (blank = ∞)"
                              className="text-xs"
                            />
                          </div>
                          <span className="text-xs text-slate-400">=</span>
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                              {formCurrency}
                            </span>
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
                              className="text-xs pl-12"
                            />
                          </div>
                          {formPriceTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormPriceTiers(formPriceTiers.filter((_, i) => i !== idx))
                              }
                              className="p-2 text-slate-400 hover:text-rose-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: INVENTORY & CAPACITY */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Available Stock ({formUnit})
                      </label>
                      <Input
                        type="number"
                        value={formStock}
                        onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Reserved Stock ({formUnit})
                      </label>
                      <Input
                        type="number"
                        value={formReservedStock}
                        onChange={(e) => setFormReservedStock(parseInt(e.target.value) || 0)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Availability Status</label>
                      <select
                        value={formAvailabilityStatus}
                        onChange={(e) => setFormAvailabilityStatus(e.target.value)}
                        className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none bg-white"
                      >
                        {AVAILABILITY_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Monthly Production Capacity
                      </label>
                      <Input
                        value={formMonthlyCapacity}
                        onChange={(e) => setFormMonthlyCapacity(e.target.value)}
                        placeholder="e.g. 100 MT/month"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Dispatch Lead Time (Days)
                      </label>
                      <Input
                        type="number"
                        value={formLeadTime}
                        onChange={(e) => setFormLeadTime(parseInt(e.target.value) || 1)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Next Available Harvest / Batch Date
                      </label>
                      <Input
                        type="date"
                        value={formNextDate}
                        onChange={(e) => setFormNextDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: LOGISTICS & COMMERCIAL TERMS */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Packaging Specifications</label>
                    <Input
                      value={formPackaging}
                      onChange={(e) => setFormPackaging(e.target.value)}
                      placeholder="e.g. 25 kg vacuum bags inside multiwall kraft paper sacks"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Storage Recommendations</label>
                    <Input
                      value={formStorage}
                      onChange={(e) => setFormStorage(e.target.value)}
                      placeholder="e.g. Store in ambient, cool, dry conditions away from direct sunlight"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Export & Delivery Port Information</label>
                    <Input
                      value={formExportDetails}
                      onChange={(e) => setFormExportDetails(e.target.value)}
                      placeholder="e.g. FOB Port of Nhava Sheva (INNSA) / Port of Chennai"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Supported Destination Countries</label>
                    <Input
                      value={formDestinations}
                      onChange={(e) => setFormDestinations(e.target.value)}
                      placeholder="Comma-separated countries, e.g. Germany, USA, Netherlands, UAE, Japan"
                      className="text-xs"
                    />
                  </div>

                  {/* Incoterms Selector */}
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block">Supported Incoterms</label>
                    <div className="flex flex-wrap gap-2">
                      {INCOTERMS_OPTIONS.map((term) => {
                        const isChecked = formIncoterms.includes(term);
                        return (
                          <button
                            type="button"
                            key={term}
                            onClick={() => {
                              if (isChecked) {
                                setFormIncoterms(formIncoterms.filter((t) => t !== term));
                              } else {
                                setFormIncoterms([...formIncoterms, term]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                              isChecked
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {term}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Terms Selector */}
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block">Accepted Payment Terms</label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_TERMS_OPTIONS.map((pt) => {
                        const isChecked = formPaymentTerms.includes(pt);
                        return (
                          <button
                            type="button"
                            key={pt}
                            onClick={() => {
                              if (isChecked) {
                                setFormPaymentTerms(formPaymentTerms.filter((t) => t !== pt));
                              } else {
                                setFormPaymentTerms([...formPaymentTerms, pt]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                              isChecked
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {pt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: DOCUMENTS & CERTIFICATIONS */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  {/* Primary Image URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Primary Product Image URL</label>
                    <Input
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="text-xs"
                    />
                  </div>

                  {/* Certifications Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Compliance & Organic Certifications
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormCertifications([
                            ...formCertifications,
                            {
                              certification_name: "USDA Organic",
                              certificate_no: "",
                              issuer: "",
                              issued_at: "",
                              expires_at: "",
                            },
                          ])
                        }
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        + Add Certificate
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formCertifications.map((cert, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">Certificate #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormCertifications(
                                  formCertifications.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-slate-400 hover:text-rose-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              placeholder="Certification Name (e.g. EU Organic / ISO 22000)"
                              value={cert.certification_name}
                              onChange={(e) => {
                                const upd = [...formCertifications];
                                upd[idx].certification_name = e.target.value;
                                setFormCertifications(upd);
                              }}
                              className="text-xs"
                            />
                            <Input
                              placeholder="Certificate Number"
                              value={cert.certificate_no}
                              onChange={(e) => {
                                const upd = [...formCertifications];
                                upd[idx].certificate_no = e.target.value;
                                setFormCertifications(upd);
                              }}
                              className="text-xs font-mono"
                            />
                            <Input
                              type="date"
                              placeholder="Issued Date"
                              value={cert.issued_at}
                              onChange={(e) => {
                                const upd = [...formCertifications];
                                upd[idx].issued_at = e.target.value;
                                setFormCertifications(upd);
                              }}
                              className="text-xs"
                            />
                            <Input
                              type="date"
                              placeholder="Expiry Date"
                              value={cert.expires_at}
                              onChange={(e) => {
                                const upd = [...formCertifications];
                                upd[idx].expires_at = e.target.value;
                                setFormCertifications(upd);
                              }}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supporting Documents Section */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Supporting Lab Reports & Specification Sheets
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormSupportingDocs([
                            ...formSupportingDocs,
                            {
                              name: "Certificate of Analysis (COA)",
                              url: "https://tradex.local/docs/sample_coa.pdf",
                              doc_type: "coa",
                            },
                          ])
                        }
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        + Add Document Link
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formSupportingDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="Document Title (e.g. Eurofins Lab Test 2026)"
                            value={doc.name}
                            onChange={(e) => {
                              const upd = [...formSupportingDocs];
                              upd[idx].name = e.target.value;
                              setFormSupportingDocs(upd);
                            }}
                            className="text-xs flex-1"
                          />
                          <Input
                            placeholder="Document URL"
                            value={doc.url}
                            onChange={(e) => {
                              const upd = [...formSupportingDocs];
                              upd[idx].url = e.target.value;
                              setFormSupportingDocs(upd);
                            }}
                            className="text-xs flex-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormSupportingDocs(formSupportingDocs.filter((_, i) => i !== idx))
                            }
                            className="p-2 text-slate-400 hover:text-rose-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 7: REVIEW & SUBMIT */}
              {currentStep === 7 && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">{formName || "Untitled Product"}</h4>
                      <span className="text-xs font-mono font-bold text-blue-600">{formHsCode || "No HS code"}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Category & Form</span>
                        <span className="font-semibold text-slate-800">
                          {formCategory} • {formProductForm}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Origin & Region</span>
                        <span className="font-semibold text-slate-800">
                          {formOrigin} {formRegion ? `(${formRegion})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">MOQ</span>
                        <span className="font-semibold text-slate-800">
                          {formMoq} {formUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Available Stock</span>
                        <span className="font-semibold text-slate-800">
                          {formStock} {formUnit} ({formAvailabilityStatus})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Capacity & Lead Time</span>
                        <span className="font-semibold text-slate-800">
                          {formMonthlyCapacity} • {formLeadTime}d
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Incoterms</span>
                        <span className="font-semibold text-slate-800">
                          {formIncoterms.join(", ") || "None selected"}
                        </span>
                      </div>
                    </div>

                    {/* Price Tiers Preview */}
                    <div className="border-t border-slate-200 pt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Volume Pricing Tiers:
                      </span>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {formPriceTiers.map((t, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono"
                          >
                            {t.min_qty} - {t.max_qty ?? "∞"} {formUnit}:{" "}
                            <span className="font-bold text-emerald-700">
                              {formCurrency} {t.unit_price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Specs Preview */}
                    <div className="border-t border-slate-200 pt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Technical Specifications ({formSpecs.length}):
                      </span>
                      <div className="grid grid-cols-2 gap-1 text-xs text-slate-700">
                        {formSpecs.map((s, idx) => (
                          <div key={idx}>
                            <span className="font-semibold">{s.key}:</span> {s.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Submitting will enter this product into the compliance review workflow. Once approved by TradeX
                      moderation, it will be indexed in semantic search and accessible to international buyers.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="text-xs font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous Step
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentStep < 7 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="text-xs font-bold shadow-md shadow-blue-500/20"
                  >
                    Next Step
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSavingProduct}
                      onClick={() => handleSaveProduct(false)}
                      className="text-xs font-semibold"
                    >
                      Save as Draft
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isSavingProduct}
                      onClick={() => handleSaveProduct(true)}
                      className="text-xs font-bold shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      {isSavingProduct ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                CSV Bulk Product Upload
              </h3>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCsvImport} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-[11px] text-slate-400">
                  Ensure column headers match our official CSV template.
                </p>
              </div>

              {csvImportResult && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    Import Result: {csvImportResult.successful_rows} / {csvImportResult.total_rows} successful
                  </div>
                  {csvImportResult.errors?.length > 0 && (
                    <div className="text-rose-600 text-[11px] max-h-24 overflow-y-auto">
                      {csvImportResult.errors.map((err, i) => (
                        <div key={i}>
                          Row {err.row}: {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={!csvFile || isImporting}
                  className="font-bold shadow-md shadow-blue-500/20"
                >
                  {isImporting ? "Importing..." : "Process CSV"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
