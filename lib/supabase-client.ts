import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email?: string };
export type AuthSession = { access_token: string; refresh_token: string; expires_at?: number; user: AuthUser };

const SESSION_KEY = "noline-supabase-session";
let browserClient: SupabaseClient | null = null;

export const SAFE_SIGNUP_MESSAGE = "Si cette adresse peut être utilisée pour créer un compte, un email de confirmation vient de vous être envoyé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.";
export const SAFE_RESET_MESSAGE = "Si un compte correspond à cette adresse, un email de réinitialisation vient de vous être envoyé.";
export const INVALID_LOGIN_MESSAGE = "Email ou mot de passe incorrect. Si vous aviez déjà un compte, vous pouvez réinitialiser votre mot de passe.";

export function isSupabaseBrowserConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase n'est pas configuré.");
  browserClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true }
  });
  return browserClient;
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch { return null; }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("noline-auth-session", { detail: session }));
}

export function getAuthHeaders(): Record<string, string> {
  const session = getStoredSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function getAuthenticatedHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const session = getStoredSession() || getSupabaseBrowserSession();
  if (!session) return {};
  const validSession = forceRefresh || isSessionExpiring(session) ? await refreshSession(session.refresh_token) : session;
  return validSession?.access_token ? { Authorization: `Bearer ${validSession.access_token}` } : {};
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.signUp({ email, password });
  if (error) throw error;
  const session = normalizeSession(data.session);
  if (session) storeSession(session);
  return { session, confirmationRequired: !data.session };
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = normalizeSession(data.session);
  if (session) storeSession(session);
  return session;
}

export async function requestPasswordReset(email: string, origin = window.location.origin) {
  const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
    redirectTo: buildPasswordRecoveryRedirect(origin)
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}

export async function getRecoverySession() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onPasswordRecovery(callback: (session: Session | null) => void) {
  const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutLocal() {
  storeSession(null);
  if (isSupabaseBrowserConfigured()) await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
}

export function buildPasswordRecoveryRedirect(origin: string) {
  return `${origin.replace(/\/$/, "")}/auth/reset-password`;
}

export function isInvalidLoginError(error: unknown) {
  return error instanceof Error && /invalid login credentials/i.test(error.message);
}

async function refreshSession(refreshToken: string) {
  if (!refreshToken) return null;
  try {
    const { data, error } = await getSupabaseBrowserClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error) return null;
    const session = normalizeSession(data.session);
    if (session) storeSession(session);
    return session;
  } catch { return null; }
}

function isSessionExpiring(session: AuthSession) {
  return Boolean(session.expires_at && session.expires_at * 1000 <= Date.now() + 60_000);
}

function getSupabaseBrowserSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const session = normalizeSession(JSON.parse(window.localStorage.getItem(key) || "null"));
      if (session) { storeSession(session); return session; }
    } catch { /* Ignore malformed storage entries. */ }
  }
  return null;
}

function normalizeSession(data: unknown): AuthSession | null {
  const candidate = data as Partial<AuthSession> & { user?: AuthUser };
  if (!candidate?.access_token || !candidate.refresh_token || !candidate.user) return null;
  return { access_token: candidate.access_token, refresh_token: candidate.refresh_token, expires_at: candidate.expires_at, user: candidate.user };
}
