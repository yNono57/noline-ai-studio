export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: AuthUser;
};

const SESSION_KEY = "noline-supabase-session";

export function isSupabaseBrowserConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getAuthHeaders(): Record<string, string> {
  const session = getStoredSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function getAuthenticatedHeaders(
  forceRefresh = false
): Promise<Record<string, string>> {
  const session = getStoredSession() || getSupabaseBrowserSession();
  if (!session) return {};

  const validSession = forceRefresh || isSessionExpiring(session)
    ? await refreshSession(session.refresh_token)
    : session;

  return validSession?.access_token
    ? { Authorization: `Bearer ${validSession.access_token}` }
    : {};
}

export async function signUpWithEmail(email: string, password: string) {
  const data = await authRequest("/signup", { email, password });
  const session = normalizeSession(data);
  if (session) storeSession(session);
  return session;
}

export async function signInWithEmail(email: string, password: string) {
  const data = await authRequest("/token?grant_type=password", { email, password });
  const session = normalizeSession(data);
  if (session) storeSession(session);
  return session;
}

export function signOutLocal() {
  storeSession(null);
}

async function refreshSession(refreshToken: string) {
  if (!refreshToken) return null;

  try {
    const data = await authRequest("/token?grant_type=refresh_token", {
      refresh_token: refreshToken
    });
    const session = normalizeSession(data);
    if (session) storeSession(session);
    return session;
  } catch {
    return null;
  }
}

function isSessionExpiring(session: AuthSession) {
  if (!session.expires_at) return false;
  return session.expires_at * 1000 <= Date.now() + 60_000;
}

function getSupabaseBrowserSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "null") as unknown;
      const session = normalizeSession(value);
      if (session) {
        storeSession(session);
        return session;
      }
    } catch {
      // Ignore malformed or unrelated Supabase storage entries.
    }
  }

  return null;
}

async function authRequest(path: string, body: Record<string, string>) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!configuredUrl || !anonKey) {
    throw new Error("Supabase n'est pas configure. Ajoutez les variables dans .env.local.");
  }

  let authUrl: URL;
  try {
    authUrl = new URL(`/auth/v1${path}`, ensureTrailingSlash(configuredUrl));
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL n'est pas une URL valide.");
  }

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      response.ok
        ? "Le service d'authentification a renvoye une reponse non JSON."
        : `Le service d'authentification est inaccessible (HTTP ${response.status}). Verifiez NEXT_PUBLIC_SUPABASE_URL.`
    );
  }

  const data = (await response.json()) as {
    error_description?: string;
    msg?: string;
    message?: string;
  } & Record<string, unknown>;

  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || "Authentification impossible.");
  }

  return data;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeSession(data: unknown): AuthSession | null {
  const candidate = data as Partial<AuthSession> & { user?: AuthUser };
  if (!candidate.access_token || !candidate.refresh_token || !candidate.user) return null;

  return {
    access_token: candidate.access_token,
    refresh_token: candidate.refresh_token,
    expires_at: candidate.expires_at,
    user: candidate.user
  };
}
