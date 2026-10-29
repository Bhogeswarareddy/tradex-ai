import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth/AuthContext";
import {
  useSettings,
  SupportedCurrency,
  SupportedLanguage,
  SupportedTheme,
} from "../features/settings/SettingsContext";
import { authApi, SessionItem, UserSettings } from "../lib/api/auth";
import {
  Palette,
  RotateCcw,
  Save,
  Lock,
  Smartphone,
  Trash2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useToast } from "../components/ui/Toast";

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const {
    currency: savedCurrency,
    language: savedLanguage,
    theme: savedTheme,
    notifications: savedNotifications,
    saveSettings,
    resetSettings,
  } = useSettings();

  // Local draft state for form editing
  const [currency, setCurrency] = useState<SupportedCurrency>(savedCurrency);
  const [language, setLanguage] = useState<SupportedLanguage>(savedLanguage);
  const [theme, setTheme] = useState<SupportedTheme>(savedTheme);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(savedNotifications);

  // Sync draft state whenever saved context updates
  useEffect(() => {
    setCurrency(savedCurrency);
    setLanguage(savedLanguage);
    setTheme(savedTheme);
    setNotifications(savedNotifications);
  }, [savedCurrency, savedLanguage, savedTheme, savedNotifications]);

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (currency !== savedCurrency) return true;
    if (language !== savedLanguage) return true;
    if (theme !== savedTheme) return true;
    for (const key of Object.keys(notifications)) {
      if (notifications[key] !== savedNotifications[key]) return true;
    }
    return false;
  }, [currency, savedCurrency, language, savedLanguage, theme, savedTheme, notifications, savedNotifications]);

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Operation states
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Password Modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await authApi.listSessions();
      setSessions(data);
    } catch {
      // quiet fallback
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleToggleNotification = (key: string) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
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
      await saveSettings(payload);
      success(t("common.success"), t("settings.preferencesSaved"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toastError(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      await resetSettings();
      success(t("common.success"), t("settings.preferencesReset"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset settings";
      toastError(t("common.error"), msg);
    } finally {
      setResetDialogOpen(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      info(t("settings.revoke"), "Session refresh token was revoked.");
      fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke session";
      toastError(t("common.error"), msg);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 10 || !/\d/.test(newPassword)) {
      setPasswordError(t("auth.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("auth.passwordMismatch"));
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordModalOpen(false);
      success(t("common.success"), t("auth.passwordChangedSuccess"));
      fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      setPasswordError(msg);
      toastError(t("common.error"), msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("settings.subtitle")}
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
            <span>{t("common.resetDefaults")}</span>
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
            <span>{t("common.savePreferences")}</span>
          </Button>
        </div>
      </div>

      {/* Unsaved changes indicator banner */}
      {isDirty && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t("common.unsavedChanges")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrency(savedCurrency);
                setLanguage(savedLanguage);
                setTheme(savedTheme);
                setNotifications(savedNotifications);
              }}
              className="text-xs text-amber-800 dark:text-amber-300 hover:underline px-2 py-1"
            >
              {t("common.cancel")}
            </button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveSettings}
              isLoading={saving}
              className="h-7 text-xs px-3"
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Notification Preferences */}
        <Card
          title={t("settings.notificationPreferences")}
          description={t("settings.notificationPreferencesDesc")}
          className="shadow-sm"
        >
          <div className="space-y-3 pt-2">
            {[
              {
                key: "messages",
                label: t("settings.notifMessages"),
                desc: t("settings.notifMessagesDesc"),
              },
              {
                key: "rfq_updates",
                label: t("settings.notifRfqUpdates"),
                desc: t("settings.notifRfqUpdatesDesc"),
              },
              {
                key: "new_quotes",
                label: t("settings.notifNewQuotes"),
                desc: t("settings.notifNewQuotesDesc"),
              },
              {
                key: "orders",
                label: t("settings.notifOrders"),
                desc: t("settings.notifOrdersDesc"),
              },
              {
                key: "shipments",
                label: t("settings.notifShipments"),
                desc: t("settings.notifShipmentsDesc"),
              },
              {
                key: "document_verification",
                label: t("settings.notifDocVerify"),
                desc: t("settings.notifDocVerifyDesc"),
              },
              {
                key: "email_notifications",
                label: t("settings.notifEmail"),
                desc: t("settings.notifEmailDesc"),
                isEmail: true,
              },
            ].map(({ key, label, desc, isEmail }) => {
              const active = !!notifications[key];
              return (
                <div
                  key={key}
                  onClick={() => handleToggleNotification(key)}
                  className="flex items-start justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {desc}
                    </p>
                    {isEmail && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        {t("settings.emailDisabledNotice")}
                      </p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-[#2563EB] border-slate-300 dark:border-slate-700 focus:ring-[#2563EB] mt-0.5 shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Section 2: Regional & Appearance */}
        <div className="space-y-6">
          <Card
            title={t("settings.displayCurrency")}
            description={t("settings.displayCurrencyDesc")}
            className="shadow-sm"
          >
            <div className="space-y-4 pt-2">
              <Select
                label={t("settings.currencySelect")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                options={[
                  { value: "USD", label: "USD ($) - United States Dollar (Base)" },
                  { value: "EUR", label: "EUR (€) - Euro (Simulated 0.92 EUR/USD)" },
                  { value: "INR", label: "INR (₹) - Indian Rupee (Simulated 83.50 INR/USD)" },
                  { value: "GBP", label: "GBP (£) - British Pound (Simulated 0.79 GBP/USD)" },
                  { value: "AED", label: "AED (AED) - UAE Dirham (Simulated 3.67 AED/USD)" },
                  { value: "CNY", label: "CNY (¥) - Chinese Yuan (Simulated 7.23 CNY/USD)" },
                ]}
              />

              <Select
                label={t("settings.systemLanguage")}
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                options={[
                  { value: "EN", label: "English (EN)" },
                  { value: "DE", label: "Deutsch / German (DE)" },
                  { value: "HI", label: "हिन्दी / Hindi (HI)" },
                ]}
              />

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <strong>Simulated Exchange Rates:</strong> {t("common.simulatedNotice")}
              </div>
            </div>
          </Card>

          <Card
            title={t("settings.appearanceTheme")}
            description={t("settings.appearanceThemeDesc")}
            className="shadow-sm"
          >
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "light"
                    ? "border-[#2563EB] bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-[#2563EB]/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-xs mb-2 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t("settings.lightTheme")}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("settings.lightThemeDesc")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  theme === "dark"
                    ? "border-[#2563EB] bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-[#2563EB]/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[#0A1230] text-white shadow-xs mb-2 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t("settings.darkTheme")}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("settings.darkThemeDesc")}
                </p>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Section 3: Security & Active Sessions */}
      <Card
        title={t("settings.securitySessions")}
        description={t("settings.securitySessionsDesc")}
        className="shadow-sm"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t("settings.accountPassword")}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("settings.passwordGuidance")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasswordModalOpen(true)}
              className="gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{t("settings.changePassword")}</span>
            </Button>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              {t("settings.authorizedSessions")}
            </h4>
            {loadingSessions ? (
              <p className="text-xs text-slate-400">{t("common.loading")}</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current browser is the only active session.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3.5 flex items-center justify-between bg-white dark:bg-slate-900 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {sess.client_name}
                          </span>
                          {sess.is_current && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                              {t("settings.currentSession")}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          ID: {sess.id.slice(0, 8)}... • Logged in:{" "}
                          {sess.created_at?.split("T")[0] || "Active"}
                        </span>
                      </div>
                    </div>
                    {!sess.is_current && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded"
                        title={t("settings.revoke")}
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

      {/* Change Password Modal */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordError(null);
        }}
        title={t("settings.changePassword")}
        maxWidth="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            type="password"
            label={t("auth.currentPassword")}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            type="password"
            label={t("auth.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helper={t("settings.passwordGuidance")}
            required
            autoComplete="new-password"
          />
          <Input
            type="password"
            label={t("auth.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {passwordError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{passwordError}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordModalOpen(false);
                setPasswordError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={passwordSaving}
            >
              {t("settings.changePassword")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={resetDialogOpen}
        title={t("settings.resetDialogTitle")}
        message={t("settings.resetDialogMessage")}
        confirmLabel={t("common.resetDefaults")}
        cancelLabel={t("common.cancel")}
        variant="warning"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetDialogOpen(false)}
      />
    </div>
  );
};
