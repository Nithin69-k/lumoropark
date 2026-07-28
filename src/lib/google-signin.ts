import { supabase } from "@/integrations/supabase/client";

/**
 * The Lovable OAuth broker (`@lovable.dev/cloud-auth-js`) relies on the
 * `/~oauth/*` paths that only exist on Lovable-hosted domains. On any other
 * host — e.g. a Vercel deployment — those paths 404 and Google sign-in dies
 * silently. There we go straight through the backend's own OAuth endpoint,
 * which works on any origin that is allow-listed in the auth settings.
 */
function isLovableHost(host: string) {
  return (
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export type GoogleSignInResult = { error?: { message: string }; redirected?: boolean };

export async function signInWithGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  if (typeof window === "undefined") return { error: { message: "Unavailable" } };

  if (isLovableHost(window.location.hostname)) {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
    return result as GoogleSignInResult;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { error: { message: error.message } };
  // supabase-js navigates the browser to Google itself.
  return { redirected: true };
}
