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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Get initial values from localStorage or system
  const initialCurrency = ((typeof window !== "undefined" && localStorage.getItem("tradex_currency")) || "USD") as SupportedCurrency;
  const initialLanguage = ((typeof window !== "undefined" && localStorage.getItem("tradex_language")) || "EN") as SupportedLanguage;
  
  const getSystemTheme = (): SupportedTheme => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tradex_theme");
      if (stored === "dark" || stored === "light") return stored as SupportedTheme;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  };

  const [currency, setCurrencyState] = useState<SupportedCurrency>(initialCurrency);
  const [language, setLanguageState] = useState<SupportedLanguage>(initialLanguage);
  const [theme, setThemeState] = useState<SupportedTheme>(getSystemTheme);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(DEFAULT_NOTIFICATIONS);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Apply theme to DOM
  const applyThemeToDOM = (th: SupportedTheme) => {
    if (typeof document !== "undefined") {
      if (th === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

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

  // Fetch settings when user mounts or changes
  useEffect(() => {
    loadExchangeRates();
    applyThemeToDOM(theme);
    i18n.changeLanguage(language.toLowerCase());

    const syncUserSettings = async () => {
      try {
        if (user) {
          const s = await authApi.getSettings();
          if (s.currency) {
            setCurrencyState(s.currency as SupportedCurrency);
            localStorage.setItem("tradex_currency", s.currency);
          }
          if (s.language) {
            const langUpper = s.language.toUpperCase() as SupportedLanguage;
            setLanguageState(langUpper);
            localStorage.setItem("tradex_language", langUpper);
            i18n.changeLanguage(langUpper.toLowerCase());
          }
          if (s.theme) {
            const th = s.theme as SupportedTheme;
            setThemeState(th);
            localStorage.setItem("tradex_theme", th);
            applyThemeToDOM(th);
          }
          if (s.notifications) {
            setNotifications((prev) => ({ ...prev, ...s.notifications }));
          }
        }
      } catch {
        // Fallback to local
      } finally {
        setIsLoaded(true);
      }
    };

    syncUserSettings();
  }, [user, loadExchangeRates]);

  const setCurrency = async (newCurr: SupportedCurrency) => {
    setCurrencyState(newCurr);
    if (typeof window !== "undefined") {
      localStorage.setItem("tradex_currency", newCurr);
    }
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
    if (typeof window !== "undefined") {
      localStorage.setItem("tradex_language", newLang);
    }
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
    if (typeof window !== "undefined") {
      localStorage.setItem("tradex_theme", newTheme);
    }
    applyThemeToDOM(newTheme);
    if (user) {
      try {
        await authApi.updateSettings({ theme: newTheme });
      } catch {
        // quiet error
      }
    }
  };

  const saveSettings = async (payload: UserSettings) => {
    if (payload.currency) {
      setCurrencyState(payload.currency as SupportedCurrency);
      localStorage.setItem("tradex_currency", payload.currency);
    }
    if (payload.language) {
      const l = payload.language.toUpperCase() as SupportedLanguage;
      setLanguageState(l);
      localStorage.setItem("tradex_language", l);
      i18n.changeLanguage(l.toLowerCase());
    }
    if (payload.theme) {
      const th = payload.theme as SupportedTheme;
      setThemeState(th);
      localStorage.setItem("tradex_theme", th);
      applyThemeToDOM(th);
    }
    if (payload.notifications) {
      setNotifications((prev) => ({ ...prev, ...payload.notifications }));
    }

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
    localStorage.setItem("tradex_currency", "USD");
    setLanguageState("EN");
    localStorage.setItem("tradex_language", "EN");
    i18n.changeLanguage("en");
    setThemeState("light");
    localStorage.setItem("tradex_theme", "light");
    applyThemeToDOM("light");
    setNotifications(DEFAULT_NOTIFICATIONS);

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
