import crypto from "node:crypto";

export type StripePlan = "starter" | "pro";

export const stripePlans: Record<StripePlan, { label: string; price: string; envKey: string }> = {
  starter: { label: "Starter", price: "19 EUR/mois", envKey: "STRIPE_STARTER_PRICE_ID" },
  pro: { label: "Pro", price: "49 EUR/mois", envKey: "STRIPE_PRO_PRICE_ID" }
};

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_STARTER_PRICE_ID &&
      process.env.STRIPE_PRO_PRICE_ID
  );
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function getPriceId(plan: StripePlan) {
  const priceId = process.env[stripePlans[plan].envKey];
  if (!priceId) throw new Error(`Prix Stripe manquant pour le plan ${plan}.`);
  return priceId;
}

export function getPlanFromPriceId(priceId?: string | null): StripePlan | "free" {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "free";
}

export async function stripeRequest<T>(
  path: string,
  body?: Record<string, string | number | boolean | undefined>
) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe n'est pas configure.");

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body ? toFormBody(body) : undefined,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Erreur Stripe.");
  }

  return data as T;
}

export function verifyStripeSignature(payload: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((item) => {
      const [key, value] = item.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const expected = parts.v1;

  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const digest = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  if (digest.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
}

function toFormBody(body: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });
  return params.toString();
}
