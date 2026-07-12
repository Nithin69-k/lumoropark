import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  /** Amount in paise (minimum 100 = ₹1). */
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess?: (r: RazorpayResponse) => void;
}

export function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  name = "LumoroX Park",
  description = "Payment",
  prefill,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) throw new Error("Failed to load Razorpay SDK");

      const orderRes = await fetch("/api/public/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Order creation failed");

      const rzp = new window.Razorpay!({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name,
        description,
        order_id: order.order_id,
        prefill,
        handler: async (response: RazorpayResponse) => {
          try {
            const verifyRes = await fetch("/api/public/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const result = await verifyRes.json();
            if (verifyRes.ok && result.success) {
              toast.success("Payment verified");
              onSuccess?.(response);
            } else {
              toast.error(result.error || "Payment verification failed");
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification error");
          }
        },
        modal: {
          ondismiss: () => toast.message("Payment cancelled"),
        },
      });

      // @ts-expect-error - runtime event API
      rzp.on?.("payment.failed", (resp: { error?: { description?: string } }) => {
        toast.error(resp?.error?.description || "Payment failed");
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading}>
      {loading ? "Loading…" : `Pay ₹${(amount / 100).toFixed(2)}`}
    </Button>
  );
}
