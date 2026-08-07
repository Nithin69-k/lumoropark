/**
 * Google sign-in.
 *
 * Always goes through the managed OAuth helper. It works both in the editor
 * preview (cross-origin iframe, popup + web_message flow) and on real hosts
 * (full-page redirect), and it is the only path that has Google credentials
 * configured — calling the backend's own OAuth endpoint directly fails with
 * "Unsupported provider: missing OAuth secret".
 */
export type GoogleSignInResult = { error?: { message: string }; redirected?: boolean };

export async function signInWithGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  if (typeof window === "undefined") return { error: { message: "Unavailable" } };

  try {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectTo,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) return { error: { message: result.error.message } };
    return { redirected: Boolean((result as { redirected?: boolean }).redirected) };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Google sign-in failed" } };
  }
}
