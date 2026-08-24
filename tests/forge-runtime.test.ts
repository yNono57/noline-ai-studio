/* eslint-disable @typescript-eslint/no-require-imports */
const runtimeAssert = require("node:assert/strict");
const runtimeTest = require("node:test");
const runtimeFs = require("node:fs");
const {
  assertRuntimeReady,
  assertRuntimeTransition,
  createForgeRuntimeService,
  normalizeRuntimeCommand,
  normalizeRuntimeDiffLimit,
  normalizeRuntimePath,
  publicRuntime,
} = require("../lib/forge/runtime-foundation.ts");

function runtimeHarness() {
  let workspace = { workspaceId: "workspace-a", userId: "user-a", status: "READY", repository: "owner/repo", branch: "main", baseCommitSha: "a".repeat(40) };
  const runtimes: Array<Record<string, unknown>> = [];
  let capturedSource: Record<string, unknown> | null = null;
  const provider = {
    name: "test-provider", provisioningAvailable: false,
    async createRuntime(_runtime: unknown, source: Record<string, unknown>) { capturedSource = source; return { providerRuntimeId: "provider-runtime", status: "READY", readyAt: "2026-08-24T00:00:01.000Z", expiresAt: null }; },
    async getRuntime() { return null; }, async destroyRuntime() {},
    async readFile() { throw new Error("not implemented"); }, async writeFile() { throw new Error("not implemented"); }, async listFiles() { throw new Error("not implemented"); },
    async executeCommand() { throw new Error("not implemented"); }, async getGitStatus() { throw new Error("not implemented"); }, async getGitDiff() { throw new Error("not implemented"); },
  };
  const deps = {
    async getOwnedWorkspace(userId: string, conversationId: string) { return userId === "user-a" && conversationId === "conversation-a" ? workspace : null; },
    async findByWorkspace(userId: string, workspaceId: string, providerName: string) { return runtimes.find((item) => item.userId === userId && item.workspaceId === workspaceId && item.provider === providerName) || null; },
    async insert(input: Record<string, unknown>) { const row = { ...input, runtimeId: `runtime-${runtimes.length + 1}`, createdAt: "2026-08-24T00:00:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z" }; runtimes.push(row); return { runtime: row, created: true }; },
    async update(_userId: string, runtimeId: string, input: Record<string, unknown>) { const row = runtimes.find((item) => item.runtimeId === runtimeId); if (!row) throw new Error("missing runtime"); Object.assign(row, input); return row; },
    provider,
    now: () => "2026-08-24T00:00:02.000Z",
  };
  return { service: createForgeRuntimeService(deps), provider, runtimes, capturedSource: () => capturedSource, setWorkspace(next: typeof workspace) { workspace = next; } };
}

function readyRuntime(status = "READY") {
  return { runtimeId: "runtime-a", workspaceId: "workspace-a", userId: "user-a", provider: "provider", providerRuntimeId: "provider-runtime", status, baseCommitSha: "a".repeat(40), createdAt: "2026-08-24T00:00:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z", readyAt: null, expiresAt: null, lastActivityAt: null, errorCode: null };
}

runtimeTest("runtime refuse un utilisateur non authentifié", async () => {
  await runtimeAssert.rejects(() => runtimeHarness().service.create("", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "UNAUTHENTICATED");
});

runtimeTest("runtime refuse une conversation non possédée", async () => {
  await runtimeAssert.rejects(() => runtimeHarness().service.create("user-b", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "NOT_FOUND");
});

runtimeTest("runtime metadata-only reste honnêtement non provisionné et idempotent", async () => {
  const target = runtimeHarness(); const first = await target.service.create("user-a", "conversation-a"); const second = await target.service.create("user-a", "conversation-a");
  runtimeAssert.equal(first.status, "UNPROVISIONED"); runtimeAssert.equal(second.runtimeId, first.runtimeId); runtimeAssert.equal(target.runtimes.length, 1);
});

runtimeTest("provider reçoit repository, branche et SHA immuable", async () => {
  const target = runtimeHarness(); target.provider.provisioningAvailable = true; const runtime = await target.service.create("user-a", "conversation-a");
  runtimeAssert.equal(runtime.baseCommitSha, "a".repeat(40)); runtimeAssert.deepEqual(target.capturedSource(), { repository: "owner/repo", branch: "main", baseCommitSha: "a".repeat(40) });
});

runtimeTest("un autre repository ou une autre branche utilise un workspace/runtime distinct", async () => {
  const target = runtimeHarness(); const first = await target.service.create("user-a", "conversation-a");
  target.setWorkspace({ workspaceId: "workspace-b", userId: "user-a", status: "READY", repository: "other/repo", branch: "feature", baseCommitSha: "b".repeat(40) });
  const second = await target.service.create("user-a", "conversation-a"); runtimeAssert.notEqual(second.runtimeId, first.runtimeId); runtimeAssert.equal(second.baseCommitSha, "b".repeat(40));
});

runtimeTest("une relation runtime/workspace avec un SHA différent est refusée", async () => {
  const target = runtimeHarness(); await target.service.create("user-a", "conversation-a"); target.runtimes[0].baseCommitSha = "b".repeat(40);
  await runtimeAssert.rejects(() => target.service.get("user-a", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "CONFLICT");
});

runtimeTest("les transitions lifecycle invalides sont refusées", () => {
  runtimeAssert.throws(() => assertRuntimeTransition("DESTROYED", "READY"), (error: unknown) => (error as { code?: string }).code === "CONFLICT");
});

runtimeTest("les runtimes expirés et détruits refusent les opérations", () => {
  runtimeAssert.throws(() => assertRuntimeReady(readyRuntime("EXPIRED")), /expiré/); runtimeAssert.throws(() => assertRuntimeReady(readyRuntime("DESTROYED")), /détruit/);
});

runtimeTest("la destruction d’un runtime non provisionné est idempotente", async () => {
  const target = runtimeHarness(); await target.service.create("user-a", "conversation-a"); const first = await target.service.destroy("user-a", "conversation-a"); const second = await target.service.destroy("user-a", "conversation-a");
  runtimeAssert.equal(first.status, "DESTROYED"); runtimeAssert.equal(second.status, "DESTROYED");
});

runtimeTest("normalisation chemins refuse traversal, absolu, Windows et null byte", () => {
  runtimeAssert.equal(normalizeRuntimePath("src/app.ts"), "src/app.ts"); runtimeAssert.throws(() => normalizeRuntimePath("../secret")); runtimeAssert.throws(() => normalizeRuntimePath("/etc/passwd")); runtimeAssert.throws(() => normalizeRuntimePath("C:/Windows")); runtimeAssert.throws(() => normalizeRuntimePath("src\\secret")); runtimeAssert.throws(() => normalizeRuntimePath("bad\0path"));
});

runtimeTest("contrat commande borne cwd, timeout et sortie", () => {
  const command = normalizeRuntimeCommand({ command: "npm", args: ["test"], cwd: "app", timeoutMs: 60_000, maxOutputBytes: 1_000_000 }); runtimeAssert.equal(command.cwd, "app");
  runtimeAssert.throws(() => normalizeRuntimeCommand({ command: "npm test", args: [], cwd: ".", timeoutMs: 30_000, maxOutputBytes: 10_000 })); runtimeAssert.throws(() => normalizeRuntimeCommand({ command: "npm", args: [], cwd: "../", timeoutMs: 30_000, maxOutputBytes: 10_000 }));
});

runtimeTest("expiration READY devient EXPIRED sans appeler le provider", async () => {
  const target = runtimeHarness(); target.provider.provisioningAvailable = true; await target.service.create("user-a", "conversation-a"); target.runtimes[0].expiresAt = "2026-08-23T00:00:00.000Z";
  const runtime = await target.service.get("user-a", "conversation-a"); runtimeAssert.equal(runtime.status, "EXPIRED");
});

runtimeTest("abstraction provider expose lifecycle, filesystem, commandes et git", () => {
  const provider = runtimeHarness().provider as Record<string, unknown>; for (const method of ["createRuntime", "getRuntime", "destroyRuntime", "readFile", "writeFile", "listFiles", "executeCommand", "getGitStatus", "getGitDiff"]) runtimeAssert.equal(typeof provider[method], "function");
});

runtimeTest("le patch git reste strictement borné", () => {
  runtimeAssert.equal(normalizeRuntimeDiffLimit(), 200_000); runtimeAssert.throws(() => normalizeRuntimeDiffLimit(200_001));
});

runtimeTest("provider foundation n’exécute aucune commande sur l’hôte", () => {
  const source = runtimeFs.readFileSync("lib/forge/runtime-provider.ts", "utf8"); runtimeAssert.doesNotMatch(source, /child_process|execSync|spawnSync|\bexec\(|\bspawn\(/);
});

runtimeTest("vue client exclut user, provider runtime id, token et private key", () => {
  const serialized = JSON.stringify(publicRuntime(readyRuntime())); runtimeAssert.doesNotMatch(serialized, /user-a|provider-runtime|token|private.?key|secret/i);
});
