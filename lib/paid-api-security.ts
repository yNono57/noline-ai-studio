import "server-only";

import { NextResponse } from "next/server";

type AuthenticatedUser = { id: string; email?: string };
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export async function protectPaidApi(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number }
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const authentication = await authenticate(request);
  if ("response" in authentication) return authentication;
  const user = authentication.user;

  const now = Date.now();
  const key = `${scope}:${user.id}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;

  if (bucket.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      response: NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  pruneExpiredBuckets(now);
  return { user };
}

async function authenticate(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) {
    return { response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { response: NextResponse.json({ error: "Authentification indisponible." }, { status: 503 }) };
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
    cache: "no-store"
  });
  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 401 : 503;
    const error = status === 401 ? "Authentification requise." : "Authentification indisponible.";
    return { response: NextResponse.json({ error }, { status }) };
  }

  const user = await response.json() as AuthenticatedUser;
  if (!user || typeof user.id !== "string") {
    return { response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  }
  return { user };
}
function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export const PAID_API_LIMITS = {
  generation: { limit: 10, windowMs: 60_000 },
  agentBuilder: { limit: 2, windowMs: 10 * 60_000 },
  agentWorkflow: { limit: 3, windowMs: 10 * 60_000 },
  forgeAgentRun: { limit: 3, windowMs: 10 * 60_000 }
} as const;
