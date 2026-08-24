import "server-only";

import { createHmac, createPrivateKey, createSign, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_SECONDS = 10 * 60;

export class GitHubAppError extends Error {
  constructor(readonly code: "CONFIGURATION" | "AUTHORIZATION" | "NOT_FOUND" | "LIMIT" | "UPSTREAM", message: string) {
    super(message);
    this.name = "GitHubAppError";
  }
}

function safeErrorName(error: unknown) {
  if (error instanceof GitHubAppError) return "GitHubAppError";
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof SyntaxError) return "SyntaxError";
  if (error instanceof Error) return "Error";
  return "Unknown";
}

export function logGitHubAuthDiagnostic(stage: string, error?: unknown) {
  if (error === undefined) {
    console.info("[forge-github-auth]", { stage });
    return;
  }
  const nodeCode = (error as { code?: unknown } | null)?.code;
  const errorCode = error instanceof GitHubAppError
    ? error.code
    : typeof nodeCode === "string" && /^ERR_[A-Z0-9_]+$/.test(nodeCode)
      ? nodeCode
      : undefined;
  console.error("[forge-github-auth]", {
    stage,
    errorName: safeErrorName(error),
    ...(errorCode ? { errorCode } : {}),
  });
}

export function getGitHubAppConfig() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  logGitHubAuthDiagnostic("github_private_key_normalization_start");
  let privateKey: string | undefined;
  try {
    privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    logGitHubAuthDiagnostic("github_private_key_normalization_success");
  } catch (error) {
    logGitHubAuthDiagnostic("github_private_key_normalization_failed", error);
    throw error;
  }
  const stateSecret = process.env.GITHUB_APP_STATE_SECRET?.trim();
  if (!appId || !/^\d+$/.test(appId) || !slug || !privateKey || !stateSecret) {
    throw new GitHubAppError("CONFIGURATION", "L’intégration GitHub n’est pas configurée.");
  }
  return { appId, slug, privateKey, stateSecret };
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function createGitHubAppJwt(nowSeconds = Math.floor(Date.now() / 1000)) {
  const config = getGitHubAppConfig();
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: config.appId }));
  const unsigned = `${header}.${payload}`;
  logGitHubAuthDiagnostic("github_private_key_import_start");
  let privateKey;
  try {
    privateKey = createPrivateKey(config.privateKey);
    logGitHubAuthDiagnostic("github_private_key_import_success");
  } catch (error) {
    logGitHubAuthDiagnostic("github_private_key_import_failed", error);
    throw error;
  }
  logGitHubAuthDiagnostic("github_jwt_sign_start");
  let signature: Buffer;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    signature = signer.sign(privateKey);
    logGitHubAuthDiagnostic("github_jwt_sign_success");
  } catch (error) {
    logGitHubAuthDiagnostic("github_jwt_sign_failed", error);
    throw error;
  }
  return `${unsigned}.${base64url(signature)}`;
}

type GitHubState = { userId: string; nonce: string; expiresAt: number };

export function createGitHubState(userId: string) {
  const config = getGitHubAppConfig();
  const value: GitHubState = { userId, nonce: randomBytes(24).toString("base64url"), expiresAt: Date.now() + STATE_TTL_SECONDS * 1000 };
  const payload = base64url(JSON.stringify(value));
  const signature = createHmac("sha256", config.stateSecret).update(payload).digest("base64url");
  return { state: `${payload}.${signature}`, nonce: value.nonce, maxAge: STATE_TTL_SECONDS };
}

export function verifyGitHubState(state: string, expectedNonce: string | undefined, now = Date.now()): GitHubState {
  const config = getGitHubAppConfig();
  const [payload, providedSignature, extra] = state.split(".");
  if (!payload || !providedSignature || extra) throw new GitHubAppError("AUTHORIZATION", "State GitHub invalide.");
  const expectedSignature = createHmac("sha256", config.stateSecret).update(payload).digest("base64url");
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new GitHubAppError("AUTHORIZATION", "State GitHub invalide.");
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new GitHubAppError("AUTHORIZATION", "State GitHub invalide."); }
  const value = parsed as Partial<GitHubState>;
  if (!value.userId || !value.nonce || !value.expiresAt || value.expiresAt < now || !expectedNonce || value.nonce !== expectedNonce) {
    throw new GitHubAppError("AUTHORIZATION", "La connexion GitHub a expiré ou n’est pas valide.");
  }
  return value as GitHubState;
}

export function getGitHubInstallUrl(state: string) {
  const { slug } = getGitHubAppConfig();
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}
