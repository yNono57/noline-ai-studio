import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { classifyForgeGitFailure, createForgeContinuityService, sanitizeForgeGitOutput } from "../lib/forge/continuity-foundation";

type CommandResult = { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; truncated: boolean; durationMs: number };
const cleanGitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" };

function runGit(cwd: string, args: string[]): CommandResult {
  const started = Date.now();
  const result = spawnSync("git", args, { cwd, env: cleanGitEnv, encoding: "utf8" });
  return { stdout: result.stdout || "", stderr: result.stderr || "", exitCode: result.status, timedOut: false, truncated: false, durationMs: Date.now() - started };
}
function mustGit(cwd: string, args: string[]) {
  const result = runGit(cwd, args);
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout.trim();
}
function status(cwd: string) {
  const command = runGit(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  assert.equal(command.exitCode, 0, command.stderr);
  const result = command.stdout.trimEnd();
  const added: string[] = [], modified: string[] = [], deleted: string[] = [];
  for (const line of result.split(/\r?\n/).filter(Boolean)) {
    const code = line.slice(0, 2), file = line.slice(3);
    if (code === "??" || code.includes("A")) added.push(file);
    else if (code.includes("D")) deleted.push(file);
    else modified.push(file);
  }
  return { added, modified, deleted };
}

function freshRepository(options: { branch?: string; foreignFile?: boolean; losePersistenceOnce?: boolean } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "noline-forge-controlled-"));
  mustGit(root, ["init", "--initial-branch=main"]);
  writeFileSync(path.join(root, "app.txt"), "before\n");
  mustGit(root, ["add", "--", "app.txt"]);
  mustGit(root, ["-c", "user.name=Bootstrap", "-c", "user.email=bootstrap@example.invalid", "commit", "-m", "base"]);
  const baseCommitSha = mustGit(root, ["rev-parse", "HEAD"]);
  const branch = options.branch || "forge/runtime-safe";
  if (branch !== "main") mustGit(root, ["switch", "-c", branch]);
  writeFileSync(path.join(root, "app.txt"), "after\n");
  if (options.foreignFile) writeFileSync(path.join(root, "foreign.txt"), "foreign\n");
  const patch = mustGit(root, ["diff", "--no-ext-diff", "--no-color", "HEAD", "--", "app.txt"]);
  let current: Record<string, unknown> = {
    artifactId: "artifact-runtime", runId: "run-runtime", repository: "owner/repo", baseCommitSha, sourceBranch: "main",
    changedFiles: ["app.txt"], additions: 1, deletions: 1, patch, status: "READY", createdAt: "2026-09-05T00:00:00.000Z",
    restoreStatus: "RESTORED", publicationStatus: "BRANCHED", restoredAt: "2026-09-05T00:00:01.000Z", restoredRuntimeId: "runtime-new",
    branchName: branch, commitSha: null, pullRequestUrl: null, remoteBranch: null, pullRequestNumber: null, pullRequestTarget: null,
    publishedAt: null, pullRequestCreatedAt: null, conflictFiles: [],
  };
  let losePersistenceOnce = options.losePersistenceOnce === true;
  const service = createForgeContinuityService({
    async getWorkspace() { return { workspaceId: "workspace-runtime", projectId: "project-runtime", conversationId: "conversation-runtime", repository: "owner/repo", branch: "main", baseCommitSha, status: "READY" }; },
    async getRuntime() { return { runtimeId: "runtime-new", status: "READY", baseCommitSha }; },
    async getArtifact() { return current as never; },
    async getRun() { return { runId: "run-runtime", userId: "user-runtime", projectId: "project-runtime", conversationId: "conversation-runtime", workspaceId: "workspace-runtime", runtimeId: "runtime-new", status: "COMPLETED", objective: "test", baseCommitSha, plan: [], finalReport: "done", createdAt: "", startedAt: "", completedAt: "", lastActivityAt: "", error: null }; },
    async updateArtifact(_userId, _artifactId, update) { if (losePersistenceOnce) { losePersistenceOnce = false; throw new Error("simulated lost response"); } current = { ...current, ...update }; return current as never; },
    runtime() { return {
      async writeFile() {}, async deleteFile() {},
      async execute(command) { assert.equal(command.command, "git"); assert.equal(command.cwd, "."); return runGit(root, command.args); },
      async getGitStatus() { return status(root); },
      async getGitDiff() { return { ...status(root), patch: mustGit(root, ["diff", "--no-ext-diff", "--no-color", "HEAD", "--", "."]), truncated: false }; },
    }; },
    now: () => "2026-09-05T00:00:02.000Z",
  });
  return { root, service, baseCommitSha, branch, current: () => current };
}

test("runtime Git neuf sans identité globale crée un commit Forge avec identité limitée à la commande", async () => {
  const target = freshRepository();
  try {
    assert.equal(runGit(target.root, ["config", "--local", "--get", "user.name"]).exitCode, 1);
    assert.equal(runGit(target.root, ["config", "--local", "--get", "user.email"]).exitCode, 1);
    const committed = await target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "Forge runtime-safe", true);
    assert.equal(committed.publicationStatus, "COMMITTED");
    assert.match(String(committed.commitSha), /^[0-9a-f]{40,64}$/);
    assert.equal(mustGit(target.root, ["rev-parse", "HEAD"]), committed.commitSha);
    assert.equal(mustGit(target.root, ["show", "-s", "--format=%an|%ae", "HEAD"]), "NØLINE Forge|forge@noline-ai.fr");
    assert.equal(runGit(target.root, ["config", "--local", "--get", "user.name"]).exitCode, 1);
    assert.equal(runGit(target.root, ["config", "--local", "--get", "user.email"]).exitCode, 1);
    assert.deepEqual(mustGit(target.root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).split(/\r?\n/), ["app.txt"]);
  } finally { rmSync(target.root, { recursive: true, force: true }); }
});

test("main et master sont refusées avant staging", async () => {
  for (const branch of ["main", "master"]) {
    const target = freshRepository({ branch: "main" });
    try {
      (target.current() as { branchName: string }).branchName = branch;
      await assert.rejects(() => target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "refused", true), /BRANCH_MISMATCH/);
      assert.equal(mustGit(target.root, ["diff", "--cached", "--name-only"]), "");
    } finally { rmSync(target.root, { recursive: true, force: true }); }
  }
});

test("un fichier étranger au working tree provoque WORKTREE_MISMATCH et n'est pas indexé", async () => {
  const target = freshRepository({ foreignFile: true });
  try {
    await assert.rejects(() => target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "refused", true), /WORKTREE_MISMATCH/);
    assert.equal(mustGit(target.root, ["diff", "--cached", "--name-only"]), "");
  } finally { rmSync(target.root, { recursive: true, force: true }); }
});

test("retry après commit réussi et réponse perdue réconcilie le SHA sans second commit", async () => {
  const target = freshRepository({ losePersistenceOnce: true });
  try {
    await assert.rejects(() => target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "retry-safe", true), /simulated lost response/);
    const sha = mustGit(target.root, ["rev-parse", "HEAD"]), count = mustGit(target.root, ["rev-list", "--count", "HEAD"]);
    const reconciled = await target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "retry-safe", true);
    assert.equal(reconciled.commitSha, sha);
    assert.equal(mustGit(target.root, ["rev-list", "--count", "HEAD"]), count);
  } finally { rmSync(target.root, { recursive: true, force: true }); }
});

test("un commit existant inattendu ne peut pas être réconcilié comme COMMITTED", async () => {
  const target = freshRepository();
  try {
    writeFileSync(path.join(target.root, "app.txt"), "different\n");
    mustGit(target.root, ["add", "--", "app.txt"]);
    mustGit(target.root, ["-c", "user.name=Other", "-c", "user.email=other@example.invalid", "commit", "-m", "unexpected"]);
    await assert.rejects(() => target.service.commit("user-runtime", "conversation-runtime", "artifact-runtime", "must refuse", true), /commit existant ne correspond pas exactement/);
    assert.equal(target.current().publicationStatus, "BRANCHED");
    assert.equal(target.current().commitSha, null);
  } finally { rmSync(target.root, { recursive: true, force: true }); }
});

test("diagnostics exit 128 sont classifiés et sanitizés sans token", () => {
  const stderr = "Author identity unknown Authorization: Bearer github_pat_supersecrettoken https://user:password@example.test/repo.git";
  const result = { stdout: "", stderr, exitCode: 128, timedOut: false, truncated: false, durationMs: 1 };
  assert.equal(classifyForgeGitFailure(result), "GIT_IDENTITY_MISSING");
  const safe = sanitizeForgeGitOutput(stderr);
  assert.doesNotMatch(safe, /supersecrettoken|user:password/);
  assert.match(safe, /\[REDACTED\]/);
  assert.equal(classifyForgeGitFailure({ ...result, stderr: "fatal: not a git repository" }), "NOT_A_GIT_REPOSITORY");
  assert.equal(classifyForgeGitFailure({ ...result, stderr: "fatal: Unable to create '.git/index.lock'" }), "INDEX_LOCKED");
  assert.equal(classifyForgeGitFailure({ ...result, stderr: "nothing to commit, working tree clean" }), "NOTHING_TO_COMMIT");
});
