import { useState } from "react";
import { loadRazorpayScript, CHECKOUT_BRAND } from "@/lib/razorpay";

export type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
};

type OpenOptions = {
  keyId: string;
  /** One-off payment. */
  orderId?: string;
  /** Recurring plan. */
  subscriptionId?: string;
  amount?: number;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  onSuccess: (response: CheckoutSuccess) => void | Promise<void>;
  onDismiss?: () => void;
  onFailure?: (message: string) => void;
};

/** Opens Razorpay Standard Checkout and reports the outcome back. */
export function useRazorpayCheckout() {
  const [loading, setLoading] = useState(false);

  async function openCheckout(options: OpenOptions) {
    setLoading(true);
    try {
      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: options.keyId,
        ...CHECKOUT_BRAND,
        description: options.description,
        ...(options.orderId ? { order_id: options.orderId, amount: options.amount } : {}),
        ...(options.subscriptionId ? { subscription_id: options.subscriptionId } : {}),
        currency: "INR",
        prefill: options.prefill,
        notes: options.notes,
        retry: { enabled: false },
        handler: (response: CheckoutSuccess) => {
          void options.onSuccess(response);
        },
        modal: {
          ondismiss: () => options.onDismiss?.(),
        },
      });

      rzp.on("payment.failed", (event: { error?: { description?: string } }) => {
        options.onFailure?.(
          event.error?.description || "The payment failed. No money was taken — please try again.",
        );
      });

      rzp.open();
    } finally {
      setLoading(false);
    }
  }

  return { openCheckout, loading };
}
