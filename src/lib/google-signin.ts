import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in.
 *
 * On a real host (Vercel, Netlify, the published domain) we go straight
 * through the backend's own OAuth endpoint so the consent + callback flow is
 * branded as LumoroX Park with no third-party broker in the middle.
 *
 * Inside the editor preview the page runs in a cross-origin iframe, where a
 * full-page redirect to Google is blocked (`refused to connect` /
 * `X-Frame-Options`). There we fall back to the iframe-safe popup broker so
 * sign-in still works while building.
 */
export type GoogleSignInResult = { error?: { message: string }; redirected?: boolean };

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function signInWithGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  if (typeof window === "undefined") return { error: { message: "Unavailable" } };

  if (inIframe()) {
    try {
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectTo,
      });
      if (result.error) return { error: { message: result.error.message } };
      return { redirected: Boolean((result as { redirected?: boolean }).redirected) };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : "Google sign-in failed" } };
    }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) return { error: { message: error.message } };
  // supabase-js navigates the browser to Google itself.
  return { redirected: true };
}
