import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Package,
  Layers,
  Award,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  supplierPortalApi,
  SupplierDashboardMetrics,
  StorefrontProfile,
} from "../lib/api/supplierPortal";
import {
  SupplierDashboardView,
  SupplierProfileEditorView,
  SupplierProductsManagerView,
  SupplierCapacityView,
  SupplierCertificationsView,
  SupplierInquiriesView,
} from "../features/supplier-portal";

type PortalTab =
  | "dashboard"
  | "profile"
  | "products"
  | "capacity"
  | "certifications"
  | "inquiries";

export const SupplierPortalPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as PortalTab) || "dashboard";
  const [activeTab, setActiveTab] = useState<PortalTab>(initialTab);

  const [metrics, setMetrics] = useState<SupplierDashboardMetrics | null>(null);
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPortalData();
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") as PortalTab;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const loadPortalData = async () => {
    setIsLoading(true);
    try {
      const [m, p] = await Promise.allSettled([
        supplierPortalApi.getMetrics(),
        supplierPortalApi.getProfile(),
      ]);
      if (m.status === "fulfilled") setMetrics(m.value);
      if (p.status === "fulfilled") setProfile(p.value);
    } catch (err) {
      console.error("Failed to load portal data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: PortalTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs: { key: PortalTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "profile", label: "Storefront Profile", icon: Store },
    { key: "products", label: "Products", icon: Package },
    { key: "capacity", label: "Capacity & Inventory", icon: Layers },
    { key: "certifications", label: "Certifications", icon: Award },
    { key: "inquiries", label: "Inquiries", icon: MessageSquare },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Portal Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-600/30">
            {profile?.company_name ? profile.company_name.charAt(0) : "S"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {profile?.company_name || "Supplier Operations Portal"}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Supplier
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Role: Supplier Exporter • Tenant Isolated Workspace
            </p>
          </div>
        </div>

        {/* Completeness Badge */}
        {profile && (
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <div className="text-xs">
              <span className="font-bold text-slate-800">
                Storefront Completeness: {profile.completeness_score}%
              </span>
              <span className="block text-[10px] text-slate-400">
                {profile.completeness_score >= 90
                  ? "Optimized for AI matching"
                  : "Improve profile to increase RFQs"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === "dashboard" && (
          <SupplierDashboardView
            metrics={metrics}
            isLoading={isLoading}
            onNavigateToProducts={() => handleTabChange("products")}
            onNavigateToProfile={() => handleTabChange("profile")}
          />
        )}

        {activeTab === "profile" && (
          <SupplierProfileEditorView
            profile={profile}
            isLoading={isLoading}
            onProfileUpdated={(updated) => setProfile(updated)}
          />
        )}

        {activeTab === "products" && (
          <SupplierProductsManagerView
            onRefreshMetrics={() => {
              supplierPortalApi.getMetrics().then(setMetrics).catch(console.error);
            }}
          />
        )}

        {activeTab === "capacity" && <SupplierCapacityView />}

        {activeTab === "certifications" && <SupplierCertificationsView />}

        {activeTab === "inquiries" && <SupplierInquiriesView />}
      </div>
    </div>
  );
};
