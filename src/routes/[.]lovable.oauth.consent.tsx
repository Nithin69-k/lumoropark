import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

// Beta typed wrapper for supabase.auth.oauth helpers.
type OAuthClient = { name?: string; client_id?: string };
type OAuthDetails = {
  client?: OAuthClient;
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResponse = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResponse>;
  approveAuthorization: (id: string) => Promise<OAuthResponse>;
  denyAuthorization: (id: string) => Promise<OAuthResponse>;
};
const authOAuth = () =>
  (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "signin", next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8 text-sm">
      <h1 className="mb-2 text-lg font-semibold">Could not load this authorization request</h1>
      <p className="text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<false | "approve" | "deny">(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an external app";

  async function decide(approve: boolean) {
    setError(null);
    setBusy(approve ? "approve" : "deny");
    const oauth = authOAuth();
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold">Connect {clientName}</h1>
            <p className="text-xs text-muted-foreground">to your LumoroX Park account</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This lets <span className="font-medium text-foreground">{clientName}</span> use LumoroX
          Park as you — searching listings, creating bookings, and reading your notifications on
          your behalf.
        </p>

        {details?.redirect_uri && (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            Redirect URI: <span className="font-mono">{details.redirect_uri}</span>
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          This does not bypass this app's permissions — row-level security still restricts access
          to your own data.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={!!busy}
            onClick={() => decide(false)}
          >
            {busy === "deny" ? "Cancelling…" : "Cancel connection"}
          </Button>
          <Button className="flex-1" disabled={!!busy} onClick={() => decide(true)}>
            {busy === "approve" ? "Connecting…" : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}
