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

async function authRequest(path: string, body: Record<string, string>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase n'est pas configure. Ajoutez les variables dans .env.local.");
  }

  const response = await fetch(`${url}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || "Authentification impossible.");
  }

  return data;
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
