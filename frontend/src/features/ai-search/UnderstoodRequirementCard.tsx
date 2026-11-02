import React, { useState } from "react";
import { formatNumber, formatCurrency } from "../../lib/format";
import {
  Sparkles,
  Check,
  Edit2,
  X,
  Plus,
  HelpCircle,
  FileText,
  Bookmark,
  BookmarkCheck,
  Globe,
  Package,
  Clock,
  ShieldCheck,
  Anchor,
  DollarSign,
  Activity,
  Layers,
} from "lucide-react";
import { ExtractedRequirement } from "../../lib/api/aiSearch";
import { Button } from "../../components/ui/Button";

interface UnderstoodRequirementCardProps {
  query?: string;
  status?: string;
  requirement: ExtractedRequirement;
  missingFields?: string[];
  clarifyingQuestions?: string[];
  executionTimeMs?: number;
  isMock?: boolean;
  onRequirementChange: (updated: ExtractedRequirement) => void;
  onCreateRfq: () => void;
  onSaveSearch: () => void;
  isSaved?: boolean;
  aiMeta?: {
    provider: string;
    model: string;
    is_demo: boolean;
    latency_ms: number;
    fallback_reason?: string;
  };
}

export const UnderstoodRequirementCard: React.FC<UnderstoodRequirementCardProps> = ({
  query,
  status = "success",
  requirement,
  missingFields = [],
  clarifyingQuestions = [],
  executionTimeMs,
  isMock,
  onRequirementChange,
  onCreateRfq,
  onSaveSearch,
  isSaved = false,
  aiMeta,
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: string, currentValue: string | number | undefined) => {
    setEditingField(field);
    setEditValue(currentValue ? String(currentValue) : "");
  };

  const saveEdit = (field: string) => {
    const updated = { ...requirement };
    if (field === "product") updated.product = editValue.trim() || updated.product;
    else if (field === "quantity") updated.quantity = editValue ? Number(editValue) : undefined;
    else if (field === "unit") updated.unit = editValue.trim() || updated.unit;
    else if (field === "max_budget") updated.max_budget = editValue ? Number(editValue) : undefined;
    else if (field === "origin_country") updated.origin_country = editValue.trim() || undefined;
    else if (field === "destination_country") updated.destination_country = editValue.trim() || undefined;
    else if (field === "destination_port") updated.destination_port = editValue.trim() || undefined;
    else if (field === "delivery_days") updated.delivery_days = editValue ? Number(editValue) : undefined;
    else if (field === "incoterm") updated.incoterm = editValue.trim() || undefined;

    onRequirementChange(updated);
    setEditingField(null);
  };

  const removeCertification = (cert: string) => {
    const updated = {
      ...requirement,
      certifications: requirement.certifications.filter((c) => c !== cert),
    };
    onRequirementChange(updated);
  };

  const addCertification = (cert: string) => {
    if (!cert.trim()) return;
    const clean = cert.trim();
    if (requirement.certifications.includes(clean)) return;
    const updated = {
      ...requirement,
      certifications: [...requirement.certifications, clean],
    };
    onRequirementChange(updated);
  };

  const clearField = (field: keyof ExtractedRequirement) => {
    const updated = { ...requirement };
    if (field === "origin_country") updated.origin_country = undefined;
    else if (field === "destination_country") updated.destination_country = undefined;
    else if (field === "destination_port") updated.destination_port = undefined;
    else if (field === "delivery_days") updated.delivery_days = undefined;
    else if (field === "quantity") updated.quantity = undefined;
    else if (field === "max_budget") updated.max_budget = undefined;
    else if (field === "incoterm") updated.incoterm = undefined;
    onRequirementChange(updated);
  };

  // Determine honest provider label from aiMeta
  const isDemo = Boolean(aiMeta?.is_demo || isMock);
  const latencySec = (
    (aiMeta?.latency_ms !== undefined ? aiMeta.latency_ms : (executionTimeMs || 1000)) / 1000
  ).toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-blue-200/80 shadow-md p-5 sm:p-6 transition-all space-y-5">
      {/* Header bar: Title, Query, Status badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Search Requirement Summary
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  status === "not_found"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {status === "not_found" ? "Not Found" : "Found"}
              </span>
            </div>
            {query && (
              <p className="text-xs text-slate-500 mt-0.5">
                Original query: <span className="font-semibold text-slate-700">"{query}"</span>
              </p>
            )}
          </div>
        </div>

        {/* Telemetry info & Provider Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-[11px] border ${
              isDemo
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {isDemo
              ? `Demo AI (${aiMeta?.fallback_reason || "Deterministic"})`
              : `Live AI: ${aiMeta?.model || "llama-3.3-70b-versatile"}`}
          </span>
          {executionTimeMs !== undefined && (
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px]">
              {Math.round(executionTimeMs)}ms
            </span>
          )}
        </div>
      </div>

      {/* Interpreted Summary Overview */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px] tracking-wider">
            Interpreted Product
          </span>
          <span className="font-bold text-slate-900 text-sm">
            {requirement.product || "All Products"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px] tracking-wider">
            Requested Quantity
          </span>
          <span className="font-bold text-slate-900 text-sm">
            {requirement.quantity !== undefined
              ? `${formatNumber(requirement.quantity)} ${requirement.unit || "units"}`
              : "Any / Flexible"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px] tracking-wider">
            Target Currency
          </span>
          <span className="font-bold text-slate-900 text-sm">{requirement.currency || "USD"}</span>
        </div>
      </div>

      {/* Chips Container: ONLY fields actually stated by buyer */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Filter Chips (Click to edit)
          </span>
          <span className="text-[11px] text-slate-400">
            Editing re-filters without calling the AI endpoint
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Product Chip */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm font-medium shadow-sm">
            <Package className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-blue-500 font-normal">Product:</span>
            {editingField === "product" ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="px-1.5 py-0.5 bg-white border border-blue-400 rounded text-xs text-slate-800 focus:outline-none w-28"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => saveEdit("product")}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="font-semibold">{requirement.product}</span>
            )}
            {editingField !== "product" && (
              <button
                type="button"
                onClick={() => startEdit("product", requirement.product)}
                className="text-blue-400 hover:text-blue-700 ml-1"
                title="Edit product"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quantity & Unit Chip: ONLY if stated */}
          {requirement.quantity !== undefined && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs sm:text-sm font-medium shadow-sm">
              <Layers className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <span className="text-indigo-500 font-normal">Quantity:</span>
              {editingField === "quantity" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="px-1.5 py-0.5 bg-white border border-indigo-400 rounded text-xs text-slate-800 focus:outline-none w-20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit("quantity")}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="font-semibold">
                  {formatNumber(requirement.quantity)} {requirement.unit || "units"}
                </span>
              )}
              {editingField !== "quantity" && (
                <button
                  type="button"
                  onClick={() => startEdit("quantity", requirement.quantity)}
                  className="text-indigo-400 hover:text-indigo-700 ml-1"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => clearField("quantity")}
                className="text-indigo-300 hover:text-rose-500 ml-1"
                title="Remove quantity constraint"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Price Limit Chip: ONLY if stated */}
          {requirement.max_budget !== undefined && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-900 text-xs sm:text-sm font-medium shadow-sm">
              <DollarSign className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
              <span className="text-violet-500 font-normal">Max Price:</span>
              {editingField === "max_budget" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="px-1.5 py-0.5 bg-white border border-violet-400 rounded text-xs text-slate-800 focus:outline-none w-20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit("max_budget")}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="font-semibold">
                  {formatCurrency(requirement.max_budget, requirement.currency || "USD")}
                </span>
              )}
              {editingField !== "max_budget" && (
                <button
                  type="button"
                  onClick={() => startEdit("max_budget", requirement.max_budget)}
                  className="text-violet-400 hover:text-violet-700 ml-1"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => clearField("max_budget")}
                className="text-violet-300 hover:text-rose-500 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Origin Country Chip: ONLY if stated */}
          {requirement.origin_country && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-medium shadow-sm">
              <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-emerald-600 font-normal">Origin:</span>
              {editingField === "origin_country" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="px-1.5 py-0.5 bg-white border border-emerald-400 rounded text-xs text-slate-800 focus:outline-none w-24"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit("origin_country")}
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="font-semibold">{requirement.origin_country}</span>
              )}
              {editingField !== "origin_country" && (
                <button
                  type="button"
                  onClick={() => startEdit("origin_country", requirement.origin_country)}
                  className="text-emerald-400 hover:text-emerald-700 ml-1"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => clearField("origin_country")}
                className="text-emerald-400 hover:text-rose-500 ml-1"
                title="Remove origin constraint"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Destination Country Chip: ONLY if stated by buyer */}
          {requirement.destination_country && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs sm:text-sm font-medium shadow-sm">
              <Anchor className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
              <span className="text-purple-500 font-normal">Destination:</span>
              <span className="font-semibold">
                {requirement.destination_country}
                {requirement.destination_port ? ` (${requirement.destination_port})` : ""}
              </span>
              <button
                type="button"
                onClick={() => clearField("destination_country")}
                className="text-purple-400 hover:text-rose-500 ml-1"
                title="Remove destination constraint"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Delivery Days: ONLY if stated by buyer */}
          {requirement.delivery_days !== undefined && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium shadow-sm">
              <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-amber-600 font-normal">Lead Time:</span>
              <span className="font-semibold">Within {requirement.delivery_days} days</span>
              <button
                type="button"
                onClick={() => clearField("delivery_days")}
                className="text-amber-400 hover:text-rose-500 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Certifications: ONLY if stated */}
          {requirement.certifications?.map((cert) => (
            <div
              key={cert}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs sm:text-sm font-medium shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span className="font-semibold">{cert}</span>
              <button
                type="button"
                onClick={() => removeCertification(cert)}
                className="text-teal-400 hover:text-rose-600 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Quick add certification chip */}
          <button
            type="button"
            onClick={() => {
              const input = window.prompt("Enter certification name (e.g. ISO 22000, HACCP, GMP):");
              if (input) addCertification(input);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 text-xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add Cert</span>
          </button>
        </div>
      </div>

      {/* Optional Suggestions Section: Unasked trade questions shown as suggestions, not filters */}
      {(missingFields.length > 0 || clarifyingQuestions.length > 0) && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            <span>Optional Suggestions to Refine Trade Terms:</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {!requirement.destination_country && (
              <button
                type="button"
                onClick={() => {
                  const dest = window.prompt("Enter destination country or port (e.g. Germany, Rotterdam):");
                  if (dest) {
                    onRequirementChange({ ...requirement, destination_country: dest.trim() });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 text-[11px] font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-slate-400" />
                <span>Specify Destination Port</span>
              </button>
            )}

            {!requirement.incoterm && (
              <button
                type="button"
                onClick={() => {
                  const inc = window.prompt("Enter preferred Incoterm (e.g. FOB, CIF, EXW):");
                  if (inc) {
                    onRequirementChange({ ...requirement, incoterm: inc.trim().toUpperCase() });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 text-[11px] font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-slate-400" />
                <span>Specify Incoterm (FOB / CIF)</span>
              </button>
            )}

            {requirement.delivery_days === undefined && (
              <button
                type="button"
                onClick={() => {
                  const days = window.prompt("Enter maximum acceptable delivery lead time (days):");
                  if (days && !isNaN(Number(days))) {
                    onRequirementChange({ ...requirement, delivery_days: Number(days) });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 text-[11px] font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-slate-400" />
                <span>Specify Maximum Lead Time</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons: Create RFQ & Save Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          Ready to trade? Convert these specifications directly into an official RFQ.
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveSearch}
            className="flex items-center gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 text-slate-500" />
                <span>Save Search</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onCreateRfq}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Create RFQ from this requirement</span>
          </Button>
        </div>
      </div>

      {/* Honest AI Reply Footer from meta */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {isDemo
            ? `Demo AI (reason: ${aiMeta?.fallback_reason || "Deterministic requirement extractor"})`
            : `Live AI: ${aiMeta?.model || "llama-3.3-70b-versatile"}, ${latencySec}s`}
        </span>
        <span className="text-[10px] font-mono uppercase text-slate-400">
          {aiMeta?.provider || (isDemo ? "demo" : "groq")}
        </span>
      </div>
    </div>
  );
};
