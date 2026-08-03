/**
 * Browser-side Razorpay Standard Checkout helpers.
 *
 * Only the publishable key id is exposed here — the key secret lives on the
 * server and is never bundled.
 */

const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

export function getRazorpayKeyId(): string | undefined {
  return keyId;
}

/** Which Razorpay account the app is talking to, from the key prefix. */
export function getPaymentEnvironment(): "sandbox" | "live" {
  return keyId?.startsWith("rzp_test_") ? "sandbox" : "live";
}

let scriptPromise: Promise<void> | null = null;

/** Loads checkout.js once and resolves when `window.Razorpay` is ready. */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment window. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Brand shown inside the Razorpay modal. */
export const CHECKOUT_BRAND = {
  name: "LumoroX Park",
  theme: { color: "#2563eb" },
};

/** Flat reservation fee charged to the driver on every booking, in dollars. */
export const RESERVATION_FEE = 1;
/** Platform commission taken from every booking. */
export const PLATFORM_COMMISSION_RATE = 0.1;
/** Minimum available balance before a host can be paid out. */
export const MIN_PAYOUT_AMOUNT = 20;
