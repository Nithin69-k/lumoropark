import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export type CheckoutItem = { priceId: string; quantity: number };

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  async function openCheckout(options: {
    items: CheckoutItem[];
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) {
    setLoading(true);
    try {
      await initializePaddle();
      const items = await Promise.all(
        options.items.map(async (i) => ({
          priceId: await getPaddlePriceId(i.priceId),
          quantity: i.quantity,
        })),
      );

      window.Paddle.Checkout.open({
        items,
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/bookings`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return { openCheckout, loading };
}
