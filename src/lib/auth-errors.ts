/**
 * Turns raw auth/provider errors into something a person can act on.
 */
export function describeAuthError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : ((err as { message?: string } | null)?.message ?? "Something went wrong");
  const msg = raw.toLowerCase();
  const status = (err as { status?: number } | null)?.status;

  if (msg.includes("invalid login credentials"))
    return "That email and password don't match. Check them, or reset your password.";
  if (msg.includes("email not confirmed"))
    return "Your email isn't confirmed yet — open the confirmation link we sent you.";
  if (msg.includes("user already registered") || msg.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (msg.includes("password should be at least"))
    return "Your password is too short — use at least 6 characters.";
  if (msg.includes("known to be weak") || msg.includes("pwned") || msg.includes("leaked"))
    return "That password has appeared in a data breach. Pick a different, stronger one.";
  if (msg.includes("unsupported provider") || msg.includes("provider is not enabled"))
    return "Google sign-in isn't enabled for this app yet. Use email and password for now.";
  if (msg.includes("access_denied") || msg.includes("access denied"))
    return "You cancelled the Google sign-in, or Google denied access. Try again.";
  if (msg.includes("popup") && (msg.includes("closed") || msg.includes("blocked")))
    return "The Google window was blocked or closed. Allow pop-ups for this site and try again.";
  if (msg.includes("otp") || msg.includes("expired") || msg.includes("invalid_grant"))
    return "That sign-in link has expired. Request a new one and try again.";
  if (msg.includes("rate limit") || status === 429)
    return "Too many attempts. Wait a minute before trying again.";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("network") ||
    msg.includes("timeout")
  )
    return "We couldn't reach the server. Check your connection and try again.";
  if (typeof status === "number" && status >= 500)
    return "Our sign-in service hiccuped. Please try again in a moment.";

  return raw;
}
