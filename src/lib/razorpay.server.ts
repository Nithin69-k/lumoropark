/**
 * Server-side Razorpay helpers.
 *
 * The key secret is read from the server environment only and never reaches
 * the browser. Everything that talks to Razorpay goes through `rzpFetch`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";

export type PaymentEnv = "sandbox" | "live";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export function getKeyId(): string {
  // The key id is publishable, so the VITE_ variable is a valid fallback for
  // hosts where only the browser variable is configured.
  const value = process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"];
  if (!value) throw new Error("RAZORPAY_KEY_ID is not configured");
  return value;
}


function getKeySecret(): string {
  return requireEnv("RAZORPAY_KEY_SECRET");
}

/** Test keys are prefixed `rzp_test_`; everything else is a live account. */
export function getPaymentEnv(): PaymentEnv {
  return getKeyId().startsWith("rzp_test_") ? "sandbox" : "live";
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${getKeyId()}:${getKeySecret()}`).toString("base64")}`;
}

/** Calls the Razorpay REST API with basic auth. */
export async function rzpFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...init?.headers,
    },
  });
}

/** Calls Razorpay and throws a user-safe error when the call fails. */
export async function rzpJson<T>(
  path: string,
  init: RequestInit | undefined,
  friendlyError: string,
): Promise<T> {
  const res = await rzpFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    console.error("Razorpay API error", path, res.status, text);
    if (res.status === 401) throw new Error("Payments are not configured correctly.");
    throw new Error(friendlyError);
  }
  return JSON.parse(text) as T;
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** HMAC-SHA256(order_id|payment_id) — Standard Checkout success handler. */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  return safeEqual(
    hmac(`${input.orderId}|${input.paymentId}`, getKeySecret()),
    input.signature,
  );
}

/** HMAC-SHA256(payment_id|subscription_id) — subscription checkout. */
export function verifySubscriptionSignature(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  return safeEqual(
    hmac(`${input.paymentId}|${input.subscriptionId}`, getKeySecret()),
    input.signature,
  );
}

/** Webhook body signature, using the separate webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  return safeEqual(hmac(rawBody, secret), signature);
}

/** Rupees -> paise, the unit Razorpay works in. */
export function toPaise(amountInRupees: number): number {
  return Math.round(amountInRupees * 100);
}
