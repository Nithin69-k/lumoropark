import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getPaymentEnv, verifyWebhookSignature } from "@/lib/razorpay.server";
import { INR_PER_USD } from "@/lib/pricing";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

/** Backstop for a booking whose browser closed before verification ran. */
async function handlePaymentCaptured(payment: any) {
  const bookingId = payment?.notes?.bookingId;
  if (!bookingId) return;
  const env = getPaymentEnv();
  const { error } = await getSupabase().rpc("settle_booking_payment", {
    p_booking_id: bookingId,
    p_transaction_id: payment.id,
    p_amount_charged: Number(payment.amount ?? 0) / 100 / INR_PER_USD,
    p_env: env,
  });
  if (error) throw new Error(error.message);
}

async function handlePaymentFailed(payment: any) {
  const userId = payment?.notes?.userId;
  if (!userId) return;
  await getSupabase().from("notifications").insert({
    user_id: userId,
    kind: "payment",
    title: "Payment failed",
    body: "Your payment did not go through. Your reservation is not confirmed until it succeeds.",
    link: "/bookings",
  });
}

async function handleRefundProcessed(refund: any) {
  if (!refund?.payment_id) return;
  const { error } = await getSupabase().rpc("mark_booking_refunded_by_transaction", {
    p_transaction_id: refund.payment_id,
  });
  if (error) throw new Error(error.message);
}

async function upsertSubscription(sub: any, status: string) {
  const toIso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);
  const userId = sub?.notes?.userId;
  if (!userId) return;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: sub.id,
      paddle_customer_id: sub.customer_id ?? "na",
      product_id: "host_pro",
      price_id: sub?.notes?.plan_key ?? "host_pro_monthly",
      status,
      current_period_start: toIso(sub.current_start),
      current_period_end: toIso(sub.current_end),
      environment: getPaymentEnv(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );

  if (status === "past_due" || status === "halted") {
    await getSupabase().from("notifications").insert({
      user_id: userId,
      kind: "payment",
      title: "Host Pro payment failed",
      body: "We couldn't collect your subscription payment. Update your payment method to keep Pro benefits.",
      link: "/pricing",
    });
  }
}

async function handleEvent(event: string, payload: any) {
  switch (event) {
    case "payment.captured":
      await handlePaymentCaptured(payload?.payment?.entity);
      break;
    case "payment.failed":
      await handlePaymentFailed(payload?.payment?.entity);
      break;
    case "refund.processed":
      await handleRefundProcessed(payload?.refund?.entity);
      break;
    case "subscription.activated":
    case "subscription.charged":
      await upsertSubscription(payload?.subscription?.entity, "active");
      break;
    case "subscription.pending":
      await upsertSubscription(payload?.subscription?.entity, "past_due");
      break;
    case "subscription.halted":
      await upsertSubscription(payload?.subscription?.entity, "halted");
      break;
    case "subscription.cancelled":
    case "subscription.completed":
      await upsertSubscription(payload?.subscription?.entity, "canceled");
      break;
    default:
      console.log("Unhandled Razorpay event:", event);
  }
}

export const Route = createFileRoute("/api/public/payments/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!process.env["RAZORPAY_WEBHOOK_SECRET"]) {
          console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 503 });
        }
        if (!verifyWebhookSignature(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const body = JSON.parse(rawBody) as { event: string; payload: any };
          await handleEvent(body.event, body.payload);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Razorpay webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
