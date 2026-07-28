import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, gatewayFetch, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _supabase;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function refundTransaction(env: PaddleEnv, transactionId: string, reason: string) {
  const res = await gatewayFetch(env, "/adjustments", {
    method: "POST",
    body: JSON.stringify({
      action: "refund",
      transaction_id: transactionId,
      reason,
      type: "full",
    }),
  });
  if (!res.ok) {
    console.error("Automatic refund failed", transactionId, await res.text());
    return null;
  }
  const payload = (await res.json()) as { data?: { id?: string } };
  return payload.data?.id ?? null;
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const bookingId = data.customData?.bookingId;
  if (!bookingId) {
    console.log("transaction.completed without bookingId — nothing to settle");
    return;
  }
  const total = Number(data.details?.totals?.total ?? 0) / 100;
  const { data: outcome, error } = await getSupabase().rpc("settle_booking_payment", {
    p_booking_id: bookingId,
    p_transaction_id: data.id,
    p_amount_charged: total,
    p_env: env,
  });
  if (error) throw new Error(error.message);

  // The slot was confirmed by somebody else while this driver was paying —
  // refund automatically instead of leaving a clashing reservation.
  if (outcome === "conflict") {
    const refundId = await refundTransaction(
      env,
      data.id,
      "Parking slot was taken before payment completed",
    );
    if (refundId) {
      await getSupabase().rpc("mark_booking_refunded", {
        p_booking_id: bookingId,
        p_refund_id: refundId,
      });
    }
  }
}


async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (!userId) {
    console.error("No userId in customData for subscription", data.id);
    return;
  }
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }

  const { error } = await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      product_id: productId,
      price_id: priceId,
      status: data.status,
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );
  if (error) throw new Error(error.message);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;

  const { data: rows } = await getSupabase()
    .from("subscriptions")
    .update({
      status: data.status,
      // Keep the plan on the row in sync so tier gating survives an upgrade,
      // downgrade or monthly/yearly switch.
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      cancel_at_period_end: data.scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env)
    .select("user_id");

  const userId = rows?.[0]?.user_id as string | undefined;
  if (!userId) return;

  if (data.status === "past_due") {
    await getSupabase().from("notifications").insert({
      user_id: userId,
      kind: "payment",
      title: "Host Pro payment failed",
      body: "We couldn't charge your card. Update your payment method to keep your Pro benefits.",
      link: "/pricing",
    });
  } else if (data.status === "paused") {
    await getSupabase().from("notifications").insert({
      user_id: userId,
      kind: "payment",
      title: "Host Pro paused",
      body: "Your plan is paused, so Pro benefits are on hold until you resume it.",
      link: "/pricing",
    });
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function handleSubscriptionPastDue(data: any, env: PaddleEnv) {
  const { data: rows } = await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env)
    .select("user_id");

  const userId = rows?.[0]?.user_id;
  if (!userId) return;
  await getSupabase().from("notifications").insert({
    user_id: userId,
    kind: "payment",
    title: "Host Pro payment failed",
    body: "We couldn't charge your card. Update your payment method to keep your Pro benefits.",
    link: "/pricing",
  });
}

/** A refund/credit was created on a transaction — reconcile the booking. */
async function handleAdjustmentCreated(data: any) {
  if (data.action !== "refund" && data.action !== "credit") return;
  const transactionId = data.transactionId ?? data.transaction_id;
  if (!transactionId) return;
  const { error } = await getSupabase().rpc("mark_booking_refunded_by_transaction", {
    p_transaction_id: transactionId,
  });
  if (error) throw new Error(error.message);
}

async function handleTransactionPaymentFailed(data: any) {
  const userId = data.customData?.userId;
  if (!userId) return;
  await getSupabase().from("notifications").insert({
    user_id: userId,
    kind: "payment",
    title: "Payment failed",
    body: "Your card was declined. Your reservation is not confirmed until payment succeeds.",
    link: "/bookings",
  });
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    case EventName.TransactionPaymentFailed:
      await handleTransactionPaymentFailed(event.data);
      break;
    case EventName.AdjustmentCreated:
      await handleAdjustmentCreated(event.data);
      break;
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionPastDue:
      await handleSubscriptionPastDue(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
