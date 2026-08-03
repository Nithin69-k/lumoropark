import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { supabase } from "@/integrations/supabase/client";
import { formatInr, MIN_CHARGE_INR } from "@/lib/currency";
import { createTopupOrder, verifyPayment } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({
    meta: [
      { title: "Add parking credit | LumoroX Park" },
      {
        name: "description",
        content: "Top up your LumoroX Park balance with any amount, paid securely in rupees.",
      },
      { property: "og:title", content: "Add parking credit | LumoroX Park" },
      { property: "og:description", content: "Pay any amount you like, securely in rupees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopUpPage,
});

const PRESETS = [500, 1000, 2500, 5000];

function TopUpPage() {
  const [amount, setAmount] = useState("");
  const { openCheckout, loading } = useRazorpayCheckout();
  const [starting, setStarting] = useState(false);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= MIN_CHARGE_INR;

  async function pay() {
    if (!valid) {
      toast.error(`Minimum is ${formatInr(MIN_CHARGE_INR)}`);
      return;
    }
    setStarting(true);
    try {
      const { data } = await supabase.auth.getUser();
      const order = await createTopupOrder({ data: { amount: parsed } });

      await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        description: "LumoroX Park parking credit",
        prefill: { email: data.user?.email ?? undefined },
        onSuccess: async (res) => {
          try {
            await verifyPayment({
              data: {
                razorpayOrderId: res.razorpay_order_id ?? order.orderId,
                razorpayPaymentId: res.razorpay_payment_id,
                razorpaySignature: res.razorpay_signature,
              },
            });
            toast.success("Payment received — credit added to your account");
            setAmount("");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "We could not confirm the payment");
          }
        },
        onDismiss: () => toast.message("Payment cancelled"),
        onFailure: (message) => toast.error(message),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the payment");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Wallet className="h-6 w-6 text-primary" /> Add parking credit
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pay any amount you like. Cards, UPI, net banking and wallets are all accepted.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input
          id="amount"
          className="mt-2"
          inputMode="decimal"
          placeholder={String(PRESETS[0])}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((v) => (
            <Button
              key={v}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(v))}
            >
              {formatInr(v)}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Minimum {formatInr(MIN_CHARGE_INR)}. You'll be charged exactly the amount shown.
        </p>
        <Button className="mt-4 w-full" onClick={pay} disabled={!valid || loading || starting}>
          {loading || starting ? "Opening…" : `Pay ${valid ? formatInr(parsed) : ""}`.trim()}
        </Button>
      </div>
    </div>
  );
}
