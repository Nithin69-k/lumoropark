import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Zap, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
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
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-block h-6 w-6 rounded-md bg-gradient-brand shadow-glow" />
            LumoroX Park
          </Link>
          <nav className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/profile">My profile</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <section className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live in your city soon
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Park smarter.{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">Earn from your driveway.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Book a private spot near you by the hour, or turn your empty driveway into income.
            Contactless QR check-in, live availability, and trust scores you can rely on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signin" }}>
                I already have one
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-5 md:grid-cols-4">
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
        </section>
      </main>
    </div>
  );
}
