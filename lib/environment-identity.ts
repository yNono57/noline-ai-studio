export const SUPABASE_PROJECTS = {
  production: "wkjdsdkoidkmheusbwop",
  staging: "dlyjuuxfzoeodonvqfzp",
} as const;

export type AppEnvironment = "production" | "preview" | "development" | "test" | "unknown";
type EnvironmentSource = Partial<Record<"VERCEL_ENV" | "NODE_ENV" | "NOLINE_APP_ENVIRONMENT" | "NOLINE_DEVELOPMENT_SUPABASE_PROJECT_REF" | "NEXT_PUBLIC_SUPABASE_URL", string | undefined>>;

export class EnvironmentIsolationError extends Error {
  readonly code = "ENVIRONMENT_ISOLATION";
  constructor(message = "La configuration de l'environnement interdit cette mutation.") {
    super(message);
    this.name = "EnvironmentIsolationError";
  }
}

export function extractSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(url).hostname.toLowerCase());
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function resolveAppEnvironment(env: EnvironmentSource = process.env): AppEnvironment {
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.VERCEL_ENV === "development") return "development";
  if (env.NOLINE_APP_ENVIRONMENT === "production") return "production";
  if (env.NOLINE_APP_ENVIRONMENT === "staging" || env.NOLINE_APP_ENVIRONMENT === "preview") return "preview";
  if (env.NOLINE_APP_ENVIRONMENT === "development") return "development";
  if (env.NODE_ENV === "test") return "test";
  if (env.NOLINE_APP_ENVIRONMENT === "test") return "test";
  if (env.NODE_ENV === "development") return "development";
  return "unknown";
}

export function inspectEnvironmentIdentity(env: EnvironmentSource = process.env) {
  const appEnvironment = resolveAppEnvironment(env);
  const projectRef = extractSupabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const developmentRef = env.NOLINE_DEVELOPMENT_SUPABASE_PROJECT_REF?.trim() || null;
  const expectedProjectRef = appEnvironment === "production"
    ? SUPABASE_PROJECTS.production
    : appEnvironment === "preview"
      ? SUPABASE_PROJECTS.staging
      : appEnvironment === "development"
        ? developmentRef
        : null;
  const testFixture = appEnvironment === "test" && Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.endsWith(".invalid"));
  const allowed = testFixture || Boolean(
    expectedProjectRef &&
    projectRef === expectedProjectRef &&
    !(appEnvironment === "development" && projectRef === SUPABASE_PROJECTS.production)
  );
  return {
    appEnvironment,
    vercelEnvironment: env.VERCEL_ENV || null,
    supabaseProjectRef: projectRef,
    expectedProjectRef,
    mutationGuard: allowed ? "PASS" as const : "REJECTED" as const,
  };
}

export function assertSupabaseMutationEnvironment(env: EnvironmentSource = process.env) {
  const identity = inspectEnvironmentIdentity(env);
  if (identity.mutationGuard !== "PASS") throw new EnvironmentIsolationError();
  return identity;
}

export function isMutationMethod(method: string | undefined) {
  return !["GET", "HEAD", "OPTIONS"].includes((method || "GET").toUpperCase());
}
