import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { useCurrency } from "@/hooks/useCurrency";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, MIN_CHARGE } from "@/lib/currency";
import { getPaddleEnvironment } from "@/lib/paddle";
import { createCustomCharge } from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({
    meta: [
      { title: "Add parking credit | LumoroX Park" },
      {
        name: "description",
        content:
          "Top up your LumoroX Park balance with any amount, in US dollars or Indian rupees.",
      },
      { property: "og:title", content: "Add parking credit | LumoroX Park" },
      {
        property: "og:description",
        content: "Pay any amount you like, in dollars or rupees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopUpPage,
});

const PRESETS: Record<"USD" | "INR", number[]> = {
  USD: [10, 25, 50, 100],
  INR: [500, 1000, 2500, 5000],
};

function TopUpPage() {
  const { currency } = useCurrency();
  const [amount, setAmount] = useState("");
  const { openCheckout, loading } = usePaddleCheckout();
  const [starting, setStarting] = useState(false);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= MIN_CHARGE[currency];

  async function pay() {
    if (!valid) {
      toast.error(`Minimum is ${formatMoney(MIN_CHARGE[currency], currency)}`);
      return;
    }
    setStarting(true);
    try {
      const { data } = await supabase.auth.getUser();
      const { transactionId } = await createCustomCharge({
        data: { amount: parsed, currency, environment: getPaddleEnvironment() },
      });
      await openCheckout({
        transactionId,
        customerEmail: data.user?.email ?? undefined,
        successUrl: `${window.location.origin}/bookings`,
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
        Pay any amount you like. Choose the currency you want to be charged in.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <Label htmlFor="amount">Amount</Label>
          <CurrencySwitcher />
        </div>
        <Input
          id="amount"
          className="mt-2"
          inputMode="decimal"
          placeholder={String(PRESETS[currency][0])}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS[currency].map((v) => (
            <Button
              key={v}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(v))}
            >
              {formatMoney(v, currency)}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Minimum {formatMoney(MIN_CHARGE[currency], currency)}. You'll be charged exactly the
          amount shown on the checkout.
        </p>
        <Button className="mt-4 w-full" onClick={pay} disabled={!valid || loading || starting}>
          {loading || starting
            ? "Opening…"
            : `Pay ${valid ? formatMoney(parsed, currency) : ""}`.trim()}
        </Button>
      </div>
    </div>
  );
}
