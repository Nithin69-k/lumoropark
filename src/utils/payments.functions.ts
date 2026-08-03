import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getKeyId,
  getPaymentEnv,
  rzpFetch,
  rzpJson,
  toPaise,
  verifyPaymentSignature,
  verifySubscriptionSignature,
} from "@/lib/razorpay.server";
import { INR_PER_USD, MIN_CHARGE_INR, MAX_CHARGE_INR, PRO_PLANS, type ProPlanKey } from "@/lib/pricing";

type RzpOrder = { id: string; amount: number; currency: string };

export type CheckoutOrder = {
  keyId: string;
  orderId: string;
  /** Amount in paise, exactly what Razorpay will charge. */
  amount: number;
  currency: "INR";
};

function usdToInr(usd: number): number {
  return Math.round(usd * INR_PER_USD * 100) / 100;
}

async function createOrder(input: {
  amountInRupees: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<CheckoutOrder> {
  const paise = toPaise(input.amountInRupees);
  // Razorpay rejects anything under 100 paise (₹1).
  if (!Number.isFinite(paise) || paise < 100) {
    throw new Error("That amount is too small to charge online.");
  }
  if (paise > toPaise(MAX_CHARGE_INR)) {
    throw new Error("That amount is above the online payment limit.");
  }

  const order = await rzpJson<RzpOrder>(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({
        amount: paise,
        currency: "INR",
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
      }),
    },
    "Could not start the payment. Please try again.",
  );

  return { keyId: getKeyId(), orderId: order.id, amount: order.amount, currency: "INR" };
}

/* ------------------------------------------------------------------ *
 * One-off payments: bookings and wallet top-ups
 * ------------------------------------------------------------------ */

/**
 * Prices a booking from the database and opens it as a Razorpay order. The
 * amount is always derived server-side — never trusted from the browser.
 */
export const createBookingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }): Promise<CheckoutOrder> => {
    const { data: quote, error } = await context.supabase.rpc("get_booking_charge", {
      p_booking_id: data.bookingId,
      p_env: getPaymentEnv(),
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(quote) ? quote[0] : quote) as { total: number | string } | null;
    if (!row) throw new Error("Could not price this booking");

    return createOrder({
      amountInRupees: usdToInr(Number(row.total)),
      receipt: `bk_${data.bookingId.slice(0, 30)}`,
      notes: { bookingId: data.bookingId, userId: context.userId, kind: "booking" },
    });
  });

/** Opens a Razorpay order for any amount the driver chooses (parking credit). */
export const createTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) => data)
  .handler(async ({ data, context }): Promise<CheckoutOrder> => {
    const amount = Math.round(Number(data.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < MIN_CHARGE_INR || amount > MAX_CHARGE_INR) {
      throw new Error(`Enter an amount between ₹${MIN_CHARGE_INR} and ₹${MAX_CHARGE_INR}.`);
    }
    return createOrder({
      amountInRupees: amount,
      receipt: `tp_${context.userId.slice(0, 30)}`,
      notes: { userId: context.userId, kind: "topup" },
    });
  });

export type VerifyResult = { verified: true; settled: boolean };

/**
 * Verifies the Razorpay signature returned by the checkout modal and, for a
 * booking, confirms the reservation. Nothing is marked paid unless the
 * signature matches.
 */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      bookingId?: string;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    if (!data.razorpayOrderId || !data.razorpayPaymentId || !data.razorpaySignature) {
      throw new Error("Payment details are incomplete.");
    }
    const ok = verifyPaymentSignature({
      orderId: data.razorpayOrderId,
      paymentId: data.razorpayPaymentId,
      signature: data.razorpaySignature,
    });
    if (!ok) {
      console.error("Razorpay signature mismatch", data.razorpayOrderId);
      throw new Error("We could not verify this payment. You have not been charged twice — contact support if money left your account.");
    }

    if (!data.bookingId) return { verified: true, settled: false };

    // Read the real amount back from Razorpay rather than trusting the client.
    const payment = await rzpJson<{ amount: number; status: string }>(
      `/payments/${encodeURIComponent(data.razorpayPaymentId)}`,
      undefined,
      "Could not confirm the payment with the bank.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: outcome, error } = await supabaseAdmin.rpc("settle_booking_payment", {
      p_booking_id: data.bookingId,
      p_transaction_id: data.razorpayPaymentId,
      p_amount_charged: payment.amount / 100 / INR_PER_USD,
      p_env: getPaymentEnv(),
    });
    if (error) throw new Error(error.message);

    // Somebody else confirmed the slot while this driver was paying.
    if (outcome === "conflict") {
      await refundPayment(
        data.razorpayPaymentId,
        "Parking slot was taken before payment completed",
      );
      await supabaseAdmin.rpc("mark_booking_refunded", {
        p_booking_id: data.bookingId,
        p_refund_id: undefined,
      });
      throw new Error("That slot was just taken — your payment is being refunded automatically.");
    }

    void context.userId;
    return { verified: true, settled: true };
  });

async function refundPayment(paymentId: string, reason: string): Promise<string | null> {
  const res = await rzpFetch(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({ speed: "normal", notes: { reason: reason.slice(0, 200) } }),
  });
  if (!res.ok) {
    console.error("Refund failed", paymentId, await res.text());
    return null;
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

/* ------------------------------------------------------------------ *
 * Cancellations and refunds
 * ------------------------------------------------------------------ */

export type CancelBookingResult = {
  status: string;
  paymentStatus: string;
  refundAmount: number;
  refundRequested: boolean;
};

/**
 * Cancels a booking under the host's cancellation policy and, when a refund is
 * owed, files it with Razorpay.
 */
export const cancelBookingWithRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; reason?: string }) => data)
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
      const refundId = await refundPayment(
        booking.paddle_transaction_id,
        data.reason || "Booking cancelled within the cancellation policy",
      );
      if (refundId) {
        refundRequested = true;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("mark_booking_refunded", {
          p_booking_id: data.bookingId,
          p_refund_id: refundId,
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

/* ------------------------------------------------------------------ *
 * Host Pro subscriptions
 * ------------------------------------------------------------------ */

type RzpPlan = { id: string; notes?: Record<string, string> };

/** Finds the Razorpay plan for a tier, creating it on first use. */
async function ensurePlan(planKey: ProPlanKey): Promise<string> {
  const plan = PRO_PLANS[planKey];
  const list = await rzpJson<{ items?: RzpPlan[] }>(
    "/plans?count=100",
    undefined,
    "Plans are unavailable right now.",
  );
  const existing = list.items?.find((p) => p.notes?.["plan_key"] === planKey);
  if (existing) return existing.id;

  const created = await rzpJson<RzpPlan>(
    "/plans",
    {
      method: "POST",
      body: JSON.stringify({
        period: plan.period,
        interval: 1,
        item: {
          name: plan.name,
          amount: toPaise(plan.amountInr),
          currency: "INR",
          description: "LumoroX Park Host Pro",
        },
        notes: { plan_key: planKey },
      }),
    },
    "Could not set up the plan. Please try again.",
  );
  return created.id;
}

export type SubscriptionCheckout = { keyId: string; subscriptionId: string };

/** Creates a Razorpay subscription for Host Pro and returns it for checkout. */
export const createProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan: ProPlanKey }) => data)
  .handler(async ({ data, context }): Promise<SubscriptionCheckout> => {
    const planKey: ProPlanKey = data.plan === "host_pro_yearly" ? "host_pro_yearly" : "host_pro_monthly";
    const planId = await ensurePlan(planKey);

    const subscription = await rzpJson<{ id: string }>(
      "/subscriptions",
      {
        method: "POST",
        body: JSON.stringify({
          plan_id: planId,
          total_count: planKey === "host_pro_yearly" ? 10 : 120,
          customer_notify: 1,
          notes: { userId: context.userId, plan_key: planKey },
        }),
      },
      "Could not start the subscription. Please try again.",
    );

    return { keyId: getKeyId(), subscriptionId: subscription.id };
  });

/** Verifies a subscription checkout and records the plan against the account. */
export const verifySubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      razorpaySubscriptionId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ verified: true }> => {
    if (!data.razorpaySubscriptionId || !data.razorpayPaymentId || !data.razorpaySignature) {
      throw new Error("Payment details are incomplete.");
    }
    const ok = verifySubscriptionSignature({
      subscriptionId: data.razorpaySubscriptionId,
      paymentId: data.razorpayPaymentId,
      signature: data.razorpaySignature,
    });
    if (!ok) throw new Error("We could not verify this subscription payment.");

    const sub = await rzpJson<{
      id: string;
      status: string;
      customer_id?: string;
      current_start?: number | null;
      current_end?: number | null;
      notes?: Record<string, string>;
    }>(
      `/subscriptions/${encodeURIComponent(data.razorpaySubscriptionId)}`,
      undefined,
      "Could not confirm the subscription.",
    );

    const planKey = (sub.notes?.["plan_key"] as ProPlanKey | undefined) ?? "host_pro_monthly";
    const toIso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        paddle_subscription_id: sub.id,
        paddle_customer_id: sub.customer_id ?? "na",
        product_id: "host_pro",
        price_id: planKey,
        status: sub.status === "authenticated" ? "active" : sub.status,
        current_period_start: toIso(sub.current_start),
        current_period_end: toIso(sub.current_end),
        environment: getPaymentEnv(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
    if (error) throw new Error(error.message);
    return { verified: true };
  });

/** Cancels Host Pro at the end of the paid period. */
export const cancelProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, status")
      .eq("user_id", context.userId)
      .eq("environment", getPaymentEnv())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.paddle_subscription_id) throw new Error("No subscription found for your account");

    await rzpJson(
      `/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}/cancel`,
      { method: "POST", body: JSON.stringify({ cancel_at_cycle_end: 1 }) },
      "Could not cancel your plan. Please try again.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("paddle_subscription_id", sub.paddle_subscription_id);

    return { ok: true };
  });
