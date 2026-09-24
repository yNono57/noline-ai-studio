/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
export {};
const {
  buildGitHubResultUrl,
  createGitHubCompletion,
  createGitHubOnboardingState,
  parseGitHubSetupAction,
  resolveGitHubReturnOrigin,
  verifyGitHubCompletion,
  verifyGitHubOnboardingState,
} = require("../lib/forge/github-onboarding.ts");

const secret = "test-secret-that-is-never-used-outside-tests";
const now = Date.parse("2026-09-24T10:00:00.000Z");

test("install state binds the NOLINE user and Preview origin", () => {
  const generated = createGitHubOnboardingState("user-a", "https://preview.example.test", secret, now);
  const state = verifyGitHubOnboardingState(generated.state, secret, now + 1);
  assert.equal(state.userId, "user-a");
  assert.equal(state.returnOrigin, "https://preview.example.test");
  assert.equal(state.nonce, generated.nonce);
});

test("expired, altered and missing states are rejected", () => {
  const generated = createGitHubOnboardingState("user-a", "https://preview.example.test", secret, now);
  assert.throws(() => verifyGitHubOnboardingState(generated.state, secret, now + 11 * 60_000), /expiré/);
  assert.throws(() => verifyGitHubOnboardingState(`${generated.state}x`, secret, now), /invalide/);
  assert.throws(() => verifyGitHubOnboardingState("", secret, now), /invalide/);
});

test("only install and update setup actions are accepted", () => {
  assert.equal(parseGitHubSetupAction("install"), "install");
  assert.equal(parseGitHubSetupAction("update"), "update");
  assert.throws(() => parseGitHubSetupAction("cancel"), /invalide/);
  assert.throws(() => parseGitHubSetupAction(null), /invalide/);
});

test("completion requires the authenticated user and origin nonce", () => {
  const generated = createGitHubOnboardingState("user-a", "https://preview.example.test", secret, now);
  const state = verifyGitHubOnboardingState(generated.state, secret, now);
  const token = createGitHubCompletion(state, "156064094", "update", secret);
  assert.equal(verifyGitHubCompletion(token, secret, { userId: "user-a", nonce: generated.nonce }, now).installationId, "156064094");
  assert.throws(() => verifyGitHubCompletion(token, secret, { userId: "user-b", nonce: generated.nonce }, now), /autorisée/);
  assert.throws(() => verifyGitHubCompletion(token, secret, { userId: "user-a", nonce: "wrong" }, now), /autorisée/);
});

test("return origins reject open redirects and accept exact production/Preview origins", () => {
  assert.equal(resolveGitHubReturnOrigin("https://nolinestudio.fr/api/forge/github/install", { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://nolinestudio.fr" }), "https://nolinestudio.fr");
  assert.equal(resolveGitHubReturnOrigin("https://safe-preview.vercel.app/api/forge/github/install", { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "safe-preview.vercel.app" }), "https://safe-preview.vercel.app");
  assert.throws(() => resolveGitHubReturnOrigin("https://evil.example/api/forge/github/install", { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://nolinestudio.fr" }), /ne peut pas initier/);
  assert.throws(() => buildGitHubResultUrl("https://nolinestudio.fr.evil.example/path", "failed"), /invalide/);
});

test("callback result targets only the signed origin", () => {
  assert.equal(buildGitHubResultUrl("https://preview.example.test", "cancelled").toString(), "https://preview.example.test/forge?github=cancelled");
  assert.match(buildGitHubResultUrl("https://preview.example.test", "complete", "signed").toString(), /^https:\/\/preview\.example\.test\/forge\?github=complete&github_completion=signed$/);
});

test("routes preserve authentication, selected-only verification and ownership checks", () => {
  const install = fs.readFileSync("app/api/forge/github/install/route.ts", "utf8");
  const callback = fs.readFileSync("app/api/forge/github/callback/route.ts", "utf8");
  const complete = fs.readFileSync("app/api/forge/github/complete/route.ts", "utf8");
  const provider = fs.readFileSync("lib/forge/github-provider.ts", "utf8");
  const store = fs.readFileSync("lib/forge/github-store.ts", "utf8");
  assert.match(install, /authenticateForge\(request\)/);
  assert.match(install, /getGitHubInstallUrl\(generated\.state\)/);
  assert.match(callback, /parseGitHubSetupAction/);
  assert.match(callback, /setup_action.*cancel/);
  assert.match(callback, /verifySelectedInstallation/);
  assert.doesNotMatch(callback, /upsertGitHubConnection/);
  assert.match(complete, /authenticateForge\(request\)/);
  assert.match(complete, /verifyGitHubCompletion/);
  assert.match(complete, /verifySelectedInstallation/);
  assert.match(provider, /repository_selection/);
  assert.match(provider, /repositorySelection !== "selected"/);
  assert.match(store, /GITHUB_INSTALLATION_OWNERSHIP_CONFLICT/);
});

test("Forge UI exposes progress, cancellation and callback failure recovery", () => {
  const ui = fs.readFileSync("components/ForgeGitHubPanel.tsx", "utf8");
  assert.match(ui, /Autorisation GitHub en cours/);
  assert.match(ui, /Autorisation GitHub annulée/);
  assert.match(ui, /callback GitHub a échoué/);
  assert.match(ui, /completeGitHubInstall/);
  assert.doesNotMatch(ui, /Failed to fetch/);
});
