/**
 * TradeX Enterprise Formatting Utilities (Prompt 28)
 * Robust null-safe, NaN-safe, Infinity-safe formatters.
 * Replaces unsafe .toLocaleString(), .toFixed(), new Date() across all UI components.
 */

export function isValidNumber(value: any): value is number {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "number" &&
    !Number.isNaN(value) &&
    Number.isFinite(value)
  );
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
  fallback: string = "Not available"
): string {
  if (!isValidNumber(value)) {
    return fallback;
  }
  try {
    return value.toLocaleString("en-US", options);
  } catch {
    return fallback;
  }
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string = "USD",
  fallback: string = "Not available"
): string {
  if (!isValidNumber(value)) {
    return fallback;
  }
  try {
    const symbolMap: Record<string, string> = {
      USD: "$",
      EUR: "€",
      INR: "₹",
      GBP: "£",
      AED: "AED ",
      CNY: "¥",
    };
    const sym = symbolMap[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
    const numPart = value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${sym}${numPart}`;
  } catch {
    return fallback;
  }
}

export function formatDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = "Not available"
): string {
  if (!value) {
    return fallback;
  }
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return fallback;
    }
    return d.toLocaleDateString("en-US", options ?? {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return fallback;
  }
}

export function formatPercent(
  value: number | null | undefined,
  decimals: number = 0,
  fallback: string = "Not available"
): string {
  if (!isValidNumber(value)) {
    return fallback;
  }
  try {
    return `${value.toFixed(decimals)}%`;
  } catch {
    return fallback;
  }
}
