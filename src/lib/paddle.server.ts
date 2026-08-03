import { Environment, Paddle, EventName } from "@paddle/paddle-node-sdk";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export { EventName };

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev/paddle";
const DIRECT_BASE_URL: Record<PaddleEnv, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === "sandbox"
    ? getEnv("PADDLE_SANDBOX_API_KEY")
    : getEnv("PADDLE_LIVE_API_KEY");
}

/**
 * When LOVABLE_API_KEY is absent (self-hosted on Vercel/Netlify/Render with your
 * own Paddle account) we talk to Paddle directly instead of through the managed
 * gateway. Both paths use the same PADDLE_*_API_KEY.
 */
function useDirectPaddle(): boolean {
  return !process.env["LOVABLE_API_KEY"];
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const connectionApiKey = getConnectionApiKey(env);

  if (useDirectPaddle()) {
    return new Paddle(connectionApiKey, {
      environment: (env === "sandbox" ? "sandbox" : "production") as Environment,
    });
  }

  return new Paddle(connectionApiKey, {
    environment: GATEWAY_BASE_URL as unknown as Environment,
    customHeaders: {
      "X-Connection-Api-Key": connectionApiKey,
      "Lovable-API-Key": getEnv("LOVABLE_API_KEY"),
    },
  });
}

export async function gatewayFetch(
  env: PaddleEnv,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const connectionApiKey = getConnectionApiKey(env);

  if (useDirectPaddle()) {
    return fetch(`${DIRECT_BASE_URL[env]}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connectionApiKey}`,
        ...init?.headers,
      },
    });
  }

  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Connection-Api-Key": connectionApiKey,
      "Lovable-API-Key": getEnv("LOVABLE_API_KEY"),
      ...init?.headers,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get("paddle-signature");
  const body = await req.text();
  const secret = getWebhookSecret(env);

  if (!signature || !body) {
    throw new Error("Missing signature or body");
  }

  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}
