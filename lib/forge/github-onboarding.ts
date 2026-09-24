import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GITHUB_ONBOARDING_TTL_SECONDS = 10 * 60;
export const GITHUB_ONBOARDING_COOKIE = "forge_github_state";

export type GitHubSetupAction = "install" | "update";
export type GitHubOnboardingState = { version: 1; userId: string; nonce: string; returnOrigin: string; expiresAt: number };
export type GitHubCompletion = GitHubOnboardingState & { installationId: string; setupAction: GitHubSetupAction };

export class GitHubOnboardingError extends Error {
  constructor(readonly code: "INVALID_STATE" | "EXPIRED_STATE" | "INVALID_ORIGIN" | "INVALID_SETUP_ACTION", message: string) {
    super(message);
    this.name = "GitHubOnboardingError";
  }
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function sign<T extends object>(value: T, secret: string) {
  const payload = base64url(JSON.stringify(value));
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function verify<T extends object>(token: string, secret: string): T {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) throw new GitHubOnboardingError("INVALID_STATE", "State GitHub invalide.");
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new GitHubOnboardingError("INVALID_STATE", "State GitHub invalide.");
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T; }
  catch { throw new GitHubOnboardingError("INVALID_STATE", "State GitHub invalide."); }
}

export function normalizeOrigin(value: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new GitHubOnboardingError("INVALID_ORIGIN", "Origine de retour invalide."); }
  if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new GitHubOnboardingError("INVALID_ORIGIN", "Origine de retour invalide.");
  }
  return url.origin;
}

export function resolveGitHubReturnOrigin(requestUrl: string, env: NodeJS.ProcessEnv = process.env) {
  const requestOrigin = normalizeOrigin(new URL(requestUrl).origin);
  const allowed = new Set<string>();
  const add = (value: string | undefined) => { if (value?.trim()) allowed.add(normalizeOrigin(value.trim())); };
  add(env.NEXT_PUBLIC_APP_URL);
  add(env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined);
  add(env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL}` : undefined);
  for (const value of (env.FORGE_GITHUB_ALLOWED_ORIGINS || "").split(",")) add(value);
  const requestHost = new URL(requestOrigin).hostname;
  const isVercelPreview = env.VERCEL_ENV === "preview" && requestHost.endsWith(".vercel.app");
  const isLocalDevelopment = env.NODE_ENV !== "production" && (requestHost === "localhost" || requestHost === "127.0.0.1");
  if (!allowed.has(requestOrigin) && !isVercelPreview && !isLocalDevelopment) throw new GitHubOnboardingError("INVALID_ORIGIN", "Cet environnement ne peut pas initier une connexion GitHub.");
  return requestOrigin;
}

function assertState(value: Partial<GitHubOnboardingState>, now: number) {
  if (value.version !== 1 || !value.userId || !value.nonce || !value.returnOrigin || !value.expiresAt) throw new GitHubOnboardingError("INVALID_STATE", "State GitHub invalide.");
  if (value.expiresAt < now) throw new GitHubOnboardingError("EXPIRED_STATE", "La connexion GitHub a expiré.");
  normalizeOrigin(value.returnOrigin);
  return value as GitHubOnboardingState;
}

export function createGitHubOnboardingState(userId: string, returnOrigin: string, secret: string, now = Date.now()) {
  const value: GitHubOnboardingState = { version: 1, userId, nonce: randomBytes(24).toString("base64url"), returnOrigin: normalizeOrigin(returnOrigin), expiresAt: now + GITHUB_ONBOARDING_TTL_SECONDS * 1000 };
  return { state: sign(value, secret), nonce: value.nonce, maxAge: GITHUB_ONBOARDING_TTL_SECONDS };
}

export function verifyGitHubOnboardingState(state: string, secret: string, now = Date.now()) {
  return assertState(verify<GitHubOnboardingState>(state, secret), now);
}

export function parseGitHubSetupAction(value: string | null): GitHubSetupAction {
  if (value !== "install" && value !== "update") throw new GitHubOnboardingError("INVALID_SETUP_ACTION", "Action GitHub invalide.");
  return value;
}

export function createGitHubCompletion(state: GitHubOnboardingState, installationId: string, setupAction: GitHubSetupAction, secret: string) {
  if (!/^\d+$/.test(installationId)) throw new GitHubOnboardingError("INVALID_STATE", "Installation GitHub invalide.");
  return sign<GitHubCompletion>({ ...state, installationId, setupAction }, secret);
}

export function verifyGitHubCompletion(token: string, secret: string, expected: { userId: string; nonce?: string }, now = Date.now()) {
  const completion = verify<GitHubCompletion>(token, secret);
  assertState(completion, now);
  parseGitHubSetupAction(completion.setupAction);
  if (!/^\d+$/.test(completion.installationId) || completion.userId !== expected.userId || !expected.nonce || completion.nonce !== expected.nonce) {
    throw new GitHubOnboardingError("INVALID_STATE", "La finalisation GitHub n’est pas autorisée.");
  }
  return completion;
}

export function buildGitHubResultUrl(origin: string, status: "complete" | "cancelled" | "failed", completion?: string) {
  const url = new URL("/forge", normalizeOrigin(origin));
  url.searchParams.set("github", status);
  if (status === "complete" && completion) url.searchParams.set("github_completion", completion);
  return url;
}
