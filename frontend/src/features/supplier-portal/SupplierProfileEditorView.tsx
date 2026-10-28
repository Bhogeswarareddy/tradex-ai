import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  Factory,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
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
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        ...profile,
        year_founded: profile.year_founded || (profile.years_in_business ? 2026 - profile.years_in_business : 2015),
        employees: profile.employees || (profile.factory_details as any)?.employees || 150,
        factory_photos: profile.factory_photos || (profile.factory_details as any)?.photos || [],
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

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    const current = form.factory_photos || [];
    setForm({ ...form, factory_photos: [...current, newPhotoUrl.trim()] });
    setNewPhotoUrl("");
  };

  const handleRemovePhoto = (idx: number) => {
    const current = form.factory_photos || [];
    setForm({ ...form, factory_photos: current.filter((_, i) => i !== idx) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload: Partial<StorefrontProfile> = {
        ...form,
        export_markets: form.export_countries,
        factory_details: {
          ...(form.factory_details || {}),
          employees: form.employees,
          photos: form.factory_photos,
        },
      };
      const updated = await supplierPortalApi.updateProfile(payload);
      setSaveSuccess(true);
      onProfileUpdated(updated);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const completeness = profile.completeness_score ?? 80;
  const tips = profile.completeness_tips || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Storefront Preview Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Storefront Management</h3>
          <p className="text-xs text-slate-500">
            Customize how verified global buyers see your manufacturing operations and export credentials
          </p>
        </div>
        <a
          href={profile.public_storefront_url || `/suppliers/${profile.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs border border-blue-200 transition-colors shrink-0"
        >
          View Public Storefront
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Profile Completeness Meter Card */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#38BDF8]" />
              <h3 className="font-bold text-base text-white">
                Storefront Completeness Meter
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-[#38BDF8] border border-blue-400/30">
                {completeness}% Completed
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Profiles with 90%+ completeness receive 3.4x more verified buyer inquiries and top placement in AI search.
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
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-300">
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
            <span>Storefront profile and facility credentials successfully saved and updated!</span>
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
              <label className="text-xs font-bold text-slate-700">Company Legal Name *</label>
              <Input
                value={form.company_name || ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                required
                className="text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Website URL</label>
              <Input
                value={form.website || ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://company.com"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Headquarters Country *</label>
              <Input
                value={form.country || ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">City / Port City *</label>
              <Input
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Year Founded</label>
              <Input
                type="number"
                value={form.year_founded || ""}
                onChange={(e) => setForm({ ...form, year_founded: parseInt(e.target.value) || 2015 })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Number of Employees</label>
              <Input
                type="number"
                value={form.employees || ""}
                onChange={(e) => setForm({ ...form, employees: parseInt(e.target.value) || 100 })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">About Company & Export Capability *</label>
            <textarea
              rows={4}
              value={form.about || form.description || ""}
              onChange={(e) => setForm({ ...form, about: e.target.value, description: e.target.value })}
              placeholder="Provide a comprehensive summary of your production facilities, testing capabilities, and export history..."
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Logo Image URL</label>
              <Input
                value={form.logo_url || ""}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Hero Banner Image URL</label>
              <Input
                value={form.banner_url || ""}
                onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Global Export Markets & Languages */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">
              Export Destinations & Supported Languages
            </h3>
          </div>

          {/* Export Countries */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Key Export Target Markets</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.export_countries || []).map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  {c}
                  <button type="button" onClick={() => handleRemoveCountry(c)} className="text-slate-400 hover:text-rose-500">
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

          {/* Languages */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700">Sales Communication Languages</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.languages || []).map((l) => (
                <span
                  key={l}
                  className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  {l}
                  <button type="button" onClick={() => handleRemoveLang(l)} className="text-blue-400 hover:text-rose-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="Add language (e.g. German, Arabic)"
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddLang}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>

        {/* Section 3: Factory Photographs */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Factory className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">
              Factory Facilities & Production Photos
            </h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(form.factory_photos || []).map((photo, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                  <img src={photo} alt={`Facility ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-2">
              <Input
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="Paste factory photo URL..."
                className="text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddPhoto}>
                <Plus className="w-4 h-4 mr-1" /> Add Photo
              </Button>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving}
            className="text-xs font-bold px-6 shadow-md shadow-blue-500/20"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? "Saving Storefront..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};
