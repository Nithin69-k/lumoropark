import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/razorpay/verify-payment")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const secret = process.env.RAZORPAY_KEY_SECRET;
          if (!secret) {
            return Response.json(
              { error: "Razorpay secret not configured" },
              { status: 500, headers: CORS },
            );
          }

          const body = (await request.json().catch(() => ({}))) as {
            razorpay_order_id?: string;
            razorpay_payment_id?: string;
            razorpay_signature?: string;
          };
          const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

          if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return Response.json(
              { error: "Missing required fields" },
              { status: 400, headers: CORS },
            );
          }

          const expected = createHmac("sha256", secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

          const a = Buffer.from(expected, "hex");
          const b = Buffer.from(razorpay_signature, "hex");
          const valid = a.length === b.length && timingSafeEqual(a, b);

          if (!valid) {
            return Response.json(
              { success: false, error: "Invalid signature" },
              { status: 400, headers: CORS },
            );
          }

          return Response.json(
            { success: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id },
            { headers: CORS },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
