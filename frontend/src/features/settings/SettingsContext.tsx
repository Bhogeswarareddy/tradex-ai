import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { authApi, UserSettings } from "../../lib/api/auth";
import i18n from "../../i18n";

export type SupportedCurrency = "USD" | "EUR" | "INR" | "GBP" | "AED" | "CNY";
export type SupportedLanguage = "EN" | "DE" | "HI";
export type SupportedTheme = "light" | "dark";

export interface ConvertedPriceResult {
  amount: number;
  currency: string;
  formatted: string;
  approx: boolean;
  originalFormatted: string;
}

export interface SettingsContextType {
  currency: SupportedCurrency;
  language: SupportedLanguage;
  theme: SupportedTheme;
  notifications: Record<string, boolean>;
  exchangeRates: Record<string, number>;
  isLoaded: boolean;
  setCurrency: (c: SupportedCurrency) => Promise<void>;
  setLanguage: (l: SupportedLanguage) => Promise<void>;
  setTheme: (t: SupportedTheme) => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  saveSettings: (settings: UserSettings) => Promise<void>;
  resetSettings: () => Promise<void>;
  formatPrice: (amount: number | null | undefined, fromCurrency?: string) => ConvertedPriceResult;
}

const DEFAULT_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  INR: 83.50,
  GBP: 0.79,
  AED: 3.67,
  CNY: 7.23,
};

const DEFAULT_NOTIFICATIONS: Record<string, boolean> = {
  messages: true,
  rfq_updates: true,
  new_quotes: true,
  orders: true,
  shipments: true,
  document_verification: true,
  email_notifications: false,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  INR: "₹",
  GBP: "£",
  AED: "AED ",
  CNY: "¥",
};

const getInitialCurrency = (): SupportedCurrency => {
  if (typeof window !== "undefined") {
    const activeUser = localStorage.getItem("tradex_active_user_id");
    const userCurr = activeUser ? localStorage.getItem(`tradex_currency_${activeUser}`) : null;
    return (userCurr || localStorage.getItem("tradex_currency") || "USD") as SupportedCurrency;
  }
  return "USD";
};

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window !== "undefined") {
    const activeUser = localStorage.getItem("tradex_active_user_id");
    const userLang = activeUser ? localStorage.getItem(`tradex_language_${activeUser}`) : null;
    return (userLang || localStorage.getItem("tradex_language") || "EN") as SupportedLanguage;
  }
  return "EN";
};

const getInitialTheme = (): SupportedTheme => {
  if (typeof window !== "undefined") {
    const activeUser = localStorage.getItem("tradex_active_user_id");
    const userTheme = activeUser ? localStorage.getItem(`tradex_theme_${activeUser}`) : null;
    const stored = userTheme || localStorage.getItem("tradex_theme");
    if (stored === "dark" || stored === "light") return stored as SupportedTheme;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [currency, setCurrencyState] = useState<SupportedCurrency>(getInitialCurrency);
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);
  const [theme, setThemeState] = useState<SupportedTheme>(getInitialTheme);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(DEFAULT_NOTIFICATIONS);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Apply theme to DOM and CSS root variables
  const applyThemeToDOM = (th: SupportedTheme) => {
    if (typeof document !== "undefined") {
      const isDark = th === "dark";
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.setAttribute("data-theme", th);
      document.documentElement.style.colorScheme = th;
    }
  };

  const persistUserValues = useCallback((curr?: string, lang?: string, th?: string) => {
    if (typeof window === "undefined") return;
    if (user?.id) {
      localStorage.setItem("tradex_active_user_id", user.id);
      if (curr) localStorage.setItem(`tradex_currency_${user.id}`, curr);
      if (lang) localStorage.setItem(`tradex_language_${user.id}`, lang);
      if (th) localStorage.setItem(`tradex_theme_${user.id}`, th);
    }
    if (curr) localStorage.setItem("tradex_currency", curr);
    if (lang) localStorage.setItem("tradex_language", lang);
    if (th) localStorage.setItem("tradex_theme", th);
  }, [user]);

  // Fetch exchange rates from backend
  const loadExchangeRates = useCallback(async () => {
    try {
      const data = await authApi.getExchangeRates();
      if (data?.rates) {
        setExchangeRates((prev) => ({ ...prev, ...data.rates }));
      }
    } catch {
      // Use fallback defaults
    }
  }, []);

  // Fetch and reconcile settings when user mounts or changes (backend wins for signed-in user)
  useEffect(() => {
    loadExchangeRates();
    applyThemeToDOM(theme);
    i18n.changeLanguage(language.toLowerCase());

    const syncUserSettings = async () => {
      try {
        if (user) {
          localStorage.setItem("tradex_active_user_id", user.id);
          // Backend settings win for signed in user
          const s = (user.settings && Object.keys(user.settings).length > 0)
            ? user.settings
            : await authApi.getSettings();

          if (s.currency) {
            const curr = s.currency as SupportedCurrency;
            setCurrencyState(curr);
            persistUserValues(curr, undefined, undefined);
          }
          if (s.language) {
            const langUpper = s.language.toUpperCase() as SupportedLanguage;
            setLanguageState(langUpper);
            persistUserValues(undefined, langUpper, undefined);
            i18n.changeLanguage(langUpper.toLowerCase());
          }
          if (s.theme) {
            const th = s.theme as SupportedTheme;
            setThemeState(th);
            persistUserValues(undefined, undefined, th);
            applyThemeToDOM(th);
          }
          if (s.notifications) {
            setNotifications((prev) => ({ ...prev, ...s.notifications }));
          }
        } else {
          // Anonymous / guest mode
          applyThemeToDOM(theme);
          i18n.changeLanguage(language.toLowerCase());
        }
      } catch {
        // Fallback to local
      } finally {
        setIsLoaded(true);
      }
    };

    syncUserSettings();
  }, [user, loadExchangeRates, persistUserValues]);

  // Header selectors save immediately
  const setCurrency = async (newCurr: SupportedCurrency) => {
    setCurrencyState(newCurr);
    persistUserValues(newCurr, undefined, undefined);
    if (user) {
      try {
        await authApi.updateSettings({ currency: newCurr });
      } catch {
        // quiet error
      }
    }
  };

  const setLanguage = async (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    persistUserValues(undefined, newLang, undefined);
    i18n.changeLanguage(newLang.toLowerCase());
    if (user) {
      try {
        await authApi.updateSettings({ language: newLang });
      } catch {
        // quiet error
      }
    }
  };

  const setTheme = async (newTheme: SupportedTheme) => {
    setThemeState(newTheme);
    persistUserValues(undefined, undefined, newTheme);
    applyThemeToDOM(newTheme);
    if (user) {
      try {
        await authApi.updateSettings({ theme: newTheme });
      } catch {
        // quiet error
      }
    }
  };

  // Batch save for Settings Page
  const saveSettings = async (payload: UserSettings) => {
    let newCurr: SupportedCurrency | undefined;
    let newLang: SupportedLanguage | undefined;
    let newTheme: SupportedTheme | undefined;

    if (payload.currency) {
      newCurr = payload.currency as SupportedCurrency;
      setCurrencyState(newCurr);
    }
    if (payload.language) {
      newLang = payload.language.toUpperCase() as SupportedLanguage;
      setLanguageState(newLang);
      i18n.changeLanguage(newLang.toLowerCase());
    }
    if (payload.theme) {
      newTheme = payload.theme as SupportedTheme;
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
    }
    if (payload.notifications) {
      setNotifications((prev) => ({ ...prev, ...payload.notifications }));
    }

    persistUserValues(newCurr, newLang, newTheme);

    if (user) {
      await authApi.updateSettings(payload);
    }
  };

  const resetSettings = async () => {
    const defaults: UserSettings = {
      currency: "USD",
      language: "EN",
      theme: "light",
      notifications: DEFAULT_NOTIFICATIONS,
    };
    setCurrencyState("USD");
    setLanguageState("EN");
    i18n.changeLanguage("en");
    setThemeState("light");
    applyThemeToDOM("light");
    setNotifications(DEFAULT_NOTIFICATIONS);
    persistUserValues("USD", "EN", "light");

    if (user) {
      await authApi.updateSettings(defaults);
    }
  };

  const formatPrice = (
    rawAmount: number | null | undefined,
    fromCurrency = "USD"
  ): ConvertedPriceResult => {
    const amount = Number(rawAmount) || 0;
    const cleanFrom = (fromCurrency || "USD").toUpperCase();
    const cleanTarget = (currency || "USD").toUpperCase();

    const rateFrom = exchangeRates[cleanFrom] ?? 1.0;
    const rateTarget = exchangeRates[cleanTarget] ?? 1.0;

    // Convert: amount in USD = amount / rateFrom, amount in Target = (amount / rateFrom) * rateTarget
    const converted = (amount / rateFrom) * rateTarget;
    const isConverted = cleanFrom !== cleanTarget;

    const symTarget = CURRENCY_SYMBOLS[cleanTarget] || `${cleanTarget} `;
    const symFrom = CURRENCY_SYMBOLS[cleanFrom] || `${cleanFrom} `;

    const formattedTarget = `${symTarget}${converted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const formattedOrig = `${symFrom}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    return {
      amount: converted,
      currency: cleanTarget,
      formatted: isConverted ? `${formattedTarget} (approx.)` : formattedTarget,
      approx: isConverted,
      originalFormatted: `${formattedOrig} ${cleanFrom}`,
    };
  };

  return (
    <SettingsContext.Provider
      value={{
        currency,
        language,
        theme,
        notifications,
        exchangeRates,
        isLoaded,
        setCurrency,
        setLanguage,
        setTheme,
        setNotifications,
        saveSettings,
        resetSettings,
        formatPrice,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export const useCurrency = () => {
  const { currency, exchangeRates, formatPrice } = useSettings();
  return { currency, exchangeRates, formatPrice };
};
