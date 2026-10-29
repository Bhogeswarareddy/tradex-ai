import { describe, it, expect } from "vitest";
import { formatNumber, formatCurrency, formatDate, formatPercent, isValidNumber } from "../lib/format";

describe("TradeX Enterprise Formatting Library (Prompt 28)", () => {
  describe("isValidNumber", () => {
    it("returns true for valid finite numbers", () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-15.5)).toBe(true);
    });

    it("returns false for null, undefined, NaN, and Infinity", () => {
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
      expect(isValidNumber("123" as any)).toBe(false);
    });
  });

  describe("formatNumber", () => {
    it("formats valid numbers with commas", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(2500000)).toBe("2,500,000");
      expect(formatNumber(0)).toBe("0");
    });

    it("returns 'Not available' for null, undefined, and NaN", () => {
      expect(formatNumber(null)).toBe("Not available");
      expect(formatNumber(undefined)).toBe("Not available");
      expect(formatNumber(NaN)).toBe("Not available");
      expect(formatNumber(Infinity)).toBe("Not available");
    });

    it("supports custom fallback strings", () => {
      expect(formatNumber(null, undefined, "N/A")).toBe("N/A");
      expect(formatNumber(undefined, undefined, "Unconfirmed")).toBe("Unconfirmed");
    });
  });

  describe("formatCurrency", () => {
    it("formats standard USD currency with 2 decimal places", () => {
      expect(formatCurrency(450.5)).toBe("$450.50");
      expect(formatCurrency(1200)).toBe("$1,200.00");
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("formats EUR, INR, GBP, and AED", () => {
      expect(formatCurrency(100, "EUR")).toBe("€100.00");
      expect(formatCurrency(5000, "INR")).toBe("₹5,000.00");
      expect(formatCurrency(75, "GBP")).toBe("£75.00");
      expect(formatCurrency(350, "AED")).toBe("AED 350.00");
    });

    it("returns 'Not available' on null, undefined, NaN, or Infinity", () => {
      expect(formatCurrency(null)).toBe("Not available");
      expect(formatCurrency(undefined)).toBe("Not available");
      expect(formatCurrency(NaN)).toBe("Not available");
      expect(formatCurrency(Infinity)).toBe("Not available");
    });
  });

  describe("formatDate", () => {
    it("formats ISO date strings and Date objects", () => {
      const d = new Date("2026-10-14T10:00:00Z");
      expect(formatDate(d)).toContain("2026");
      expect(formatDate("2026-05-20")).toContain("2026");
    });

    it("returns 'Not available' for null, undefined, and invalid date strings", () => {
      expect(formatDate(null)).toBe("Not available");
      expect(formatDate(undefined)).toBe("Not available");
      expect(formatDate("invalid-date-string")).toBe("Not available");
    });
  });

  describe("formatPercent", () => {
    it("formats percentages with specified decimals", () => {
      expect(formatPercent(98.45, 1)).toBe("98.5%");
      expect(formatPercent(100, 0)).toBe("100%");
      expect(formatPercent(0)).toBe("0%");
    });

    it("returns 'Not available' for null and NaN", () => {
      expect(formatPercent(null)).toBe("Not available");
      expect(formatPercent(undefined)).toBe("Not available");
      expect(formatPercent(NaN)).toBe("Not available");
    });
  });
});
