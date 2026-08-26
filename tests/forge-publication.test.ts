export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { createForgeContinuityService, normalizeForgeBranchName } = require("../lib/forge/continuity-foundation.ts");

function artifact(overrides: Record<string, unknown> = {}) {
  return { artifactId: "artifact-p", runId: "run-p", repository: "owner/repo", baseCommitSha: "a".repeat(40), sourceBranch: "main", changedFiles: ["src/app.ts"], additions: 2, deletions: 1, patch: "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new", status: "READY", createdAt: "2026-08-26T00:00:00.000Z", restoreStatus: "RESTORED", publicationStatus: "BRANCHED", restoredAt: "2026-08-26T00:30:00.000Z", restoredRuntimeId: "runtime-p", branchName: "forge/session-p", commitSha: null, pullRequestUrl: null, remoteBranch: null, pullRequestNumber: null, pullRequestTarget: null, publishedAt: null, pullRequestCreatedAt: null, conflictFiles: [], ...overrides };
}
function result(exitCode = 0, stdout = "", stderr = "") { return { stdout, stderr, exitCode, timedOut: false, truncated: false, durationMs: 1 }; }
function harness(options: { artifact?: Record<string, unknown>; commands?: ReturnType<typeof result>[]; remoteSha?: string | null; repository?: string; runtimeStatus?: string; sensitive?: boolean } = {}) {
  let current = artifact(options.sensitive ? { changedFiles: [".env"], patch: "diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n+SECRET=x" } : options.artifact || {});
  const queue = [...(options.commands || [])], commands: Array<{ command: string; args: string[] }> = [], updates: Record<string, unknown>[] = [];
  let pushes = 0, pullRequests = 0;
  const service = createForgeContinuityService({
    async getWorkspace() { return { workspaceId: "workspace-p", projectId: "project-p", conversationId: "conversation-p", repository: options.repository || "owner/repo", branch: "main", baseCommitSha: "a".repeat(40), status: "READY" }; },
    async getRuntime() { return { runtimeId: "runtime-p", status: options.runtimeStatus || "READY", baseCommitSha: "a".repeat(40) }; },
    async getArtifact() { return current; },
    async getRun() { return { runId: "run-p", userId: "user-p", projectId: "project-p", conversationId: "conversation-p", workspaceId: "workspace-p", runtimeId: "runtime-p", status: "COMPLETED", objective: "mission", baseCommitSha: "a".repeat(40), plan: [], finalReport: "done", createdAt: "", startedAt: "", completedAt: "", lastActivityAt: "", error: null }; },
    async updateArtifact(_userId: string, _artifactId: string, update: Record<string, unknown>) { updates.push(update); current = { ...current, ...update }; return current; },
    runtime() { return { async writeFile() {}, async deleteFile() {}, async execute(command: { command: string; args: string[] }) { commands.push(command); if (command.args.includes("push")) pushes += 1; return queue.shift() || result(); }, async getGitStatus() { return { added: [], modified: ["src/app.ts"], deleted: [] }; }, async getGitDiff() { return { added: [], modified: ["src/app.ts"], deleted: [], patch: current.patch, truncated: false }; } }; },
    async preparePush() { return { username: "x-access-token", password: "github-secret", remoteSha: options.remoteSha ?? null }; },
    async createPullRequest() { pullRequests += 1; return { number: 42, url: "https://github.com/owner/repo/pull/42", createdAt: "2026-08-26T02:00:00.000Z" }; },
    now: () => "2026-08-26T02:00:00.000Z",
  });
  return { service, current: () => current, commands, updates, pushes: () => pushes, pullRequests: () => pullRequests };
}

test("A/B branche autorisée depuis le SHA attendu et noms invalides refusés", async () => {
  const target = harness({ artifact: { publicationStatus: "LOCAL", branchName: null }, commands: [result(0, "a".repeat(40)), result(1), result(0)] });
  assert.equal((await target.service.createBranch("user-p", "conversation-p", "artifact-p", "forge/session-safe")).publicationStatus, "BRANCHED");
  for (const name of ["main", "forge/../main", "forge/a b", "forge/x.lock", "forge/x;push"]) assert.throws(() => normalizeForgeBranchName(name), /INVALID_BRANCH/);
});

test("C/I main master et toute forme force push sont impossibles", () => {
  const source = fs.readFileSync("lib/forge/continuity-foundation.ts", "utf8");
  assert.match(source, /main\|master/); assert.doesNotMatch(source, /--force|force-with-lease|reset", "--hard/);
  assert.match(source, /push", "origin"/);
});

test("D commit sans confirmation explicite est refusé", async () => {
  await assert.rejects(() => harness().service.commit("user-p", "conversation-p", "artifact-p", "message", false), /AUTH_REQUIRED/);
});

test("E commit avec fichier sensible est refusé avant Git", async () => {
  const target = harness({ sensitive: true });
  await assert.rejects(() => target.service.commit("user-p", "conversation-p", "artifact-p", "message", true), /SENSITIVE_FILES/);
  assert.equal(target.commands.length, 0);
});

test("F commit valide persiste COMMITTED et le SHA", async () => {
  const sha = "c".repeat(40), target = harness({ commands: [result(0, "forge/session-p"), result(0), result(1), result(0), result(0, sha)] });
  const committed = await target.service.commit("user-p", "conversation-p", "artifact-p", "Forge controlled commit", true);
  assert.equal(committed.publicationStatus, "COMMITTED"); assert.equal(committed.commitSha, sha);
});

test("G push sans confirmation est refusé", async () => {
  const target = harness({ artifact: { publicationStatus: "COMMITTED", commitSha: "c".repeat(40) } });
  await assert.rejects(() => target.service.push("user-p", "conversation-p", "artifact-p", false), /AUTH_REQUIRED/);
});

test("H push mocké valide persiste PUSHED sans exposer le secret", async () => {
  const sha = "c".repeat(40), target = harness({ artifact: { publicationStatus: "COMMITTED", commitSha: sha }, commands: [result(0, "forge/session-p"), result(0, sha), result(0)] });
  const pushed = await target.service.push("user-p", "conversation-p", "artifact-p", true);
  assert.equal(pushed.publicationStatus, "PUSHED"); assert.equal(pushed.remoteBranch, "forge/session-p"); assert.equal(target.pushes(), 1);
  assert.doesNotMatch(JSON.stringify(pushed), /github-secret|x-access-token/);
});

test("J remote divergent est refusé sans commande push", async () => {
  const sha = "c".repeat(40), target = harness({ artifact: { publicationStatus: "COMMITTED", commitSha: sha }, remoteSha: "d".repeat(40), commands: [result(0, "forge/session-p"), result(0, sha)] });
  await assert.rejects(() => target.service.push("user-p", "conversation-p", "artifact-p", true), /REMOTE_CHANGED/);
  assert.equal(target.pushes(), 0);
});

test("K/L PR avant push ou sans confirmation est refusée", async () => {
  await assert.rejects(() => harness().service.createPullRequest("user-p", "conversation-p", "artifact-p", "PR", "body", true), /PR_FAILED/);
  const pushed = harness({ artifact: { publicationStatus: "PUSHED", commitSha: "c".repeat(40), remoteBranch: "forge/session-p" } });
  await assert.rejects(() => pushed.service.createPullRequest("user-p", "conversation-p", "artifact-p", "PR", "body", false), /AUTH_REQUIRED/);
});

test("M PR après push persiste numéro URL cible et date", async () => {
  const target = harness({ artifact: { publicationStatus: "PUSHED", commitSha: "c".repeat(40), remoteBranch: "forge/session-p" } });
  const pr = await target.service.createPullRequest("user-p", "conversation-p", "artifact-p", "Forge PR", "Description", true);
  assert.equal(pr.publicationStatus, "PR_CREATED"); assert.equal(pr.pullRequestNumber, 42); assert.equal(pr.pullRequestTarget, "main"); assert.match(pr.pullRequestUrl, /pull\/42/); assert.ok(pr.pullRequestCreatedAt);
});

test("N/O doubles requêtes push et PR restent idempotentes", async () => {
  const sha = "c".repeat(40), pushTarget = harness({ artifact: { publicationStatus: "COMMITTED", commitSha: sha }, commands: [result(0, "forge/session-p"), result(0, sha), result(0)] });
  await pushTarget.service.push("user-p", "conversation-p", "artifact-p", true); await pushTarget.service.push("user-p", "conversation-p", "artifact-p", true); assert.equal(pushTarget.pushes(), 1);
  const prTarget = harness({ artifact: { publicationStatus: "PUSHED", commitSha: sha, remoteBranch: "forge/session-p" } });
  await prTarget.service.createPullRequest("user-p", "conversation-p", "artifact-p", "PR", "Body", true); await prTarget.service.createPullRequest("user-p", "conversation-p", "artifact-p", "PR", "Body", true); assert.equal(prTarget.pullRequests(), 1);
});

test("P/S refresh et runtime expiré conservent les métadonnées de publication", () => {
  const stored = artifact({ publicationStatus: "PR_CREATED", remoteBranch: "forge/session-p", pullRequestNumber: 42, pullRequestUrl: "https://github.com/owner/repo/pull/42" });
  const historySource = fs.readFileSync("lib/forge/continuity-runtime.ts", "utf8");
  assert.equal(JSON.parse(JSON.stringify(stored)).pullRequestNumber, 42); assert.match(historySource, /listProjectAgentRunArtifacts/); assert.doesNotMatch(historySource.split("listForgeContinuityArtifacts")[1], /getRuntime/);
});

test("Q ownership invalide ne déclenche aucune opération", async () => {
  const target = harness({ repository: "other/repo" });
  await assert.rejects(() => target.service.push("user-p", "conversation-p", "artifact-p", true), /OWNERSHIP_DENIED/); assert.equal(target.commands.length, 0);
});

test("R provider et routes gardent tokens serveur-only et hors payload client", () => {
  const provider = fs.readFileSync("lib/forge/github-publication-provider.ts", "utf8"), client = fs.readFileSync("lib/forge/forge-client.ts", "utf8"), ui = fs.readFileSync("components/ForgeArtifactHistory.tsx", "utf8");
  assert.match(provider, /import "server-only"/); assert.match(provider, /contents: "write"/); assert.doesNotMatch(client + ui, /GITHUB_APP_PRIVATE_KEY|installation.*token|github-secret/i);
});

test("T/U restauration et completion gates restent couvertes sans outils Git distants modèle", () => {
  const continuity = fs.readFileSync("tests/forge-continuity.test.ts", "utf8"), runner = fs.readFileSync("tests/forge-agent-runner.test.ts", "utf8"), agent = fs.readFileSync("lib/forge/agent-foundation.ts", "utf8");
  assert.match(continuity, /restaure un artifact READY/); assert.match(runner, /validation npm non nulle impose correction/); assert.doesNotMatch(agent, /pushBranch|createPullRequest/);
});