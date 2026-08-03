/**
 * Helpers for preserving "where the user meant to go" across a full-page
 * OAuth round-trip (which can land in a different tab, or after a reload).
 */

const KEY = "post_auth_next";
const MAX_AGE_MS = 15 * 60 * 1000;

/** Only same-origin relative paths are ever allowed as redirect targets. */
export function sanitizeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth")) return null; // never bounce back into sign-in
  return value;
}

export function saveNext(next: string | null | undefined) {
  const safe = sanitizeNext(next);
  if (typeof window === "undefined") return;
  if (!safe) {
    clearNext();
    return;
  }
  const payload = JSON.stringify({ path: safe, at: Date.now() });
  try {
    sessionStorage.setItem(KEY, payload);
    localStorage.setItem(KEY, payload); // survives a new-tab OAuth return
  } catch {
    /* storage unavailable — redirect falls back to the default landing page */
  }
}

export function consumeNext(): string | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  } catch {
    return null;
  }
  clearNext();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.at === "number" && Date.now() - parsed.at > MAX_AGE_MS) return null;
    return sanitizeNext(parsed.path);
  } catch {
    return sanitizeNext(raw);
  }
}

export function clearNext() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Reads an OAuth provider error out of the querystring or the URL hash. */
export function readOAuthError(url: string): string | null {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const code = parsed.searchParams.get("error") ?? hash.get("error");
  if (!code) return null;
  const description =
    parsed.searchParams.get("error_description") ?? hash.get("error_description") ?? code;
  return description.replace(/\+/g, " ");
}
