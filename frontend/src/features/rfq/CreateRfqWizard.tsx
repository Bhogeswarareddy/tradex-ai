import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { rfqsApi, RFQDetail } from "../../lib/api/rfqs";
import { Button } from "../../components/ui/Button";

interface CreateRfqWizardProps {
  onSuccess: (rfqId: string, rfqNumber: string) => void;
  onCancel: () => void;
  initialPrompt?: string;
}

export const CreateRfqWizard: React.FC<CreateRfqWizardProps> = ({
  onSuccess,
  onCancel,
  initialPrompt = "",
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [aiPrompt, setAiPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    title: "",
    product: "",
    category: "Agricultural Commodities",
    quantity: 20000,
    unit: "kg",
    target_price_min: 2.80,
    target_price_max: 3.20,
    currency: "EUR",
    destination_country: "Germany",
    destination_port: "Hamburg",
    deadline: "2026-11-15",
    incoterm: "CIF",
    payment_terms: "LC at sight, 30% advance",
    quality_requirements: "Eurofins pesticide residue test report, Euro-1 certificate, and valid COA.",
    certifications: ["EU Organic", "ISO 22000"],
    specifications: [
      { key: "curcumin", value: ">=5.0%" },
      { key: "moisture", value: "<=9%" },
      { key: "packaging", value: "25kg vacuum sealed multi-wall bags" },
    ],
    notes: "",
  });

  // Handle AI Draft Generation
  const handleAiGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const draft = await rfqsApi.generateDraft(aiPrompt.trim());
      setFormData((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        product: draft.product || prev.product,
        category: draft.category || prev.category,
        quantity: draft.quantity || prev.quantity,
        unit: draft.unit || prev.unit,
        target_price_min: draft.target_price_min || prev.target_price_min,
        target_price_max: draft.target_price_max || prev.target_price_max,
        currency: draft.currency || prev.currency,
        destination_country: draft.destination_country || prev.destination_country,
        destination_port: draft.destination_port || prev.destination_port,
        incoterm: draft.incoterm || prev.incoterm,
        payment_terms: draft.payment_terms || prev.payment_terms,
        quality_requirements: draft.quality_requirements || prev.quality_requirements,
        certifications: draft.required_certifications?.length
          ? draft.required_certifications
          : prev.certifications,
        specifications: draft.specifications
          ? Object.entries(draft.specifications).map(([key, value]) => ({ key, value }))
          : prev.specifications,
      }));
      setIsAiGenerated(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate RFQ draft with AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSpecChange = (index: number, keyOrValue: "key" | "value", val: string) => {
    const updated = [...formData.specifications];
    updated[index][keyOrValue] = val;
    setFormData((prev) => ({ ...prev, specifications: updated }));
  };

  const addSpecRow = () => {
    setFormData((prev) => ({
      ...prev,
      specifications: [...prev.specifications, { key: "", value: "" }],
    }));
  };

  const removeSpecRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (publishNow: boolean) => {
    setIsSubmitting(true);
    setError(null);

    // Convert specifications back to key/value map
    const specsMap: Record<string, string> = {};
    formData.specifications.forEach((s) => {
      if (s.key.trim()) specsMap[s.key.trim()] = s.value.trim();
    });

    try {
      const payload: Partial<RFQDetail> = {
        title: formData.title || `RFQ: ${formData.quantity} ${formData.unit} of ${formData.product}`,
        product: formData.product || formData.title,
        category: formData.category,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        target_price_min: Number(formData.target_price_min),
        target_price_max: Number(formData.target_price_max),
        currency: formData.currency,
        destination_country: formData.destination_country,
        destination_port: formData.destination_port,
        deadline: formData.deadline,
        incoterm: formData.incoterm,
        payment_terms: formData.payment_terms,
        quality_requirements: formData.quality_requirements,
        required_certifications: formData.certifications,
        specifications: specsMap,
        status: publishNow ? "active" : "draft",
      };

      const result = await rfqsApi.create(payload);
      onSuccess(result.id, result.rfq_number);
    } catch (err: any) {
      setError(err.message || "Failed to submit RFQ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-4xl mx-auto my-6">
      {/* Wizard Header */}
      <div className="bg-slate-900 text-white p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
              RFQ
            </div>
            <h2 className="text-xl sm:text-2xl font-black">Create Request for Quotation</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white text-xs font-semibold"
          >
            Cancel
          </button>
        </div>

        {/* Step Stepper */}
        <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-slate-800 text-xs">
          {[
            { step: 1, label: "1. Product" },
            { step: 2, label: "2. Requirements" },
            { step: 3, label: "3. Delivery & Price" },
            { step: 4, label: "4. Review" },
          ].map((s) => (
            <div
              key={s.step}
              className={`pb-2 border-b-2 font-medium transition-colors ${
                currentStep === s.step
                  ? "border-blue-500 text-blue-400 font-bold"
                  : currentStep > s.step
                  ? "border-emerald-500 text-emerald-400"
                  : "border-slate-800 text-slate-500"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Top 'Generate with AI' Box */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-900/10 via-sky-900/10 to-indigo-900/10 border border-blue-200/80 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Generate RFQ with AI Trade Assistant</span>
          </div>
          <p className="text-xs text-slate-600">
            Type your informal requirement in plain English. TradeX AI will automatically parse specifications, certifications, port terms, and pricing.
          </p>

          <form onSubmit={handleAiGenerate} className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. I need 20 tons of organic turmeric powder from India delivered to Hamburg in 45 days..."
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isGenerating || !aiPrompt.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Draft with AI</span>
                </>
              )}
            </Button>
          </form>

          {isAiGenerated && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>AI generated, please review specifications and pricing before publishing.</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* STEP 1: Product & Title */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">RFQ Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Organic Turmeric Powder (High Curcumin, EU Certified)"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.product}
                  onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  placeholder="e.g. Organic Turmeric Powder"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Commodity Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="Agricultural Commodities">Agricultural Commodities</option>
                  <option value="Spices & Herbs">Spices & Herbs</option>
                  <option value="Textiles & Fabrics">Textiles & Fabrics</option>
                  <option value="Chemicals & Minerals">Chemicals & Minerals</option>
                  <option value="Metals & Engineering">Metals & Engineering</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Requirements & Specifications */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">Detailed Specifications (Key/Value)</label>
                <button
                  type="button"
                  onClick={addSpecRow}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Spec</span>
                </button>
              </div>

              <div className="space-y-2">
                {formData.specifications.map((spec, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={spec.key}
                      onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                      placeholder="e.g. Curcumin Content"
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={spec.value}
                      onChange={(e) => handleSpecChange(idx, "value", e.target.value)}
                      placeholder="e.g. >= 5.0%"
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeSpecRow(idx)}
                      className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quality & Testing Requirements
              </label>
              <textarea
                rows={2}
                value={formData.quality_requirements}
                onChange={(e) => setFormData({ ...formData, quality_requirements: e.target.value })}
                className="w-full px-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Required Certifications (comma separated)
              </label>
              <input
                type="text"
                value={formData.certifications.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    certifications: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Delivery & Pricing */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Quantity *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-20 px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Price Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_price_min}
                    onChange={(e) => setFormData({ ...formData, target_price_min: Number(e.target.value) })}
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400">&ndash;</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_price_max}
                    onChange={(e) => setFormData({ ...formData, target_price_max: Number(e.target.value) })}
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="px-2 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Country *</label>
                <input
                  type="text"
                  value={formData.destination_country}
                  onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Port *</label>
                <input
                  type="text"
                  value={formData.destination_port}
                  onChange={(e) => setFormData({ ...formData, destination_port: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Incoterm</label>
                <select
                  value={formData.incoterm}
                  onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                  <option value="FOB">FOB (Free on Board)</option>
                  <option value="CFR">CFR (Cost & Freight)</option>
                  <option value="EXW">EXW (Ex Works)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bidding Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="e.g. 100% Irrevocable LC at sight"
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Finalize */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">{formData.title}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block">Quantity:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.quantity.toLocaleString()} {formData.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Destination:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.destination_port}, {formData.destination_country}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Budget:</span>
                  <span className="font-semibold text-slate-800">
                    {formData.currency} {formData.target_price_min} &ndash; {formData.target_price_max}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Incoterm & Terms:</span>
                  <span className="font-semibold text-slate-800">{formData.incoterm}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 block mb-1">Required Certifications:</span>
                <div className="flex flex-wrap gap-1.5">
                  {formData.certifications.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Publishing will make this RFQ visible to verified matching exporters in our global network. You can also save it as a draft and publish later.
            </p>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-1.5 text-xs border-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="text-xs border-slate-300 hover:bg-slate-50"
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Publish RFQ</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
