import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id;
  });

export type CancelBookingResult = {
  status: string;
  paymentStatus: string;
  refundAmount: number;
  refundRequested: boolean;
};

/**
 * Cancels a booking under the host's cancellation policy and, when a refund is
 * owed, files the refund with the payment provider.
 */
export const cancelBookingWithRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; reason?: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<CancelBookingResult> => {
    const { data: row, error } = await context.supabase.rpc("cancel_booking", {
      p_booking_id: data.bookingId,
      p_reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);

    const booking = (Array.isArray(row) ? row[0] : row) as
      | {
          status: string;
          payment_status: string;
          refund_amount: number | string | null;
          paddle_transaction_id: string | null;
        }
      | null;

    const refundAmount = Number(booking?.refund_amount ?? 0);
    let refundRequested = false;

    if (refundAmount > 0 && booking?.paddle_transaction_id) {
      const res = await gatewayFetch(data.environment, "/adjustments", {
        method: "POST",
        body: JSON.stringify({
          action: "refund",
          transaction_id: booking.paddle_transaction_id,
          reason: data.reason?.slice(0, 200) || "Booking cancelled within the cancellation policy",
          type: "full",
        }),
      });
      if (!res.ok) {
        console.error("Refund request failed", await res.text());
      } else {
        refundRequested = true;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const payload = (await res.json()) as { data?: { id?: string } };
        await supabaseAdmin.rpc("mark_booking_refunded", {
          p_booking_id: data.bookingId,
          p_refund_id: payload.data?.id ?? undefined,
        });
      }
    }

    return {
      status: booking?.status ?? "cancelled",
      paymentStatus: booking?.payment_status ?? "unpaid",
      refundAmount,
      refundRequested,
    };
  });

/** Opens the payment provider's hosted portal so a subscriber can manage billing. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<string> => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.paddle_customer_id) throw new Error("No subscription found for your account");

    const paddle = getPaddleClient(data.environment);
    const session = await paddle.customerPortalSessions.create(sub.paddle_customer_id, [
      sub.paddle_subscription_id,
    ]);
    const url = session.urls?.general?.overview;
    if (!url) throw new Error("Could not open the billing portal");
    return url;
  });


/**
 * Switches an active Host Pro subscription between the monthly and yearly
 * plan, pro-rating the change immediately.
 */
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, status")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.paddle_subscription_id) throw new Error("No subscription found for your account");
    if (!["active", "trialing", "past_due"].includes(sub.status)) {
      throw new Error("Your plan must be active before you can switch it");
    }

    const priceRes = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const priceJson = (await priceRes.json()) as { data?: Array<{ id: string }> };
    const paddlePriceId = priceJson.data?.[0]?.id;
    if (!paddlePriceId) throw new Error("That plan is not available right now");

    const res = await gatewayFetch(
      data.environment,
      `/subscriptions/${sub.paddle_subscription_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          items: [{ price_id: paddlePriceId, quantity: 1 }],
          proration_billing_mode: "prorated_immediately",
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error("Plan change failed", detail);
      throw new Error("Could not switch your plan. Please try again or use the billing portal.");
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Custom-amount payments (any amount, in USD or INR)
 * ------------------------------------------------------------------ */

type CurrencyCode = "USD" | "INR";
const USD_TO_INR = 88;
const MIN_CHARGE: Record<CurrencyCode, number> = { USD: 0.7, INR: 60 };
const MAX_CHARGE: Record<CurrencyCode, number> = { USD: 10000, INR: 880000 };

/** Resolves the Paddle product a custom (non-catalog) price hangs off. */
async function resolveProductId(env: PaddleEnv, externalId: string): Promise<string> {
  const res = await gatewayFetch(env, `/products?external_id=${encodeURIComponent(externalId)}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  const id = json.data?.[0]?.id;
  if (!id) throw new Error("Payment catalog is not configured yet");
  return id;
}

async function createTransaction(input: {
  env: PaddleEnv;
  productId: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  customData: Record<string, string>;
  email?: string;
}): Promise<string> {
  const res = await gatewayFetch(input.env, "/transactions", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          quantity: 1,
          price: {
            description: input.description,
            name: input.description.slice(0, 50),
            product_id: input.productId,
            unit_price: {
              amount: String(Math.round(input.amount * 100)),
              currency_code: input.currency,
            },
            quantity: { minimum: 1, maximum: 1 },
          },
        },
      ],
      currency_code: input.currency,
      collection_mode: "automatic",
      custom_data: input.customData,
    }),
  });
  if (!res.ok) {
    console.error("Could not create transaction", await res.text());
    throw new Error("Could not start the payment. Please try again.");
  }
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) throw new Error("Could not start the payment. Please try again.");
  return json.data.id;
}

/**
 * Prices a booking server-side and opens it as a single custom-amount Paddle
 * transaction in the driver's currency. The amount is always derived from the
 * database — never from the browser.
 */
export const createBookingCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; currency: CurrencyCode; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<{ transactionId: string; amount: number; currency: CurrencyCode }> => {
    const currency: CurrencyCode = data.currency === "INR" ? "INR" : "USD";

    const { data: quote, error } = await context.supabase.rpc("get_booking_charge", {
      p_booking_id: data.bookingId,
      p_env: data.environment,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(quote) ? quote[0] : quote) as { total: number | string } | null;
    if (!row) throw new Error("Could not price this booking");

    const usdTotal = Number(row.total);
    const amount = Math.round((currency === "INR" ? usdTotal * USD_TO_INR : usdTotal) * 100) / 100;
    if (!(amount >= MIN_CHARGE[currency]) || amount > MAX_CHARGE[currency]) {
      throw new Error("This booking amount cannot be charged online.");
    }

    const productId = await resolveProductId(data.environment, "wallet_topup");
    const transactionId = await createTransaction({
      env: data.environment,
      productId,
      description: "LumoroX Park reservation",
      amount,
      currency,
      customData: { bookingId: data.bookingId, userId: context.userId },
    });
    return { transactionId, amount, currency };
  });

/**
 * Opens a payment for any amount the driver chooses (parking credit top-up),
 * in either supported currency.
 */
export const createCustomCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number; currency: CurrencyCode; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<{ transactionId: string }> => {
    const currency: CurrencyCode = data.currency === "INR" ? "INR" : "USD";
    const amount = Math.round(Number(data.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < MIN_CHARGE[currency] || amount > MAX_CHARGE[currency]) {
      throw new Error(
        `Enter an amount between ${MIN_CHARGE[currency]} and ${MAX_CHARGE[currency]} ${currency}.`,
      );
    }

    const productId = await resolveProductId(data.environment, "wallet_topup");
    const transactionId = await createTransaction({
      env: data.environment,
      productId,
      description: "LumoroX Park parking credit",
      amount,
      currency,
      customData: { userId: context.userId, kind: "topup" },
    });
    return { transactionId };
  });
