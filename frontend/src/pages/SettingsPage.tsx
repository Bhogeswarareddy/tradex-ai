import React, { useState, useEffect } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { authApi, UserSettings, SessionItem } from "../lib/api/auth";
import {
  Palette,
  RotateCcw,
  Save,
  Lock,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { Link } from "react-router-dom";

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError, info } = useToast();

  // Settings state
  const [notifications, setNotifications] = useState({
    messages: true,
    rfq_updates: true,
    new_quotes: true,
    orders: true,
    shipments: true,
    document_verification: true,
    email_notifications: false,
  });
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("EN");
  const [theme, setTheme] = useState("light");

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Operation states
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Load user settings on mount
  useEffect(() => {
    const init = async () => {
      try {
        const s = await authApi.getSettings();
        if (s.notifications) {
          setNotifications((prev) => ({ ...prev, ...s.notifications }));
        }
        if (s.currency) setCurrency(s.currency);
        if (s.language) setLanguage(s.language);
        if (s.theme) {
          setTheme(s.theme);
          applyTheme(s.theme);
        }
      } catch {
        // Fallback to user.settings if available
        if (user?.settings) {
          if (user.settings.notifications) setNotifications((prev) => ({ ...prev, ...user.settings?.notifications }));
          if (user.settings.currency) setCurrency(user.settings.currency);
          if (user.settings.language) setLanguage(user.settings.language);
          if (user.settings.theme) {
            setTheme(user.settings.theme);
            applyTheme(user.settings.theme);
          }
        }
      }
    };
    init();
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await authApi.listSessions();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const applyTheme = (th: string) => {
    if (typeof document !== "undefined") {
      if (th === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const handleToggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleThemeChange = (th: string) => {
    setTheme(th);
    applyTheme(th);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const payload: UserSettings = {
        notifications,
        currency,
        language,
        theme,
      };
      await authApi.updateSettings(payload);
      if (refreshUser) await refreshUser();
      success("Settings Saved", "Your workspace and notification preferences have been saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toastError("Save Failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async () => {
    const defaultNotifs = {
      messages: true,
      rfq_updates: true,
      new_quotes: true,
      orders: true,
      shipments: true,
      document_verification: true,
      email_notifications: false,
    };
    const defaults: UserSettings = {
      notifications: defaultNotifs,
      currency: "USD",
      language: "EN",
      theme: "light",
    };
    setNotifications(defaultNotifs);
    setCurrency("USD");
    setLanguage("EN");
    setTheme("light");
    applyTheme("light");

    try {
      await authApi.updateSettings(defaults);
      if (refreshUser) await refreshUser();
      success("Preferences Reset", "All platform settings restored to system defaults.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset settings";
      toastError("Reset Failed", msg);
    } finally {
      setResetDialogOpen(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      info("Session Revoked", "The selected session refresh token was invalidated.");
      fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke session";
      toastError("Revocation Failed", msg);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your alerts, display currency, theme appearance, and active security sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            className="gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveSettings}
            isLoading={saving}
            className="gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Notification Preferences */}
        <Card
          title="Notification Preferences"
          description="Control real-time and email dispatches for trade activity"
          className="shadow-sm"
        >
          <div className="space-y-3.5 pt-2">
            {[
              { key: "messages", label: "Direct Messages & Counter-offers", desc: "Negotiation threads and buyer/supplier inquiries" },
              { key: "rfq_updates", label: "RFQ Updates & Closures", desc: "Status changes on your submitted or bookmarked RFQs" },
              { key: "new_quotes", label: "New Quotations Received", desc: "Instant alert when a supplier submits a quotation" },
              { key: "orders", label: "Order & Payment Milestones", desc: "PO confirmations, escrow updates, and fund clearances" },
              { key: "shipments", label: "Shipment Tracking & Port Arrivals", desc: "Vessel position reports and delivery status alerts" },
              { key: "document_verification", label: "Document Verification", desc: "OCR validation completion and compliance reviews" },
              { key: "email_notifications", label: "Email Dispatches (Configured)", desc: "Send digest email notifications when offline" },
            ].map(({ key, label, desc }) => {
              const active = (notifications as any)[key];
              return (
                <div
                  key={key}
                  onClick={() => handleToggleNotification(key as any)}
                  className="flex items-start justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-xs font-semibold text-slate-800">{label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-[#2563EB] mt-0.5 shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Section 2: Regional & Appearance */}
        <div className="space-y-6">
          <Card
            title="Display Currency & Localization"
            description="All platform catalogs and landed cost pricing will convert automatically"
            className="shadow-sm"
          >
            <div className="space-y-4 pt-2">
              <Select
                label="Display Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: "USD", label: "USD ($) - United States Dollar (Base)" },
                  { value: "EUR", label: "EUR (€) - Euro (Simulated 0.92 EUR/USD)" },
                  { value: "INR", label: "INR (₹) - Indian Rupee (Simulated 83.50 INR/USD)" },
                  { value: "GBP", label: "GBP (£) - British Pound (Simulated 0.79 GBP/USD)" },
                ]}
              />

              <Select
                label="System Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={[
                  { value: "EN", label: "English (US / International Standard)" },
                  { value: "DE", label: "German (Speisekammer Corridor Standard)" },
                  { value: "HI", label: "Hindi (Indian Export Corridor)" },
                ]}
              />

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Simulated Exchange Rates:</strong> Non-USD currencies calculate automated conversions using reference commodity exchange rates.
              </div>
            </div>
          </Card>

          <Card
            title="Appearance & Theme"
            description="Select interface theme contrast"
            className="shadow-sm"
          >
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "light"
                    ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-xs mb-2 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <p className="text-xs font-bold text-slate-900">Light Navy</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Classic clean interface</p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "dark"
                    ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[#0A1230] text-white shadow-xs mb-2 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs font-bold text-slate-900">Dark Navy</p>
                <p className="text-[11px] text-slate-500 mt-0.5">High contrast dark scheme</p>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Section 3: Security & Active Sessions */}
      <Card
        title="Security & Active Sessions"
        description="Monitor authorized browser sessions and revoke tokens"
        className="shadow-sm"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Account Password</p>
                <p className="text-[11px] text-slate-500">Ensure password uses 10+ characters with digits</p>
              </div>
            </div>
            <Link to="/profile">
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </Link>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Authorized Device Sessions
            </h4>
            {loadingSessions ? (
              <p className="text-xs text-slate-400">Loading active sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-500">Current browser is the only active session.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-3.5 flex items-center justify-between bg-white text-xs">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{sess.client_name}</span>
                          {sess.is_current && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                              CURRENT
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Session ID: {sess.id.slice(0, 8)}... • Logged in: {sess.created_at?.split("T")[0] || "Active"}
                        </span>
                      </div>
                    </div>
                    {!sess.is_current && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded"
                        title="Revoke session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={resetDialogOpen}
        title="Reset Platform Preferences?"
        message="This will restore all notification toggles, display currency, language, and theme to system defaults."
        confirmLabel="Reset Defaults"
        variant="warning"
        onConfirm={handleResetSettings}
        onCancel={() => setResetDialogOpen(false)}
      />
    </div>
  );
};
