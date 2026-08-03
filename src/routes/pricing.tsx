import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { useServerFn } from "@tanstack/react-start";
import { formatInr } from "@/lib/currency";
import { PRO_PLANS, type ProPlanKey } from "@/lib/pricing";
import { createProSubscription, verifySubscriptionPayment } from "@/utils/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Host Pro Pricing | LUMORO X PARK" },
      {
        name: "description",
        content:
          "Compare the free host plan with Host Pro: unlimited listings, featured placement and earnings analytics for parking hosts.",
      },
      { property: "og:title", content: "Host Pro Pricing | LUMORO X PARK" },
      {
        property: "og:description",
        content: "Unlimited listings, featured placement and analytics for parking hosts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

const FREE = [
  "Up to 2 listings",
  "10% platform commission",
  "Standard search placement",
  "Wallet & monthly payouts",
];
const PRO = [
  "Unlimited listings",
  "Reduced 5% platform commission",
  "Featured placement in search + Pro badge",
  "Earnings analytics & demand insights",
  "Priority support",
];

function PricingPage() {
  const { openCheckout, loading } = useRazorpayCheckout();
  const { isActive, subscription, pastDue, cancelling, cancelPlan, refresh } = useSubscription();
  const [cancelBusy, setCancelBusy] = useState(false);
  const runCreateSubscription = useServerFn(createProSubscription);
  const runVerify = useServerFn(verifySubscriptionPayment);

  async function cancel() {
    if (!window.confirm("Cancel Host Pro? You keep Pro benefits until the end of this period.")) {
      return;
    }
    setCancelBusy(true);
    try {
      await cancelPlan();
      toast.success("Host Pro will end when the current period finishes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel your plan");
    } finally {
      setCancelBusy(false);
    }
  }

  async function subscribe(plan: ProPlanKey) {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Sign in to subscribe");

      const { keyId, subscriptionId } = await runCreateSubscription({ data: { plan } });

      await openCheckout({
        keyId,
        subscriptionId,
        description: PRO_PLANS[plan].name,
        prefill: { email: user.email ?? undefined },
        onSuccess: async (res) => {
          try {
            await runVerify({
              data: {
                razorpaySubscriptionId: res.razorpay_subscription_id ?? subscriptionId,
                razorpayPaymentId: res.razorpay_payment_id,
                razorpaySignature: res.razorpay_signature,
              },
            });
            toast.success("Welcome to Host Pro!");
            await refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "We could not confirm the subscription");
          }
        },
        onDismiss: () => toast.message("Subscription cancelled"),
        onFailure: (message) => toast.error(message),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open checkout");
    }
  }

  return (
    <div className="min-h-full bg-gradient-surface">
      <PaymentTestModeBanner />
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link>
          </Button>
          <h1 className="font-display text-lg font-bold">Host plans</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold">Earn more from your driveway</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Listing is free. Upgrade when you want more spaces and better visibility.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-semibold">Starter</h3>
            <div className="mt-2 text-3xl font-bold">{formatInr(0)}</div>
            <ul className="mt-4 space-y-2 text-sm">
              {FREE.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-muted-foreground" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to="/host">Go to host dashboard</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Host Pro</h3>
            </div>
            <div className="mt-2 text-3xl font-bold">
              {formatInr(PRO_PLANS.host_pro_monthly.amountInr)}
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              or {formatInr(PRO_PLANS.host_pro_yearly.amountInr)} billed yearly — 2 months free
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {PRO.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            {isActive ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-border bg-background/60 p-3 text-sm">
                  You're on Host Pro
                  {subscription?.cancel_at_period_end && subscription.current_period_end
                    ? ` — access until ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : subscription?.current_period_end
                      ? ` — renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      : ""}
                  .
                </div>
                {pastDue && (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    Your last payment failed. Update your payment method to keep Pro benefits.
                  </div>
                )}
                {subscription?.status === "paused" && (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    Your plan is paused, so Pro benefits are on hold until the next charge succeeds.
                  </div>
                )}
                {!cancelling && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={cancelBusy}
                    onClick={cancel}
                  >
                    {cancelBusy ? "Cancelling…" : "Cancel Host Pro"}
                  </Button>
                )}
              </div>

            ) : (
              <div className="mt-6 space-y-2">
                <Button className="w-full" disabled={loading} onClick={() => subscribe("host_pro_monthly")}>
                  {loading ? "Opening…" : "Subscribe monthly"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => subscribe("host_pro_yearly")}
                >
                  Subscribe yearly
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

    </div>

  );
}
