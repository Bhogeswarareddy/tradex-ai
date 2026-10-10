import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  Factory,
  Globe,
  Languages,
  Plus,
  Trash2,
} from "lucide-react";
import {
  StorefrontProfile,
  supplierPortalApi,
} from "../../lib/api/supplierPortal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

interface SupplierProfileEditorViewProps {
  profile: StorefrontProfile | null;
  isLoading?: boolean;
  onProfileUpdated: (updated: StorefrontProfile) => void;
}

export const SupplierProfileEditorView: React.FC<SupplierProfileEditorViewProps> = ({
  profile,
  isLoading,
  onProfileUpdated,
}) => {
  const [form, setForm] = useState<Partial<StorefrontProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Export countries & languages tag management
  const [newCountry, setNewCountry] = useState("");
  const [newLang, setNewLang] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        ...profile,
        factory_details: {
          facility_size: profile.factory_details?.facility_size || "45,000 sq ft",
          annual_capacity: profile.factory_details?.annual_capacity || "12,000 MT",
          production_lines: profile.factory_details?.production_lines || 6,
          cleanrooms: profile.factory_details?.cleanrooms || "ISO Class 8 Cleanroom",
          warehouse_capacity: profile.factory_details?.warehouse_capacity || "10,000 MT Climate Controlled",
          testing_lab: profile.factory_details?.testing_lab || "In-house NABL Accredited HPLC / GC-MS",
          photos: profile.factory_details?.photos || [],
        },
      });
    }
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 animate-pulse">
        Loading storefront profile details...
      </div>
    );
  }

  const handleAddCountry = () => {
    if (!newCountry.trim()) return;
    const current = form.export_countries || [];
    if (!current.includes(newCountry.trim())) {
      setForm({ ...form, export_countries: [...current, newCountry.trim()] });
    }
    setNewCountry("");
  };

  const handleRemoveCountry = (c: string) => {
    const current = form.export_countries || [];
    setForm({ ...form, export_countries: current.filter((x) => x !== c) });
  };

  const handleAddLang = () => {
    if (!newLang.trim()) return;
    const current = form.languages || [];
    if (!current.includes(newLang.trim())) {
      setForm({ ...form, languages: [...current, newLang.trim()] });
    }
    setNewLang("");
  };

  const handleRemoveLang = (l: string) => {
    const current = form.languages || [];
    setForm({ ...form, languages: current.filter((x) => x !== l) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updated = await supplierPortalApi.updateProfile(form);
      setSaveSuccess(true);
      onProfileUpdated(updated);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const completeness = profile.completeness_score || 80;
  const tips = profile.completeness_tips || [
    "Upload 2 additional factory inspection unit photos to reach 95%",
    "Add Japanese or Arabic languages to attract Asian/Middle Eastern importers",
  ];

  return (
    <div className="space-y-6">
      {/* Profile Completeness Meter Card */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#38BDF8]" />
              <h3 className="font-bold text-base text-white">
                Storefront Profile Completeness
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-[#38BDF8] border border-blue-400/30">
                {completeness}% Completed
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Profiles with 90%+ completeness receive 3.4x more RFQ inquiries and verified buyer engagements.
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/15">
              <div
                className="bg-gradient-to-r from-[#38BDF8] to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>

          {/* Actionable Tips */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:max-w-md space-y-2 text-xs">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider text-slate-300">
              Actionable Tips to Reach 100%:
            </div>
            {tips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profile Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Storefront profile and factory details successfully saved and updated!</span>
          </div>
        )}

        {saveError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Section 1: Basic Identity & Branding */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              Company Branding & Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Company Legal Name</label>
              <Input
                value={form.company_name || ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Website URL</label>
              <Input
                value={form.website || ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Logo Image URL</label>
              <Input
                value={form.logo_url || ""}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Banner Cover Image URL</label>
              <Input
                value={form.banner_url || ""}
                onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                placeholder="https://..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Full About Company Overview</label>
              <textarea
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Location, Years & Capacity */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              Operations, Location & Trade Markets
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">City / Port City</label>
              <Input
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">State / Province</label>
              <Input
                value={form.state || ""}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Country</label>
              <Input
                value={form.country || ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Years in Business</label>
              <Input
                type="number"
                value={form.years_in_business || 1}
                onChange={(e) => setForm({ ...form, years_in_business: parseInt(e.target.value) || 1 })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Monthly Processing Capacity</label>
              <Input
                value={form.capacity_per_month || ""}
                onChange={(e) => setForm({ ...form, capacity_per_month: e.target.value })}
                placeholder="e.g. 1,000 MT / Month"
                className="text-xs"
              />
            </div>
          </div>

          {/* Export Countries Tags */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700">Primary Export Countries</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.export_countries || []).map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => handleRemoveCountry(c)}
                    className="hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="Add country (e.g. Germany)"
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCountry}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Languages Spoken */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-slate-500" />
              Business Negotiation Languages
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.languages || []).map((l) => (
                <span
                  key={l}
                  className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  {l}
                  <button
                    type="button"
                    onClick={() => handleRemoveLang(l)}
                    className="hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="Add language (e.g. German)"
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddLang}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>

        {/* Section 3: Factory Specifications */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Factory className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              Factory Specifications & Inspection Data
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Facility Size</label>
              <Input
                value={form.factory_details?.facility_size || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: { ...form.factory_details, facility_size: e.target.value },
                  })
                }
                placeholder="45,000 sq ft"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Annual Production Capacity</label>
              <Input
                value={form.factory_details?.annual_capacity || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: { ...form.factory_details, annual_capacity: e.target.value },
                  })
                }
                placeholder="12,000 MT"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Automated Production Lines</label>
              <Input
                type="number"
                value={form.factory_details?.production_lines || 6}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: {
                      ...form.factory_details,
                      production_lines: parseInt(e.target.value) || 1,
                    },
                  })
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Cleanroom Standard</label>
              <Input
                value={form.factory_details?.cleanrooms || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: { ...form.factory_details, cleanrooms: e.target.value },
                  })
                }
                placeholder="ISO Class 8 Cleanroom"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Warehouse & Climate Storage</label>
              <Input
                value={form.factory_details?.warehouse_capacity || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: {
                      ...form.factory_details,
                      warehouse_capacity: e.target.value,
                    },
                  })
                }
                placeholder="10,000 MT Climate Controlled"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Testing Lab & Quality Assurance</label>
              <Input
                value={form.factory_details?.testing_lab || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    factory_details: { ...form.factory_details, testing_lab: e.target.value },
                  })
                }
                placeholder="In-house NABL Accredited HPLC / GC-MS"
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            className="font-bold shadow-md shadow-blue-500/20 px-8"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Storefront Profile
          </Button>
        </div>
      </form>
    </div>
  );
};
