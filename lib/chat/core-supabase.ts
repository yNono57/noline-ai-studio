import "server-only";
import { assertSupabaseMutationEnvironment, isMutationMethod } from "../environment-identity";

/** A verified Supabase user and their request-scoped access token. Never service role. */
export type CoreIdentity = { id: string; accessToken: string };

export async function coreSupabase(user: CoreIdentity, path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase n'est pas configuré.");
  if (isMutationMethod(init.method)) assertSupabaseMutationEnvironment();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${user.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    cache: "no-store"
  });
  // Never propagate upstream error bodies (which can contain private row values).
  if (!response.ok) throw new Error(`Core database request failed (${response.status}).`);
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
