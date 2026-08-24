export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { createForgeAgentRunner, normalizeAgentCommand, normalizeAgentPath, sanitizeAgentText, FORGE_AGENT_LIMITS } = require("../lib/forge/agent-foundation.ts");
const { submitForgeComposer } = require("../lib/forge/forge-submit.ts");
const { deriveForgeConversationTitle } = require("../lib/forge/conversation-title.ts");
const { runForgeAgentConversation } = require("../lib/forge/agent-conversation.ts");

function harness(decisions: Array<Record<string, unknown> | ((context: Record<string, unknown>) => Record<string, unknown>)>, cancelled: boolean | (() => boolean) = false) {
  let run: Record<string, unknown> | null = null; const steps: Array<Record<string, unknown>> = []; const commands: Array<Record<string, unknown>> = []; const writes: string[] = []; const reads: string[] = []; const lists: string[] = []; const contexts: Array<Record<string, unknown>> = []; let commandIndex = 0;
  const deps = {
    async resolveContext(userId: string, conversationId: string) { if (userId !== "user-a" || conversationId !== "conversation-a") throw Object.assign(new Error("not found"), { code: "NOT_FOUND" }); return { projectId: "project-a", workspaceId: "workspace-a", runtimeId: "runtime-a", repository: "yNono57/noline-forge-testbed", branch: "main", baseCommitSha: "a".repeat(40) }; },
    async createRun(input: Record<string, unknown>) { run = { ...input, runId: "run-a", createdAt: "2026-08-24T00:00:00.000Z" }; return run; },
    async updateRun(_userId: string, _runId: string, input: Record<string, unknown>) { Object.assign(run as object, input); return run; },
    async appendStep(_userId: string, input: Record<string, unknown>) { const step = { ...input, stepId: `step-${steps.length + 1}` }; steps.push(step); return step; },
    async updateStep(_userId: string, stepId: string, input: Record<string, unknown>) { const step = steps.find((item) => item.stepId === stepId); Object.assign(step as object, input); return step; },
    async isCancelled() { return typeof cancelled === "function" ? cancelled() : cancelled; },
    runtime() { return { async listFiles(path: string) { lists.push(path); return [{ path: "README.md", type: "file", size: 48 }, { path: "package.json", type: "file", size: 20 }]; }, async readFile(path: string) { reads.push(path); const content = path === "README.md" ? "# Forge Testbed\nRepository de validation Forge." : '{"name":"noline-forge-testbed"}'; return { path, size: content.length, content }; }, async writeFile(path: string) { writes.push(path); return { path, size: 10, content: "changed" }; }, async deleteFile() {}, async executeCommand(command: Record<string, unknown>) { commands.push(command); const failing = commandIndex++ === 0; return { stdout: failing ? "test failed" : "tests pass", stderr: "", exitCode: failing ? 1 : 0, timedOut: false, truncated: false, durationMs: 10 }; }, async getGitStatus() { return { added: writes.includes("hello-forge.txt") ? ["hello-forge.txt"] : [], modified: ["src/index.ts"], deleted: [] }; }, async getGitDiff() { return { added: [], modified: ["src/index.ts"], deleted: [], patch: "diff --git a/src/index.ts", truncated: false }; } }; },
    model: { key: "mock", async decide(context: Record<string, unknown>) { contexts.push(context); const next = decisions.shift(); if (!next) throw new Error("missing decision"); return typeof next === "function" ? next(context) : next; } }, now: () => "2026-08-24T00:00:01.000Z",
  };
  return { runner: createForgeAgentRunner(deps), run: () => run, steps, commands, writes, reads, lists, contexts };
}

test("mission agentique persiste le fil et expose ses étapes réelles sans appeler le chat classique", async () => {
  const objective = "Inspecte le repository. Liste les fichiers présents à sa racine, puis lis README.md et résume son contenu.";
  const target = harness([
    { type: "TOOL_CALL", summary: "Lister la racine", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire README.md", tool: "read_file", input: { path: "README.md" } },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /Repository de validation Forge/); return { type: "FINAL", summary: "Résumé terminé", report: "README.md présente le repository de validation Forge." }; },
  ]);
  const persisted: Array<Record<string, unknown>> = [];
  const result = await submitForgeComposer("agent", objective, {
    chat: async () => { throw new Error("chat classique appelé"); },
    agent: () => runForgeAgentConversation({ objective }, {
      createMessage: async (message: Record<string, unknown>) => { const persistedMessage = { id: `message-${persisted.length + 1}`, conversation_id: "conversation-a", ...message, created_at: `2026-08-24T00:00:0${persisted.length}.000Z` }; persisted.push(persistedMessage); return persistedMessage; },
      runAgent: () => target.runner.run("user-a", "conversation-a", objective),
    }),
  });
  assert.equal(result.run.status, "COMPLETED");
  assert.equal(target.steps[0]?.type, "PLAN");
  assert.deepEqual(target.lists, ["."]);
  assert.deepEqual(target.reads, ["README.md"]);
  assert.ok(target.steps.some((step) => step.tool === "list_files"));
  assert.ok(target.steps.some((step) => step.tool === "read_file"));
  assert.equal(persisted[0]?.role, "USER");
  assert.equal(persisted[0]?.content, objective);
  assert.equal(persisted[1]?.role, "ASSISTANT");
  assert.match(String(persisted[1]?.content), /repository de validation Forge/i);
  assert.equal((persisted[1]?.metadata as Record<string, unknown>)?.forge_agent_run_id, "run-a");
  assert.equal(persisted.length, 2);
});

test("mode Conversation reste séparé du runner agentique", async () => {
  let agentCalled = false;
  const result = await submitForgeComposer("chat", "Bonjour Forge", { chat: async () => "Réponse conversationnelle", agent: async () => { agentCalled = true; throw new Error("agent appelé"); } });
  assert.equal(result, "Réponse conversationnelle");
  assert.equal(agentCalled, false);
});
test("mission Production démarre par un PLAN serveur puis lit réellement package.json", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package.json", tool: "read_file", input: { path: "package.json" } },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /noline-forge-testbed/); return { type: "FINAL", summary: "Projet identifié", report: "Le projet est noline-forge-testbed." }; },
  ]);
  const result = await submitForgeComposer("agent", "Inspecte package.json et indique le nom du projet.", { chat: async () => { throw new Error("chat classique appelé"); }, agent: (objective: string) => target.runner.run("user-a", "conversation-a", objective) });
  assert.equal(result.status, "COMPLETED"); assert.equal(target.steps[0]?.type, "PLAN"); assert.equal(target.steps[0]?.status, "COMPLETED"); assert.deepEqual(target.reads, ["package.json"]); assert.equal(target.run()?.objective, "Inspecte package.json et indique le nom du projet."); assert.match(String(target.run()?.finalReport), /noline-forge-testbed/); assert.doesNotMatch(String(target.run()?.finalReport), /pas accès|fournir.*package\.json/i);
});
test("composeur Agent écrit dans Daytona puis contrôle git status sans commit ni push", async () => {
  const target = harness([{ type: "PLAN", summary: "Créer", plan: ["Écrire le fichier", "Vérifier Git"] }, { type: "TOOL_CALL", summary: "Créer hello", tool: "write_file", input: { path: "hello-forge.txt", content: "hello" } }, { type: "TOOL_CALL", summary: "Vérifier Git", tool: "git_status", input: {} }, { type: "FINAL", summary: "Terminé", report: "hello-forge.txt créé dans le sandbox." }]);
  const result = await submitForgeComposer("agent", "Crée hello-forge.txt contenant hello", { chat: async () => { throw new Error("chat classique appelé"); }, agent: (objective: string) => target.runner.run("user-a", "conversation-a", objective) });
  assert.equal(result.status, "COMPLETED"); assert.deepEqual(target.writes, ["hello-forge.txt"]); assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED"); assert.doesNotMatch(JSON.stringify(target.steps), /git_commit|git_push/);
});
test("boucle agentique planifie, corrige une validation en échec puis termine", async () => {
  const target = harness([
    { type: "PLAN", summary: "Plan", plan: ["Inspecter", "Modifier", "Tester"] },
    { type: "TOOL_CALL", summary: "Lire", tool: "read_file", input: { path: "src/index.ts" } },
    { type: "TOOL_CALL", summary: "Modifier", tool: "write_file", input: { path: "src/index.ts", content: "first" } },
    { type: "TOOL_CALL", summary: "Tester", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Corriger", tool: "write_file", input: { path: "src/index.ts", content: "fixed" } },
    { type: "TOOL_CALL", summary: "Retester", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Status", tool: "git_status", input: {} }, { type: "TOOL_CALL", summary: "Diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Fini", report: "Tests PASS, aucun commit ni push." },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", "Corriger le testbed");
  assert.equal(result.status, "COMPLETED"); assert.equal(target.commands.length, 2); assert.equal(target.writes.length, 2); assert.equal(target.run()?.baseCommitSha, "a".repeat(40)); assert.equal(target.steps.find((step) => step.summary === "Tester")?.status, "FAILED"); assert.equal(target.steps.find((step) => step.summary === "Retester")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /repository-secret-source|"content":"first"/);
});

test("authentification et ownership sont dérivés côté serveur", async () => { await assert.rejects(() => harness([]).runner.run("", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "UNAUTHENTICATED"); await assert.rejects(() => harness([]).runner.run("user-b", "conversation-a", "Mission"), /not found/); });
test("annulation empêche tout appel modèle ou outil", async () => { const target = harness([{ type: "FINAL", summary: "non", report: "non" }], true); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "CANCELLED"); assert.equal(target.steps.length, 0); assert.equal(target.run()?.status, "CANCELLED"); });
test("annulation pendant un outil ne peut pas réactiver le run", async () => { const checks = [false, false, false, false, true]; const target = harness([{ type: "PLAN", summary: "plan", plan: ["status"] }, { type: "TOOL_CALL", summary: "status", tool: "git_status", input: {} }], () => checks.shift() ?? true); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "CANCELLED"); assert.equal(target.run()?.status, "CANCELLED"); });test("limite outils arrête la boucle", async () => { const decisions = [{ type: "PLAN", summary: "plan", plan: ["inspecter"] }, ...Array.from({ length: FORGE_AGENT_LIMITS.maxToolCalls + 1 }, () => ({ type: "TOOL_CALL", summary: "status", tool: "git_status", input: {} }))]; const target = harness(decisions); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "LIMIT"); assert.equal(target.run()?.status, "FAILED"); });
test("filesystem refuse traversal, absolu et fichiers sensibles", () => { assert.throws(() => normalizeAgentPath("../secret")); assert.throws(() => normalizeAgentPath("/etc/passwd")); assert.throws(() => normalizeAgentPath(".env")); assert.equal(normalizeAgentPath(".env.example"), ".env.example"); });
test("command policy refuse shell, secrets, host et Git write", () => { for (const input of [{ command: "bash", args: [], cwd: "." }, { command: "node", args: ["/etc/passwd"], cwd: "." }, { command: "git", args: ["status"], cwd: "." }, { command: "npm", args: ["publish"], cwd: "." }, { command: "vercel", args: ["deploy"], cwd: "." }, { command: "env", args: [], cwd: "." }]) assert.throws(() => normalizeAgentCommand(input)); assert.equal(normalizeAgentCommand({ command: "npm", args: ["test"], cwd: ".", timeoutMs: 999999 }).timeoutMs, 60_000); });
test("protocole modèle borne les décisions et outils", () => { const source = fs.readFileSync("lib/forge/agent-model.ts", "utf8"); for (const type of ["PLAN", "TOOL_CALL", "FINAL", "FAIL"]) assert.match(source, new RegExp(type)); assert.doesNotMatch(source, /git_push|git_commit/); assert.match(source, /jsonMode: true/); });
test("redaction supprime tokens et secrets des résumés", () => { const text = sanitizeAgentText("OPENAI_API_KEY=super-secret-value ghp_abcdefghijklmnopqrstuvwxyz"); assert.doesNotMatch(text, /super-secret|ghp_/); });
test("routes agentiques exigent authenticateForge et n’exposent aucun secret", () => { for (const path of ["app/api/forge/conversations/[conversationId]/agent-runs/route.ts", "app/api/forge/conversations/[conversationId]/agent-runs/[runId]/route.ts"]) { const source = fs.readFileSync(path, "utf8"); assert.match(source, /authenticateForge\(request\)/); assert.doesNotMatch(source, /DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY|providerRuntimeId/); } });
test("limite étapes empêche toute boucle infinie", async () => { const target = harness(Array.from({ length: FORGE_AGENT_LIMITS.maxSteps }, () => ({ type: "PLAN", summary: "plan", plan: ["continuer"] }))); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "LIMIT"); assert.equal(target.steps.length, FORGE_AGENT_LIMITS.maxSteps); });
test("runtime agentique revalide workspace runtime SHA et expiration", () => { const source = fs.readFileSync("lib/forge/agent-runtime.ts", "utf8"); assert.match(source, /findRuntimeByWorkspace/); assert.match(source, /runtime\.status !== "READY"/); assert.match(source, /runtime\.expiresAt/); assert.match(source, /runtime\.baseCommitSha !== workspace\.baseCommitSha/); assert.doesNotMatch(source, /child_process|execSync|spawnSync/); });
test("migration RLS relie user projet conversation workspace et runtime", () => { const sql = fs.readFileSync("supabase/migrations/20260824_forge_v14_agentic_execution_loop.sql", "utf8"); for (const value of ["auth.uid() = forge_agent_runs.user_id", "c.id = forge_agent_runs.conversation_id", "p.id = forge_agent_runs.forge_project_id", "w.id = forge_agent_runs.workspace_id", "rt.id = forge_agent_runs.runtime_id", "auth.uid() = forge_agent_steps.user_id", "r.id = forge_agent_steps.run_id", "drop policy if exists", "enable row level security"]) assert.ok(sql.includes(value)); assert.doesNotMatch(sql, /provider_runtime_id|private key/i); });
test("titre automatique est déterministe et ne consomme aucun modèle", () => { assert.equal(deriveForgeConversationTitle("Inspecte package.json et indique le nom du projet."), "Inspection package.json"); });
test("renommage session et titre automatique conservent auth ownership et titre manuel", () => { const route = fs.readFileSync("app/api/forge/conversations/[conversationId]/route.ts", "utf8"), store = fs.readFileSync("lib/forge/forge-store.ts", "utf8"); assert.match(route, /authenticateForge\(request\)/); assert.match(route, /setForgeConversationTitle\(user\.id/); assert.match(store, /getForgeConversation\(userId, conversationId\)/); assert.match(store, /conversation\.title !== DEFAULT_FORGE_CONVERSATION_TITLE/); });
test("aucun secret ou accès host dans le bundle agentique", () => { const sources = ["lib/forge/agent-foundation.ts", "lib/forge/agent-model.ts", "lib/forge/agent-runtime.ts", "components/ForgeAgentRunnerPanel.tsx"].map((path) => fs.readFileSync(path, "utf8")).join("\n"); assert.doesNotMatch(sources, /process\.env\.(?:DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY)|child_process|Bun\.spawn|Deno\.Command/); });
