/**
 * Currency display for LumoroX Park.
 *
 * Listing prices are authored in US dollars in the database; drivers are
 * charged in Indian rupees through Razorpay at the fixed rate in
 * `@/lib/pricing`, so the amount shown is always the amount charged.
 */
import { INR_PER_USD, MIN_CHARGE_INR } from "@/lib/pricing";

export { INR_PER_USD, MIN_CHARGE_INR };

/** Converts a USD-denominated price into rupees. */
export function usdToInr(usdAmount: number): number {
  return Math.round(usdAmount * INR_PER_USD * 100) / 100;
}

/** Formats a rupee amount, e.g. ₹1,672.00 */
export function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
}

/** Formats a USD-denominated price in rupees. */
export function formatUsdAsInr(usdAmount: number): string {
  return formatInr(usdToInr(usdAmount));
}
