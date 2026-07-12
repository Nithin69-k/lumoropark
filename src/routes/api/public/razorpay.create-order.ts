import { createFileRoute } from "@tanstack/react-router";

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

          const auth = btoa(`${keyId}:${keySecret}`);
          const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              amount: Math.round(amount),
              currency: body.currency || "INR",
              receipt: body.receipt || `rcpt_${Date.now()}`,
            }),
          });

          const order = await rzpRes.json();
          if (!rzpRes.ok) {
            const status = rzpRes.status === 401 ? 401 : 500;
            return Response.json(
              { error: order?.error?.description || "Razorpay API error" },
              { status, headers: CORS },
            );
          }

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
          return Response.json({ error: message }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
