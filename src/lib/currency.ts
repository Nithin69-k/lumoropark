/**
 * Currency support for LumoroX Park.
 *
 * Prices are authored in USD. A driver can pay in US dollars or Indian rupees;
 * the choice is detected from the browser on first visit and can be changed at
 * any time from the footer switcher. The chosen currency is passed to the
 * server, which builds the payment in that currency — the amount shown is the
 * amount charged.
 */

export type CurrencyCode = "USD" | "INR";

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["USD", "INR"];

/**
 * USD -> INR conversion used for display and charging. Kept as a constant so a
 * quote can never drift from the amount charged mid-checkout; update it when
 * you review pricing.
 */
export const USD_TO_INR = 88;

const STORAGE_KEY = "lumorox_currency";

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === "USD" || value === "INR";
}

/** Best guess from the browser locale / timezone. Falls back to USD. */
export function detectCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "INR";
    const locales = [navigator.language, ...(navigator.languages ?? [])];
    if (locales.some((l) => /(-|_)IN$/i.test(l ?? ""))) return "INR";
  } catch {
    /* locale APIs unavailable — keep the default */
  }
  return "USD";
}

/** The currency the visitor is browsing in (stored choice, else detected). */
export function getCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isCurrencyCode(stored) ? stored : detectCurrency();
}

export function setCurrency(code: CurrencyCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent("lumorox:currency", { detail: code }));
}

/** Converts a USD amount into `code`, rounded to the currency's precision. */
export function convertFromUsd(usdAmount: number, code: CurrencyCode): number {
  if (code === "USD") return Math.round(usdAmount * 100) / 100;
  return Math.round(usdAmount * USD_TO_INR * 100) / 100;
}

export function formatMoney(amount: number, code: CurrencyCode): string {
  try {
    return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code === "INR" ? "₹" : "$"}${amount.toFixed(2)}`;
  }
}

/** Formats a USD-denominated price in the visitor's currency. */
export function formatUsd(usdAmount: number, code: CurrencyCode): string {
  return formatMoney(convertFromUsd(usdAmount, code), code);
}

/** Smallest allowed payment, per currency (Paddle enforces a minimum). */
export const MIN_CHARGE: Record<CurrencyCode, number> = { USD: 0.7, INR: 60 };
