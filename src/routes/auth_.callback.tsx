import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth-errors";
import { consumeNext, readOAuthError } from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Signing you in · LumoroX Park" },
      { name: "description", content: "Completing your LumoroX Park sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (session: unknown) => {
      if (done || !session) return;
      done = true;
      const next = consumeNext();
      navigate({ to: next ?? "/onboarding", replace: true });
    };

    // Provider-side failure (user cancelled, consent denied, bad config).
    const providerError = readOAuthError(window.location.href);
    if (providerError) {
      setError(describeAuthError(providerError));
      return;
    }

    // supabase-js exchanges the code/hash for a session asynchronously, so
    // listen for it instead of racing a single getSession() read.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => finish(session));

    supabase.auth
      .getSession()
      .then(({ data, error: err }) => {
        if (err) throw err;
        finish(data.session);
      })
      .catch((err) => setError(describeAuthError(err)));

    timer = setTimeout(() => {
      if (done) return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) finish(data.session);
        else if (!done)
          setError("We couldn't finish signing you in. Please try again.");
      });
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <BrandLogo className="mx-auto h-9" />
        {error ? (
          <>
            <h1 className="mt-6 text-lg font-semibold">Sign-in didn't complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5 w-full" onClick={() => navigate({ to: "/auth", replace: true })}>
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
            <h1 className="mt-4 text-lg font-semibold">Signing you in…</h1>
            <p className="mt-1 text-sm text-muted-foreground">Just a moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
