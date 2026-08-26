export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { assertContinuityPatchSafe, createForgeContinuityService, normalizeForgeBranchName } = require("../lib/forge/continuity-foundation.ts");

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    artifactId: "artifact-a", runId: "run-a", repository: "owner/repo", baseCommitSha: "a".repeat(40), sourceBranch: "main",
    changedFiles: ["src/app.ts"], additions: 1, deletions: 1,
    patch: "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new",
    status: "READY", createdAt: "2026-08-26T00:00:00.000Z", restoreStatus: "AVAILABLE", publicationStatus: "LOCAL",
    restoredAt: null, restoredRuntimeId: null, branchName: null, commitSha: null, pullRequestUrl: null, conflictFiles: [], ...overrides,
  };
}
function result(exitCode = 0, stdout = "", stderr = "") { return { stdout, stderr, exitCode, timedOut: false, truncated: false, durationMs: 1 }; }
function harness(options: { artifact?: Record<string, unknown> | null; runConversation?: string; workspaceRepository?: string; runtimeStatus?: string; commands?: Array<Record<string, unknown>>; initialStatus?: Record<string, unknown>; status?: Record<string, unknown>; diff?: Record<string, unknown> } = {}) {
  let current = options.artifact === null ? null : artifact(options.artifact);
  const commands: Array<Record<string, unknown>> = [], writes: Array<{ path: string; content: string }> = [], deletes: string[] = [], updates: Record<string, unknown>[] = [];
  const queue = [...(options.commands || [])];
  let statusCalls = 0;
  const service = createForgeContinuityService({
    async getWorkspace() { return { workspaceId: "workspace-a", projectId: "project-a", conversationId: "conversation-a", repository: options.workspaceRepository || "owner/repo", branch: "main", baseCommitSha: "a".repeat(40), status: "READY" }; },
    async getRuntime() { return { runtimeId: "runtime-new", status: options.runtimeStatus || "READY", baseCommitSha: "a".repeat(40) }; },
    async getArtifact() { return current; },
    async getRun() { return { runId: "run-a", userId: "user-a", projectId: "project-a", conversationId: options.runConversation || "conversation-a", workspaceId: "workspace-old", runtimeId: "runtime-old", status: "COMPLETED", objective: "mission", baseCommitSha: "a".repeat(40), plan: [], finalReport: "done", createdAt: "", startedAt: "", completedAt: "", lastActivityAt: "", error: null }; },
    async updateArtifact(_userId: string, _artifactId: string, update: Record<string, unknown>) { updates.push(update); current = { ...(current as object), ...update } as ReturnType<typeof artifact>; return current; },
    runtime() { return {
      async writeFile(path: string, patch: string) { writes.push({ path, content: patch }); },
      async deleteFile(path: string) { deletes.push(path); },
      async execute(command: Record<string, unknown>) { commands.push(command); return queue.shift() || result(); },
      async getGitStatus() { statusCalls += 1; return statusCalls === 1 ? (options.initialStatus || { added: [], modified: [], deleted: [] }) : (options.status || { added: [], modified: ["src/app.ts"], deleted: [] }); },
      async getGitDiff() { return options.diff || { added: [], modified: ["src/app.ts"], deleted: [], patch: (current as Record<string, unknown>).patch, truncated: false }; },
    }; },
    async getPushCredential() { return { username: "x-access-token", password: "secret-token" }; },
    async createPullRequest() { return { url: "https://github.com/owner/repo/pull/1" }; },
    now: () => "2026-08-26T01:00:00.000Z",
  });
  return { service, artifact: () => current, commands, writes, deletes, updates };
}

test("V1.5 restaure un artifact READY depuis Supabase dans un nouveau runtime et vérifie status/diff", async () => {
  const target = harness({ commands: [result(0, "a".repeat(40)), result(0), result(0)] });
  const restored = await target.service.restore("user-a", "conversation-a", "artifact-a");
  assert.equal(restored.restoreStatus, "RESTORED");
  assert.equal(restored.restoredRuntimeId, "runtime-new");
  assert.equal(target.writes[0]?.content, artifact().patch);
  assert.deepEqual(target.commands.map((item) => item.args), [["rev-parse", "HEAD"], ["apply", "--check", "--whitespace=nowarn", ".noline/restore-artifact-a.patch"], ["apply", "--whitespace=nowarn", ".noline/restore-artifact-a.patch"]]);
  assert.deepEqual(target.deletes, [".noline/restore-artifact-a.patch"]);
  assert.equal(target.artifact()?.patch, artifact().patch);
});

test("runtime précédent détruit et nouveau runtime ne changent pas l’ownership de l’artifact", async () => {
  const target = harness({ commands: [result(0, "a".repeat(40)), result(0), result(0)] });
  await target.service.restore("user-a", "conversation-a", "artifact-a");
  assert.equal(target.artifact()?.runId, "run-a");
  assert.equal(target.artifact()?.restoredRuntimeId, "runtime-new");
});

test("mauvais repository et ownership invalide sont refusés avant écriture", async () => {
  const repository = harness({ workspaceRepository: "other/repo" });
  await assert.rejects(() => repository.service.restore("user-a", "conversation-a", "artifact-a"), /non autorisé/);
  assert.equal(repository.writes.length, 0);
  const ownership = harness({ runConversation: "conversation-other" });
  await assert.rejects(() => ownership.service.restore("user-a", "conversation-a", "artifact-a"), /non autorisé/);
  assert.equal(ownership.writes.length, 0);
});

test("patch sensible ou hors repository est refusé", () => {
  assert.throws(() => assertContinuityPatchSafe(artifact({ changedFiles: [".env"] })), /sensible/);
  assert.throws(() => assertContinuityPatchSafe(artifact({ changedFiles: ["../outside.ts"] })), /hors repository/);
  assert.throws(() => assertContinuityPatchSafe(artifact({ patch: "diff --git a/../outside b/../outside" })), /hors repository/);
});

test("patch non applicable devient CONFLICT sans application ni perte du patch", async () => {
  const target = harness({ commands: [result(0, "a".repeat(40)), result(1, "", "error: patch failed: src/app.ts:1")] });
  const restored = await target.service.restore("user-a", "conversation-a", "artifact-a");
  assert.equal(restored.restoreStatus, "CONFLICT");
  assert.deepEqual(restored.conflictFiles, ["src/app.ts"]);
  assert.equal(target.commands.some((item) => (item.args as string[])[1] === "--whitespace=nowarn" && (item.args as string[])[0] === "apply" && !(item.args as string[]).includes("--check")), false);
  assert.equal(restored.patch, artifact().patch);
});

test("working tree déjà modifié est refusé avant écriture ou application", async () => {
  const target = harness({ initialStatus: { added: [], modified: ["local.ts"], deleted: [] } });
  const restored = await target.service.restore("user-a", "conversation-a", "artifact-a");
  assert.equal(restored.restoreStatus, "CONFLICT");
  assert.deepEqual(restored.conflictFiles, ["local.ts"]);
  assert.equal(target.commands.length, 0);
  assert.equal(target.writes.length, 0);
});

test("base SHA différente exige une confirmation contrôlée avant application", async () => {
  const target = harness({ commands: [result(0, "b".repeat(40)), result(0)] });
  const conflicted = await target.service.restore("user-a", "conversation-a", "artifact-a");
  assert.equal(conflicted.restoreStatus, "CONFLICT");
  assert.equal(target.commands.length, 2);
  const approved = harness({ commands: [result(0, "b".repeat(40)), result(0), result(0)] });
  assert.equal((await approved.service.restore("user-a", "conversation-a", "artifact-a", true)).restoreStatus, "RESTORED");
});

test("artifact EMPTY se restaure sans commande Git", async () => {
  const target = harness({ artifact: { status: "EMPTY", patch: "", changedFiles: [] } });
  assert.equal((await target.service.restore("user-a", "conversation-a", "artifact-a")).restoreStatus, "RESTORED");
  assert.equal(target.commands.length, 0);
});

test("création de branche valide reste locale et refuse branche existante", async () => {
  const target = harness({ artifact: { restoreStatus: "RESTORED" }, commands: [result(0, "a".repeat(40)), result(1), result(0)] });
  const branched = await target.service.createBranch("user-a", "conversation-a", "artifact-a", "forge/session-safe");
  assert.equal(branched.publicationStatus, "BRANCHED");
  assert.equal(target.commands.some((item) => (item.args as string[]).includes("push")), false);
  assert.equal(normalizeForgeBranchName("forge/session-safe"), "forge/session-safe");
  assert.throws(() => normalizeForgeBranchName("main"), /forge/);
});

test("commit, push et PR exigent chacun une confirmation explicite", async () => {
  const target = harness();
  await assert.rejects(() => target.service.commit("user-a", "conversation-a", "artifact-a", "message", false), /Confirmation explicite/);
  await assert.rejects(() => target.service.push("user-a", "conversation-a", "artifact-a", false), /Confirmation explicite/);
  await assert.rejects(() => target.service.createPullRequest("user-a", "conversation-a", "artifact-a", "title", false), /Confirmation explicite/);
  assert.equal(target.commands.length, 0);
});

test("workflow ne contient ni force push, ni reset hard, ni outil Git exposé au modèle", () => {
  const continuity = fs.readFileSync("lib/forge/continuity-foundation.ts", "utf8");
  const agent = fs.readFileSync("lib/forge/agent-model.ts", "utf8");
  assert.doesNotMatch(continuity, /reset\s+--hard|push[^\n]*--force|force-with-lease/);
  assert.doesNotMatch(agent, /git_commit|git_push|git_branch|git_apply/);
  assert.match(continuity, /main\|master/);
});

test("UI conserve voir/télécharger et expose discrètement la continuité", () => {
  const ui = fs.readFileSync("components/ForgeArtifactHistory.tsx", "utf8");
  for (const label of ["Travail précédent disponible", "Voir", "Télécharger", "Restaurer", "Créer une branche", "Créer un commit", "Push vers GitHub", "Créer une Pull Request", "Conflit de restauration"]) assert.match(ui, new RegExp(label));
});

test("migration V1.5 est additive et borne les états déterministes", () => {
  const sql = fs.readFileSync("supabase/migrations/20260826_forge_v15_continuity.sql", "utf8");
  for (const state of ["AVAILABLE", "RESTORING", "RESTORED", "CONFLICT", "FAILED", "LOCAL", "BRANCHED", "COMMITTED", "PUSHED", "PR_CREATED"]) assert.match(sql, new RegExp(state));
  assert.doesNotMatch(sql, /drop table|truncate/i);
});
