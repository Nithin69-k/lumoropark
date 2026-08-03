import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in goes straight through the backend's own OAuth endpoint on
 * every host. That keeps the consent + callback flow branded as LumoroX Park
 * (no third-party broker in the middle) and works identically on Vercel,
 * Netlify, Render or any other host that is allow-listed in auth settings.
 */
export type GoogleSignInResult = { error?: { message: string }; redirected?: boolean };

export async function signInWithGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  if (typeof window === "undefined") return { error: { message: "Unavailable" } };

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) return { error: { message: error.message } };
  // supabase-js navigates the browser to Google itself.
  return { redirected: true };
}
