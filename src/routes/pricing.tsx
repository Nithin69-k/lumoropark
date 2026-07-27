import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
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
  const { openCheckout, loading } = usePaddleCheckout();
  const { isActive, subscription, pastDue, openPortal } = useSubscription();
  const [portalBusy, setPortalBusy] = useState(false);

  async function manage() {
    setPortalBusy(true);
    try {
      await openPortal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the billing portal");
    } finally {
      setPortalBusy(false);
    }
  }

  async function subscribe(priceId: string) {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Sign in to subscribe");
      await openCheckout({
        items: [{ priceId, quantity: 1 }],
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/host`,
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
            <div className="mt-2 text-3xl font-bold">$0</div>
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
              $19<span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">or $190 billed yearly — 2 months free</p>
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
                <Button variant="outline" className="w-full" disabled={portalBusy} onClick={manage}>
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </Button>
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
