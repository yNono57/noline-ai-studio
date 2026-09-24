export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { createForgeContinuityService } = require("../lib/forge/continuity-foundation.ts");
const { getForgeArtifactPublicationBlocker } = require("../lib/forge/artifact-publication.ts");

const patch = "diff --git a/forge-v15-live-test.txt b/forge-v15-live-test.txt\nnew file mode 100644\n--- /dev/null\n+++ b/forge-v15-live-test.txt\n@@ -0,0 +1 @@\n+NØLINE Forge V1.5 live publication test\n";
function artifact(overrides: Record<string, unknown> = {}) {
  return { artifactId: "artifact-live", runId: "run-live", repository: "owner/repo", baseCommitSha: "a".repeat(40), sourceBranch: "main", changedFiles: ["forge-v15-live-test.txt"], additions: 1, deletions: 0, patch, status: "READY", createdAt: "2026-08-27T00:00:00.000Z", restoreStatus: "AVAILABLE", publicationStatus: "LOCAL", restoredAt: null, restoredRuntimeId: null, branchName: null, commitSha: null, pullRequestUrl: null, remoteBranch: null, pullRequestNumber: null, pullRequestTarget: null, publishedAt: null, pullRequestCreatedAt: null, conflictFiles: [], ...overrides };
}
function result(exitCode = 0, stdout = "", stderr = "") { return { stdout, stderr, exitCode, timedOut: false, truncated: false, durationMs: 1 }; }
function harness(options: { artifact?: Record<string, unknown>; runtimeStatus?: string; commands?: ReturnType<typeof result>[]; status?: { added: string[]; modified: string[]; deleted: string[] }; diff?: Record<string, unknown> } = {}) {
  let current = artifact(options.artifact || {}), writes = 0, pullRequests = 0;
  const queue = [...(options.commands || [])], commands: Array<{ args: string[] }> = [];
  const service = createForgeContinuityService({
    async getWorkspace() { return { workspaceId: "workspace-live", projectId: "project-live", conversationId: "conversation-live", repository: "owner/repo", branch: "main", baseCommitSha: "a".repeat(40), status: "READY" }; },
    async getRuntime() { return { runtimeId: "runtime-live", status: options.runtimeStatus || "READY", baseCommitSha: "a".repeat(40) }; },
    async getArtifact() { return current; },
    async getRun() { return { runId: "run-live", userId: "user-live", projectId: "project-live", conversationId: "conversation-live", workspaceId: "workspace-live", runtimeId: "runtime-original", status: "COMPLETED", objective: "live", baseCommitSha: "a".repeat(40), plan: [], finalReport: "done", createdAt: "", startedAt: "", completedAt: "", lastActivityAt: "", error: null }; },
    async updateArtifact(_userId: string, _artifactId: string, update: Record<string, unknown>) { current = { ...current, ...update }; return current; },
    runtime() { return { async writeFile() { writes += 1; }, async deleteFile() {}, async execute(command: { args: string[] }) { commands.push(command); return queue.shift() || result(); }, async getGitStatus() { return options.status || { added: ["forge-v15-live-test.txt"], modified: [], deleted: [] }; }, async getGitDiff() { return options.diff || { added: ["forge-v15-live-test.txt"], modified: [], deleted: [], patch, truncated: false }; } }; },
    async preparePush() { return { username: "x-access-token", password: "server-secret", remoteSha: null }; },
    async createPullRequest() { pullRequests += 1; return { number: 17, url: "https://github.com/owner/repo/pull/17", createdAt: "2026-08-27T01:00:00.000Z" }; },
    now: () => "2026-08-27T01:00:00.000Z",
  });
  return { service, current: () => current, commands, writes: () => writes, pullRequests: () => pullRequests };
}

test("artifact historique LOCAL reconnait le working tree exact sans réappliquer le patch", async () => {
  const target = harness();
  const restored = await target.service.restore("user-live", "conversation-live", "artifact-live");
  assert.equal(restored.restoreStatus, "RESTORED");
  assert.equal(restored.restoredRuntimeId, "runtime-live");
  assert.equal(target.writes(), 0);
  assert.equal(restored.patch, patch);
});

test("working tree différent reste CONFLICT sans écrasement", async () => {
  const target = harness({ diff: { added: ["forge-v15-live-test.txt"], modified: [], deleted: [], patch: `${patch}+unexpected\n`, truncated: false } });
  const restored = await target.service.restore("user-live", "conversation-live", "artifact-live");
  assert.equal(restored.restoreStatus, "CONFLICT");
  assert.equal(target.writes(), 0);
});

test("artifact RESTORED dans un ancien runtime doit être restauré dans le runtime actif", async () => {
  const target = harness({ artifact: { restoreStatus: "RESTORED", restoredRuntimeId: "runtime-expired" } });
  await assert.rejects(() => target.service.createBranch("user-live", "conversation-live", "artifact-live", "forge/live"), /runtime actif/);
  assert.equal(target.commands.length, 0);
});

test("retry de branche réconcilie une branche locale déjà créée et active", async () => {
  const target = harness({ artifact: { restoreStatus: "RESTORED", restoredRuntimeId: "runtime-live" }, commands: [result(0, "a".repeat(40)), result(0), result(0, "forge/live")] });
  const branched = await target.service.createBranch("user-live", "conversation-live", "artifact-live", "forge/live");
  assert.equal(branched.publicationStatus, "BRANCHED");
  assert.equal(branched.branchName, "forge/live");
  assert.equal(target.commands.some((command) => command.args.includes("switch")), false);
});

test("création de PR PUSHED reste disponible après expiration du runtime", async () => {
  const target = harness({ runtimeStatus: "EXPIRED", artifact: { publicationStatus: "PUSHED", remoteBranch: "forge/live", commitSha: "c".repeat(40) } });
  const created = await target.service.createPullRequest("user-live", "conversation-live", "artifact-live", "Forge live", "Controlled test", true);
  assert.equal(created.publicationStatus, "PR_CREATED");
  assert.equal(created.pullRequestNumber, 17);
  assert.equal(target.pullRequests(), 1);
});

test("éligibilité refuse données sensibles, patch trop grand et métadonnées incohérentes", () => {
  assert.match(getForgeArtifactPublicationBlocker(artifact({ changedFiles: [".env"] })), /sensible/);
  assert.match(getForgeArtifactPublicationBlocker(artifact({ patch: "x".repeat(200001) })), /200000/);
  assert.match(getForgeArtifactPublicationBlocker(artifact({ baseCommitSha: "missing" })), /SHA/);
  assert.match(getForgeArtifactPublicationBlocker(artifact({ repository: "invalid" })), /repository/);
  assert.equal(getForgeArtifactPublicationBlocker(artifact()), null);
});

test("artifact créé est relié au runtime producteur et UI expose la progression contrôlée", () => {
  const store = fs.readFileSync("lib/forge/agent-store.ts", "utf8");
  const ui = fs.readFileSync("components/ForgeArtifactHistory.tsx", "utf8");
  const workspace = fs.readFileSync("components/ForgeWorkspace.tsx", "utf8");
  assert.match(store, /restore_status: "RESTORED"/);
  assert.match(store, /restored_runtime_id: run\.runtimeId/);
  assert.match(ui, /artifact\.restoredRuntimeId === runtimeId/);
  assert.match(ui, /conversationId, refreshKey/);
  assert.match(workspace, /refreshKey=\{agentPayload\?\.artifact\?\.artifactId/);
  assert.match(ui, /Runtime requis/);
  for (const label of ["Créer une branche", "Créer un commit", "Push vers GitHub", "Créer une Pull Request"]) assert.match(ui, new RegExp(label));
  assert.match(workspace, /publication contrôlée/);
  assert.doesNotMatch(workspace, /GitHub · lecture seule/);
});

test("confirmations et protections distantes restent dans le workflow existant", () => {
  const source = fs.readFileSync("lib/forge/continuity-foundation.ts", "utf8");
  for (const action of ["créer le commit", "push vers GitHub", "créer la Pull Request"]) assert.match(source, new RegExp(`requireConfirmation\\(confirmed, "${action}"`));
  assert.match(source, /main\|master/);
  assert.doesNotMatch(source, /--force|force-with-lease|reset", "--hard/);
});