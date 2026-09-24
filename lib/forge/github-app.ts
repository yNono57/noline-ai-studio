import "server-only";

import { createPrivateKey, createSign } from "node:crypto";
import { createGitHubOnboardingState, verifyGitHubOnboardingState } from "./github-onboarding";

export class GitHubAppError extends Error {
  constructor(readonly code: "CONFIGURATION" | "AUTHORIZATION" | "NOT_FOUND" | "LIMIT" | "UPSTREAM", message: string) {
    super(message);
    this.name = "GitHubAppError";
  }
}

export function getGitHubAppConfig() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
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
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(createPrivateKey(config.privateKey));
  return `${unsigned}.${base64url(signature)}`;
}

export function createGitHubState(userId: string, returnOrigin: string) {
  return createGitHubOnboardingState(userId, returnOrigin, getGitHubAppConfig().stateSecret);
}

export function verifyGitHubState(state: string, now = Date.now()) {
  return verifyGitHubOnboardingState(state, getGitHubAppConfig().stateSecret, now);
}

export function getGitHubInstallUrl(state: string) {
  const { slug } = getGitHubAppConfig();
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}
