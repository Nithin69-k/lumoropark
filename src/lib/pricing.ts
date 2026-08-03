/**
 * Money rules for LumoroX Park.
 *
 * Listing prices live in the database in US dollars; customers are charged in
 * Indian rupees through Razorpay, using the fixed rate below so a displayed
 * quote can never drift from the amount charged mid-checkout.
 */

export const INR_PER_USD = 88;

/** Smallest and largest online payment, in rupees. */
export const MIN_CHARGE_INR = 60;
export const MAX_CHARGE_INR = 880000;

export type ProPlanKey = "host_pro_monthly" | "host_pro_yearly";

export const PRO_PLANS: Record<
  ProPlanKey,
  { name: string; amountInr: number; period: "monthly" | "yearly" }
> = {
  host_pro_monthly: { name: "Host Pro (monthly)", amountInr: 19 * INR_PER_USD, period: "monthly" },
  host_pro_yearly: { name: "Host Pro (yearly)", amountInr: 190 * INR_PER_USD, period: "yearly" },
};
