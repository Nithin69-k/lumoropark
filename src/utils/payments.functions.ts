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
          p_refund_id: payload.data?.id ?? null,
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
    const url =
      session.urls?.subscriptions?.[0]?.cancelSubscription ??
      session.urls?.general?.overview;
    if (!url) throw new Error("Could not open the billing portal");
    return session.urls.general.overview;
  });
