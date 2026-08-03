import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export type CheckoutItem = { priceId: string; quantity: number };

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  async function openCheckout(options: {
    /** Catalog items. Ignored when `transactionId` is supplied. */
    items?: CheckoutItem[];
    /** A server-created transaction (used for custom amounts / currencies). */
    transactionId?: string;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) {
    setLoading(true);
    try {
      await initializePaddle();

      const settings = {
        displayMode: "overlay" as const,
        successUrl: options.successUrl || `${window.location.origin}/bookings`,
        allowLogout: false,
        variant: "one-page" as const,
      };

      if (options.transactionId) {
        window.Paddle.Checkout.open({
          transactionId: options.transactionId,
          customer: options.customerEmail ? { email: options.customerEmail } : undefined,
          settings,
        });
        return;
      }

      const items = await Promise.all(
        (options.items ?? []).map(async (i) => ({
          priceId: await getPaddlePriceId(i.priceId),
          quantity: i.quantity,
        })),
      );

      window.Paddle.Checkout.open({
        items,
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings,
      });
    } finally {
      setLoading(false);
    }
  }

  return { openCheckout, loading };
}
