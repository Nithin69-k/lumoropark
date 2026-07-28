import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Zap, QrCode, Truck, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/BrandLogo";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "LumoroX Park — Book private driveway parking" },
      {
        name: "description",
        content:
          "Find and book private driveway parking near you by the hour. QR check-in, live availability, and EV-ready spots on LumoroX Park.",
      },
      { property: "og:title", content: "LumoroX Park — Book private driveway parking" },
      {
        property: "og:description",
        content:
          "Find and book private driveway parking near you by the hour. QR check-in, live availability, and EV-ready spots on LumoroX Park.",
      },
      { property: "og:url", content: absoluteUrl("/") },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LumoroX Park",
          url: absoluteUrl("/"),
          potentialAction: {
            "@type": "SearchAction",
            target: absoluteUrl("/browse?q={search_term_string}"),
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-full bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <Link to="/" className="flex min-w-0 items-center" aria-label="LumoroX Park home">
            <BrandLogo className="h-8 sm:h-10" />
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link to="/help">Help</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link to="/guides/rv-parking">RV guide</Link>
            </Button>
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/profile">My profile</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/auth" search={{ mode: "signin" }}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {[
                    { to: "/browse", label: "Find parking" },
                    { to: "/pricing", label: "Pricing" },
                    { to: "/help", label: "Help Center" },
                    { to: "/support", label: "Contact support" },
                    { to: "/guides/rv-parking", label: "RV parking guide" },
                  ].map((l) => (
                    <SheetClose asChild key={l.to}>
                      <Link
                        to={l.to}
                        className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        {l.label}
                      </Link>
                    </SheetClose>
                  ))}
                  {!signedIn && (
                    <SheetClose asChild>
                      <Link
                        to="/auth"
                        search={{ mode: "signin" }}
                        className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        Sign in
                      </Link>
                    </SheetClose>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-5 md:py-24">
        <section className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live in your city soon
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Park smarter.{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">Earn from your driveway.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Book a private spot near you by the hour, or turn your empty driveway into income.
            Contactless QR check-in, live availability, and trust scores you can rely on.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/browse">Find parking near me</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                List your driveway
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 md:mt-20">
          <h2 className="sr-only">Why LumoroX Park</h2>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {[
            { icon: MapPin, title: "Live map", body: "See free spots update in real time as bookings happen." },
            { icon: QrCode, title: "QR check-in", body: "Scan on arrival — no keys, no waiting, no phone calls." },
            { icon: Zap, title: "EV ready", body: "Filter for chargers, covered spots, and gated lots." },
            { icon: ShieldCheck, title: "Trust score", body: "Every host and renter earns a public reliability score." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
          </div>
        </section>

        <section className="mt-16 md:mt-20">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 md:p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  Specialized vehicle storage
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                  Have an RV, camper, or boat?
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Oversized vehicles need more than a standard parking spot. Learn how to
                  list RV parking and storage on LumoroX Park and capture high-intent
                  renters looking for space near them.
                </p>
              </div>
              <Button asChild size="lg" className="w-full md:w-auto">
                <Link to="/guides/rv-parking">Read the RV guide</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

    </div>

  );
}
