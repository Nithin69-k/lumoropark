import { createFileRoute } from "@tanstack/react-router";
import Razorpay from "razorpay";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/razorpay/create-order")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const keyId = process.env.RAZORPAY_KEY_ID;
          const keySecret = process.env.RAZORPAY_KEY_SECRET;
          if (!keyId || !keySecret) {
            return Response.json(
              { error: "Razorpay credentials not configured" },
              { status: 500, headers: CORS },
            );
          }

          const body = (await request.json().catch(() => ({}))) as {
            amount?: number;
            currency?: string;
            receipt?: string;
          };

          const amount = Number(body.amount);
          if (!Number.isFinite(amount) || amount < 100) {
            return Response.json(
              { error: "amount must be an integer >= 100 (paise)" },
              { status: 400, headers: CORS },
            );
          }

          const currency = body.currency || "INR";
          const receipt = body.receipt || `rcpt_${Date.now()}`;

          const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
          const order = await rzp.orders.create({
            amount: Math.round(amount),
            currency,
            receipt,
          });

          return Response.json(
            {
              order_id: order.id,
              amount: order.amount,
              currency: order.currency,
              key_id: keyId,
            },
            { headers: CORS },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = /auth/i.test(message) ? 401 : 500;
          return Response.json({ error: message }, { status, headers: CORS });
        }
      },
    },
  },
});
