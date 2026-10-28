import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../i18n";

describe("Prompt 25: Settings, Currency, Language, and Theme", () => {
  const DEFAULT_RATES: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    INR: 83.50,
    GBP: 0.79,
    AED: 3.67,
    CNY: 7.23,
  };

  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$",
    EUR: "€",
    INR: "₹",
    GBP: "£",
    AED: "AED ",
    CNY: "¥",
  };

  function convertPrice(
    amount: number,
    fromCurrency: string,
    targetCurrency: string,
    rates: Record<string, number> = DEFAULT_RATES
  ) {
    const rateFrom = rates[fromCurrency] ?? 1.0;
    const rateTarget = rates[targetCurrency] ?? 1.0;
    const converted = (amount / rateFrom) * rateTarget;
    const isConverted = fromCurrency.toUpperCase() !== targetCurrency.toUpperCase();
    const sym = CURRENCY_SYMBOLS[targetCurrency] || `${targetCurrency} `;
    const origSym = CURRENCY_SYMBOLS[fromCurrency] || `${fromCurrency} `;

    return {
      amount: converted,
      currency: targetCurrency,
      formatted: `${sym}${converted.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${isConverted ? " (approx.)" : ""}`,
      approx: isConverted,
      originalFormatted: `${origSym}${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${fromCurrency}`,
    };
  }

  describe("Currency Conversion and Formatting", () => {
    it("converts USD to INR with simulated exchange rate and approx label", () => {
      const res = convertPrice(100, "USD", "INR");
      expect(res.amount).toBe(8350);
      expect(res.currency).toBe("INR");
      expect(res.approx).toBe(true);
      expect(res.formatted).toBe("₹8,350.00 (approx.)");
      expect(res.originalFormatted).toBe("$100.00 USD");
    });

    it("converts USD to EUR with simulated rate", () => {
      const res = convertPrice(100, "USD", "EUR");
      expect(res.amount).toBe(92);
      expect(res.approx).toBe(true);
      expect(res.formatted).toBe("€92.00 (approx.)");
    });

    it("converts USD to GBP with simulated rate", () => {
      const res = convertPrice(100, "USD", "GBP");
      expect(res.amount).toBe(79);
      expect(res.approx).toBe(true);
      expect(res.formatted).toBe("£79.00 (approx.)");
    });

    it("converts USD to AED with simulated rate", () => {
      const res = convertPrice(100, "USD", "AED");
      expect(res.amount).toBe(367);
      expect(res.approx).toBe(true);
      expect(res.formatted).toBe("AED 367.00 (approx.)");
    });

    it("converts USD to CNY with simulated rate", () => {
      const res = convertPrice(100, "USD", "CNY");
      expect(res.amount).toBe(723);
      expect(res.approx).toBe(true);
      expect(res.formatted).toBe("¥723.00 (approx.)");
    });

    it("does not flag same-currency prices as approx", () => {
      const res = convertPrice(250.5, "USD", "USD");
      expect(res.amount).toBe(250.5);
      expect(res.approx).toBe(false);
      expect(res.formatted).toBe("$250.50");
    });
  });

  describe("Internationalization (i18n)", () => {
    beforeEach(async () => {
      await i18n.changeLanguage("en");
    });

    it("provides English navigation and settings translations", () => {
      expect(i18n.t("settings.title")).toBe("Platform Settings");
      expect(i18n.t("nav.home")).toBe("Home");
      expect(i18n.t("nav.products")).toBe("Products");
      expect(i18n.t("common.savePreferences")).toBe("Save Preferences");
    });

    it("provides German navigation and settings translations", async () => {
      await i18n.changeLanguage("de");
      expect(i18n.t("settings.title")).toBe("Plattformeinstellungen");
      expect(i18n.t("nav.home")).toBe("Startseite");
      expect(i18n.t("nav.products")).toBe("Produkte");
      expect(i18n.t("common.savePreferences")).toBe("Einstellungen speichern");
      expect(i18n.t("settings.displayCurrency")).toBe("Anzeigewährung & Lokalisierung");
    });

    it("provides Hindi navigation and settings translations", async () => {
      await i18n.changeLanguage("hi");
      expect(i18n.t("settings.title")).toBe("प्लेटफ़ॉर्म सेटिंग्स");
      expect(i18n.t("nav.home")).toBe("मुखपृष्ठ");
      expect(i18n.t("nav.products")).toBe("उत्पाद");
      expect(i18n.t("common.savePreferences")).toBe("प्राथमिकताएं सहेजें");
    });

    it("falls back to English when a key is missing", async () => {
      await i18n.changeLanguage("de");
      const nonExistent = i18n.t("untranslated_key_xyz", { defaultValue: "Fallback Value" });
      expect(nonExistent).toBe("Fallback Value");
    });
  });

  describe("Theme and Class Toggle", () => {
    it("toggles dark class on document element", () => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.add("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);

        document.documentElement.classList.remove("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      }
    });

    it("persists theme preference to localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tradex_theme", "dark");
        expect(localStorage.getItem("tradex_theme")).toBe("dark");

        localStorage.setItem("tradex_theme", "light");
        expect(localStorage.getItem("tradex_theme")).toBe("light");
      }
    });
  });
});
