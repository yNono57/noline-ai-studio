export {};
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { createForgeAgentRunner, deriveForgeMissionRequirements, normalizeAgentCommand, normalizeAgentObjective, normalizeAgentPath, sanitizeAgentText, FORGE_AGENT_LIMITS, FORGE_AGENT_STEP_TYPES, FORGE_AGENT_TOOL_NAMES, FORGE_AGENT_STEP_STATUSES, createCompletionArtifactInput, FORGE_RUN_ARTIFACT_MAX_PATCH_CHARACTERS, ForgeAgentError } = require("../lib/forge/agent-foundation.ts");
const { FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS } = require("../lib/forge/agent-limits.ts");
const { submitForgeComposer } = require("../lib/forge/forge-submit.ts");
const { deriveForgeConversationTitle } = require("../lib/forge/conversation-title.ts");
const { runForgeAgentConversation } = require("../lib/forge/agent-conversation.ts");
const { clearForgeSessionRestore, readForgeSessionRestore, resolveForgeSessionRestore, saveForgeSessionRestore } = require("../lib/forge/session-restore.ts");

function harness(decisions: Array<Record<string, unknown> | ((context: Record<string, unknown>, constraint?: Record<string, unknown>) => Record<string, unknown>)>, cancelled: boolean | (() => boolean) = false, options: { entries?: Array<Record<string, unknown>>; files?: Record<string, string>; missingFiles?: string[]; blockedFiles?: string[]; commandResults?: Array<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; truncated: boolean; durationMs: number }>; gitDiff?: { added: string[]; modified: string[]; deleted: string[]; patch: string; truncated: boolean }; artifactFailure?: boolean } = {}) {
  let run: Record<string, unknown> | null = null; let runCreates = 0; const steps: Array<Record<string, unknown>> = []; const artifacts: Array<Record<string, unknown>> = []; const events: string[] = []; const commands: Array<Record<string, unknown>> = []; const writes: string[] = []; const reads: string[] = []; const lists: string[] = []; const contexts: Array<Record<string, unknown>> = []; const constraints: Array<Record<string, unknown> | undefined> = []; const files = new Map<string, string>(Object.entries(options.files ?? {})); let commandIndex = 0;
  const deps = {
    async resolveContext(userId: string, conversationId: string) { if (userId !== "user-a" || conversationId !== "conversation-a") throw Object.assign(new Error("not found"), { code: "NOT_FOUND" }); return { projectId: "project-a", workspaceId: "workspace-a", runtimeId: "runtime-a", repository: "yNono57/noline-forge-testbed", branch: "main", baseCommitSha: "a".repeat(40) }; },
    async createRun(input: Record<string, unknown>) { runCreates += 1; run = { ...input, runId: "run-a", createdAt: "2026-08-24T00:00:00.000Z" }; return run; },
    async updateRun(_userId: string, _runId: string, input: Record<string, unknown>) { Object.assign(run as object, input); return run; },
    async appendStep(_userId: string, input: Record<string, unknown>) { events.push(String(input.type)); const step = { ...input, stepId: `step-${steps.length + 1}` }; steps.push(step); return step; },
    async updateStep(_userId: string, stepId: string, input: Record<string, unknown>) { const step = steps.find((item) => item.stepId === stepId); Object.assign(step as object, input); return step; },
    async createArtifact(_userId: string, input: Record<string, unknown>) { if (options.artifactFailure) throw new ForgeAgentError("PERSISTENCE", "Persistance artifact indisponible."); events.push("ARTIFACT"); const artifact = { ...input, artifactId: `artifact-${artifacts.length + 1}`, createdAt: "2026-08-24T00:00:01.000Z" }; artifacts.push(artifact); return artifact; },
    async isCancelled() { return typeof cancelled === "function" ? cancelled() : cancelled; },
    runtime() { return { async listFiles(path: string) { lists.push(path); return options.entries ?? [{ path: "README.md", type: "file", size: 48 }, { path: "package.json", type: "file", size: 20 }]; }, async readFile(path: string) { reads.push(path); if (options.missingFiles?.includes(path) && !files.has(path)) throw Object.assign(new Error("Fichier runtime introuvable."), { code: "NOT_FOUND" }); if (options.blockedFiles?.includes(path)) throw Object.assign(new Error("Runtime provider indisponible."), { code: "UNAVAILABLE" }); const content = files.get(path) ?? (path === "README.md" ? "# Forge Testbed\nRepository de validation Forge." : '{"name":"noline-forge-testbed","scripts":{"build":"vite build"}}'); return { path, size: content.length, content }; }, async writeFile(path: string, content: string) { writes.push(path); files.set(path, content); return { path, size: content.length, content }; }, async deleteFile() {}, async executeCommand(command: Record<string, unknown>) { commands.push(command); const configured = options.commandResults?.[commandIndex]; const failing = commandIndex++ === 0; return configured ?? { stdout: failing ? "test failed" : "tests pass", stderr: "", exitCode: failing ? 1 : 0, timedOut: false, truncated: false, durationMs: 10 }; }, async getGitStatus() { return { added: writes.includes("hello-forge.txt") ? ["hello-forge.txt"] : [], modified: ["src/index.ts"], deleted: [] }; }, async getGitDiff() { if (options.gitDiff) return options.gitDiff; return { added: writes.includes("hello-forge.txt") ? ["hello-forge.txt"] : [], modified: ["src/index.ts"], deleted: [], patch: writes.includes("hello-forge.txt") ? "diff --git a/hello-forge.txt\n+Hello from NØLINE Forge" : "diff --git a/src/index.ts", truncated: false }; } }; },
    model: { key: "mock", async decide(context: Record<string, unknown>, constraint?: Record<string, unknown>) { contexts.push(context); constraints.push(constraint); const next = decisions.shift(); if (!next) throw new Error("missing decision"); return typeof next === "function" ? next(context, constraint) : next; } }, now: () => "2026-08-24T00:00:01.000Z",
  };
  return { runner: createForgeAgentRunner(deps), run: () => run, runCreates: () => runCreates, steps, artifacts, events, commands, writes, reads, lists, contexts, constraints, files };
}

test("mission agentique persiste le fil et expose ses étapes réelles sans appeler le chat classique", async () => {
  const objective = "Inspecte le repository. Liste les fichiers présents à sa racine, puis lis README.md et résume son contenu.";
  const target = harness([
    { type: "FINAL", summary: "Intention prematuree", report: "Je vais d'abord lister les fichiers a la racine du repository, puis lire README.md pour en resumer le contenu." },
    { type: "TOOL_CALL", summary: "Lister la racine", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire README.md", tool: "read_file", input: { path: "README.md" } },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /Repository de validation Forge/); return { type: "FINAL", summary: "Résumé terminé", report: "Fichiers racine : README.md, package.json. README.md présente le repository de validation Forge." }; },
  ]);
  const persisted: Array<Record<string, unknown>> = [];
  const result = await submitForgeComposer("agent", objective, {
    chat: async () => { throw new Error("chat classique appelé"); },
    agent: () => runForgeAgentConversation({ objective, submissionId: "11111111-1111-4111-8111-111111111111" }, {
      createMessage: async (message: Record<string, unknown>) => { const persistedMessage = { id: `message-${persisted.length + 1}`, conversation_id: "conversation-a", ...message, created_at: `2026-08-24T00:00:0${persisted.length}.000Z` }; persisted.push(persistedMessage); return persistedMessage; },
      updateMessageMetadata: async (messageId: string, metadata: Record<string, unknown>) => { const message = persisted.find((item) => item.id === messageId); Object.assign(message as object, { metadata }); return message; },
      runAgent: () => target.runner.run("user-a", "conversation-a", objective),
    }),
  });
  assert.equal(result.run.status, "COMPLETED");
  assert.equal(target.steps[0]?.type, "PLAN");
  assert.ok(target.steps.some((step) => step.type === "FAIL" && step.summary === "Résultat final prématuré"));
  assert.deepEqual(target.lists, ["."]);
  assert.deepEqual(target.reads, ["README.md"]);
  assert.ok(target.steps.some((step) => step.tool === "list_files"));
  assert.ok(target.steps.some((step) => step.tool === "read_file"));
  assert.equal(persisted[0]?.role, "USER");
  assert.equal(persisted[0]?.content, objective);
  assert.equal((persisted[0]?.metadata as Record<string, unknown>)?.forge_agent_run_id, "run-a");
  assert.equal(persisted[1]?.role, "ASSISTANT");
  assert.match(String(persisted[1]?.content), /README\.md, package\.json/);
  assert.match(String(persisted[1]?.content), /repository de validation Forge/i);
  assert.doesNotMatch(String(persisted[1]?.content), /je vais d'abord lister/i);
  assert.equal((persisted[1]?.metadata as Record<string, unknown>)?.forge_agent_run_id, "run-a");
  assert.equal(persisted.length, 2);
});

test("mode Conversation reste séparé du runner agentique", async () => {
  let agentCalled = false;
  const result = await submitForgeComposer("chat", "Bonjour Forge", { chat: async () => "Réponse conversationnelle", agent: async () => { agentCalled = true; throw new Error("agent appelé"); } });
  assert.equal(result, "Réponse conversationnelle");
  assert.equal(agentCalled, false);
});
test("restauration Forge conserve uniquement une session active appartenant au projet actif", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  saveForgeSessionRestore(storage, { projectId: "project-a", conversationId: "conversation-a" });
  const stored = readForgeSessionRestore(storage);
  assert.deepEqual(stored, { projectId: "project-a", conversationId: "conversation-a" });
  assert.deepEqual(resolveForgeSessionRestore(stored, [{ id: "project-a", status: "active" }], [{ id: "conversation-a", forge_project_id: "project-a", status: "active" }]), { projectId: "project-a", conversationId: "conversation-a", valid: true });
  assert.equal(resolveForgeSessionRestore(stored, [{ id: "project-b", status: "active" }]).valid, false);
  assert.equal(resolveForgeSessionRestore(stored, [{ id: "project-a", status: "active" }], []).valid, false);
  clearForgeSessionRestore(storage);
  assert.equal(readForgeSessionRestore(storage), null);
  assert.doesNotMatch(JSON.stringify([...memory]), /token|secret|cookie/i);
});

test("restauration du fil attend messages et AgentRun avant de cibler la conversation mobile", () => {
  const source = fs.readFileSync("components/ForgeWorkspace.tsx", "utf8");
  assert.match(source, /Promise\.all\(\[listForgeMessages\(conversationId\), getLatestForgeAgentRun\(conversationId\)\]\)/);
  assert.match(source, /setRestoreScrollConversationId\(restored\.conversationId\)/);
  assert.match(source, /restoreScrollConversationId !== conversationId \|\| contentLoadedConversationId !== conversationId/);
  assert.match(source, /requestAnimationFrame[\s\S]*requestAnimationFrame[\s\S]*scrollForgeChatToLatest\(messagesViewport\.current, "auto"\)[\s\S]*conversationSection\.current\?\.scrollIntoView/);
  assert.match(source, /Revenir aux messages récents/);
});
test("mission Production démarre par un PLAN serveur puis lit réellement package.json", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package.json", tool: "read_file", input: { path: "package.json" } },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /noline-forge-testbed/); return { type: "TOOL_CALL", summary: "Build disponible", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } }; },
    { type: "FINAL", summary: "Projet identifié", report: "Le projet est noline-forge-testbed et son build disponible a réussi." },
  ], false, { commandResults: [{ stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 }] });
  const result = await submitForgeComposer("agent", "Inspecte package.json et indique le nom du projet.", { chat: async () => { throw new Error("chat classique appelé"); }, agent: (objective: string) => target.runner.run("user-a", "conversation-a", objective) });
  assert.equal(result.status, "COMPLETED"); assert.equal(target.steps[0]?.type, "PLAN"); assert.equal(target.steps[0]?.status, "COMPLETED"); assert.deepEqual(target.reads, ["package.json"]); assert.equal(target.run()?.objective, "Inspecte package.json et indique le nom du projet."); assert.match(String(target.run()?.finalReport), /noline-forge-testbed/); assert.doesNotMatch(String(target.run()?.finalReport), /pas accès|fournir.*package\.json/i);
});
test("composeur Agent écrit dans Daytona puis contrôle git status sans commit ni push", async () => {
  const target = harness([{ type: "PLAN", summary: "Créer", plan: ["Écrire le fichier", "Vérifier Git"] }, { type: "TOOL_CALL", summary: "Créer hello", tool: "write_file", input: { path: "hello-forge.txt", content: "hello" } }, { type: "TOOL_CALL", summary: "Vérifier Git", tool: "git_status", input: {} }, { type: "TOOL_CALL", summary: "Lire le diff", tool: "git_diff", input: {} }, { type: "FINAL", summary: "Terminé", report: "hello-forge.txt créé dans le sandbox. Git status et Git diff vérifiés." }]);
  const result = await submitForgeComposer("agent", "Crée hello-forge.txt contenant hello", { chat: async () => { throw new Error("chat classique appelé"); }, agent: (objective: string) => target.runner.run("user-a", "conversation-a", objective) });
  assert.equal(result.status, "COMPLETED"); assert.deepEqual(target.writes, ["hello-forge.txt"]); assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED"); assert.doesNotMatch(JSON.stringify(target.steps), /git_commit|git_push/);
});
test("mission hello-forge vérifie écriture exacte, Git status, Git diff et FINAL réel", async () => {
  const objective = "Crée un fichier hello-forge.txt contenant exactement :\n\nHello from NØLINE Forge\n\nPuis vérifie Git status et Git diff. Ne crée aucun commit et ne push rien.";
  const target = harness([
    { type: "TOOL_CALL", summary: "Créer le fichier", tool: "write_file", input: { path: "hello-forge.txt", content: "Hello from NØLINE Forge" } },
    (context: Record<string, unknown>) => { assert.equal(target.files.get("hello-forge.txt"), "Hello from NØLINE Forge"); assert.match(JSON.stringify(context), /hello-forge\.txt écrit/); return { type: "TOOL_CALL", summary: "Vérifier Git status", tool: "git_status", input: {} }; },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /hello-forge\.txt/); return { type: "TOOL_CALL", summary: "Vérifier Git diff", tool: "git_diff", input: {} }; },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /Hello from NØLINE Forge/); return { type: "FINAL", summary: "Mission terminée", report: "hello-forge.txt contient exactement Hello from NØLINE Forge. Git status signale le fichier ajouté et Git diff confirme son contenu. Aucun commit ni push." }; },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.steps[0]?.type, "PLAN");
  assert.deepEqual(target.steps.filter((step) => step.type === "TOOL_CALL").map((step) => step.tool), ["write_file", "git_status", "git_diff"]);
  assert.equal(target.files.get("hello-forge.txt"), "Hello from NØLINE Forge");
  assert.ok(target.reads.includes("hello-forge.txt"));
  assert.equal(target.steps.find((step) => step.tool === "write_file")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.match(String(target.run()?.finalReport), /Git status.*Git diff/i);
  assert.doesNotMatch(JSON.stringify(target.steps), /git_commit|git_push/);
});

test("FINAL prématuré déclenche les preuves Git réelles sans boucle", async () => {
  const objective = "Crée un fichier hello-forge.txt contenant exactement :\n\nHello from NØLINE Forge\n\nPuis vérifie Git status et Git diff. Ne crée aucun commit et ne push rien.";
  const premature = { type: "FINAL", summary: "Mission terminée", report: "hello-forge.txt a été créé. Les vérifications Git sont terminées." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Créer le fichier", tool: "write_file", input: { path: "hello-forge.txt", content: "Hello from NØLINE Forge" } },
    premature,
    premature,
    (context: Record<string, unknown>) => {
      const history = JSON.stringify(context);
      assert.match(history, /hello-forge\.txt/);
      assert.match(history, /src\/index\.ts/);
      assert.match(history, /REPOSITORY DIFF/);
      assert.match(history, /Hello from NØLINE Forge/);
      return { type: "FINAL", summary: "Mission terminée", report: "hello-forge.txt existe avec le contenu exact. Git status le signale comme nouveau fichier non suivi, src/index.ts est modifié, et Git diff contient le changement réel. Aucun git add, commit ou push." };
    },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.files.get("hello-forge.txt"), "Hello from NØLINE Forge");
  assert.ok(target.reads.includes("hello-forge.txt"));
  assert.deepEqual(target.steps.filter((step) => step.type === "TOOL_CALL").map((step) => step.tool), ["write_file", "git_status", "git_diff"]);
  assert.equal(target.steps.find((step) => step.summary === "Vérification Git status obligatoire")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.summary === "Vérification Git diff obligatoire")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /Vérifications Git manquantes/);
  assert.match(String(target.run()?.finalReport), /non suivi.*src\/index\.ts.*Git diff/i);
  assert.ok(target.steps.every((step) => !["git_add", "git_commit", "git_push"].includes(String(step.tool))));
});
test("completion gates distinguent lecture, mutation, validation et Git", () => {
  assert.deepEqual(deriveForgeMissionRequirements("Inspecte README.md et résume son contenu."), { mutation: false, validation: false, gitStatus: false, gitDiff: false });
  assert.deepEqual(deriveForgeMissionRequirements("Crée une application puis lance le build et vérifie Git status et Git diff."), { mutation: true, validation: true, gitStatus: true, gitDiff: true });
  assert.deepEqual(deriveForgeMissionRequirements("Vérifie Git status."), { mutation: false, validation: false, gitStatus: true, gitDiff: false });
});

test("missions longues utilisent une limite de sécurité partagée et non 4000 caractères", () => {
  const longObjective = `Construis le projet. ${"détail ".repeat(800)}`;
  assert.ok(longObjective.length > 4_000);
  assert.equal(normalizeAgentObjective(longObjective), longObjective.trim());
  let submitted = "";
  submitForgeComposer("agent", longObjective, { chat: () => undefined, agent: (value: string) => { submitted = value; } });
  assert.equal(submitted, longObjective);
  assert.equal(FORGE_AGENT_LIMITS.maxObjectiveCharacters, FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS);
  assert.ok(FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS >= 50_000);
  assert.throws(() => normalizeAgentObjective("   "), /ne peut pas être vide/);
  assert.throws(() => normalizeAgentObjective("x".repeat(FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS + 1)), /limite de sécurité/);
  const panel = fs.readFileSync("components/ForgeAgentRunnerPanel.tsx", "utf8");
  assert.match(panel, /maxLength=\{FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS\}/);
  assert.doesNotMatch(panel, /maxLength=\{4000\}|entre 1 et 4000/);
});

test("repository minimal ECLYRA refuse FINAL d inspection puis implémente, corrige et valide", async () => {
  const objective = "Transforme ce repository minimal en petite application React TypeScript jouable avec plusieurs fichiers. Lance le build, puis vérifie Git status et Git diff.";
  const premature = { type: "FINAL", summary: "Stack absente", report: "Le dépôt ne contient que .git, README.md et hello-forge.txt. Aucune stack n’est présente; prochaines étapes: initialiser l’application." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Inspecter la racine", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire README", tool: "read_file", input: { path: "README.md" } },
    premature,
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /Mission incomplète/); assert.match(history, /créer ou modifier/); assert.match(history, /validation demandée/); assert.match(history, /Repository minimal confirmé/i); return { type: "TOOL_CALL", summary: "Initialiser package", tool: "write_file", input: { path: "package.json", content: '{"scripts":{"build":"vite build"}}' } }; },
    { type: "TOOL_CALL", summary: "Créer la page", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App(){return <main>ECLYRA</main>}" } },
    { type: "TOOL_CALL", summary: "Construire", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Corriger la page", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App() { return <main>ECLYRA</main>; }" } },
    { type: "TOOL_CALL", summary: "Reconstruire", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Application prête", report: "Application créée et build validé." },
    { type: "FINAL", summary: "Application prête", report: "Application créée, build réussi, Git status et Git diff réels vérifiés sans commit ni push." },
    { type: "FINAL", summary: "Application prête", report: "Application créée, build réussi, Git status et Git diff réels vérifiés sans commit ni push." },
  ], false, { entries: [{ path: ".git", type: "directory", size: 0 }, { path: "README.md", type: "file", size: 20 }, { path: "hello-forge.txt", type: "file", size: 23 }], files: { "README.md": "# ECLYRA minimal", "hello-forge.txt": "Hello from NØLINE Forge" }, commandResults: [
    { stdout: "", stderr: "src/App.tsx:1:1 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 8 },
    { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 },
  ] });
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(target.lists, ["."]);
  assert.ok(target.reads.includes("README.md"));
  assert.ok(target.reads.includes("package.json"));
  assert.ok(target.reads.includes("src/App.tsx"));
  assert.equal(target.steps.find((step) => step.summary === "Stack absente")?.type, undefined);
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 1);
  assert.equal(target.steps.find((step) => step.summary === "Construire")?.status, "FAILED");
  assert.equal(target.steps.find((step) => step.summary === "Reconstruire")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /git_commit|git_push/);
});

test("repository minimal traite un fichier optionnel absent comme information puis implémente", async () => {
  const objective = "Construis une petite application TypeScript avec plusieurs fichiers, exécute le build puis vérifie Git status et Git diff.";
  const target = harness([
    { type: "TOOL_CALL", summary: "Lister la racine", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Chercher package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Rechercher package absent", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Lire README", tool: "read_file", input: { path: "README.md" } },
    { type: "FAIL", summary: "Inspection insuffisante", error: "Aucun fichier source n’a été localisé." },
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /OPTIONAL FILE ABSENT/); assert.match(history, /Repository minimal confirmé/); assert.match(history, /obligation d.inspection est satisfaite/i); assert.match(history, /write_file\/delete_file/); return { type: "TOOL_CALL", summary: "Créer package", tool: "write_file", input: { path: "package.json", content: '{"scripts":{"build":"tsc"}}' } }; },
    { type: "TOOL_CALL", summary: "Créer source", tool: "write_file", input: { path: "src/main.ts", content: "export const game = 'draft';" } },
    { type: "TOOL_CALL", summary: "Valider", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Corriger", tool: "write_file", input: { path: "src/main.ts", content: "export const game = 'ready';" } },
    { type: "TOOL_CALL", summary: "Revalider", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Application créée et build réussi." },
    { type: "FINAL", summary: "Terminé", report: "Application créée, build réussi, Git status et Git diff vérifiés." },
    { type: "FINAL", summary: "Terminé", report: "Application créée, build réussi, Git status et Git diff vérifiés sans commit ni push." },
  ], false, { entries: [{ path: ".git", type: "directory", size: 0 }, { path: "README.md", type: "file", size: 20 }, { path: "hello-forge.txt", type: "file", size: 23 }], files: { "README.md": "# Dépôt minimal", "hello-forge.txt": "Hello from NØLINE Forge" }, missingFiles: ["package.json"], commandResults: [
    { stdout: "", stderr: "src/main.ts:1:1 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 8 },
    { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 },
  ] });
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.reads.filter((path) => path === "package.json").length, 2);
  assert.equal(target.steps.find((step) => step.summary === "Inspection déjà satisfaite")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.summary === "Chercher package")?.status, "FAILED");
  assert.match(String(target.steps.find((step) => step.summary === "Chercher package")?.resultSummary), /OPTIONAL FILE ABSENT/);
  assert.equal(target.steps.find((step) => step.summary === "Inspection insuffisante"), undefined);
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
});

test("inspection identique réussie n’est pas exécutée deux fois", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lister", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Relister 1", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Relister 2", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Relister 3", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Créer", tool: "write_file", input: { path: "src/main.ts", content: "export {};" } },
    { type: "TOOL_CALL", summary: "Relister après mutation", tool: "list_files", input: { path: "." } },
    { type: "FINAL", summary: "Terminé", report: "Création terminée." },
    { type: "FINAL", summary: "Terminé", report: "Création et Git vérifiés." },
    { type: "FINAL", summary: "Terminé", report: "Création et Git vérifiés sans commit ni push." },
  ]);
  assert.equal((await target.runner.run("user-a", "conversation-a", "Crée src/main.ts.")).status, "COMPLETED");
  assert.deepEqual(target.lists, [".", "."]);
  assert.equal(target.steps.filter((step) => step.summary === "Inspection déjà satisfaite").length, 3); assert.ok(target.steps.filter((step) => step.summary === "Inspection déjà satisfaite").every((step) => step.status === "COMPLETED")); assert.match(JSON.stringify(target.steps), /INSPECTION_SATISFIED.*write_file\/delete_file/);
});
test("mission mutative ne peut pas terminer après une simple inspection", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Inspecter", tool: "list_files", input: { path: "." } },
    { type: "FINAL", summary: "Terminé", report: "Repository inspecté." },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /write_file\/delete_file/); return { type: "TOOL_CALL", summary: "Créer", tool: "write_file", input: { path: "src/new.ts", content: "export {};" } }; },
    { type: "FINAL", summary: "Terminé", report: "Fichier créé et preuves Git obtenues." },
    { type: "FINAL", summary: "Terminé", report: "Fichier créé et preuves Git obtenues." },
    { type: "FINAL", summary: "Terminé", report: "Fichier créé et preuves Git obtenues." },
  ]);
  assert.equal((await target.runner.run("user-a", "conversation-a", "Inspecte puis crée src/new.ts.")).status, "COMPLETED");
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 1);
});

test("blocker réel provider après échec outil reste terminal", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Inspecter", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire configuration indispensable", tool: "read_file", input: { path: "locked.config" } },
    { type: "FAIL", summary: "Provider bloqué", error: "Le runtime provider est réellement indisponible." },
  ], false, { blockedFiles: ["locked.config"] });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Crée une application à partir de locked.config."), /provider est réellement indisponible/i);
  assert.equal(target.run()?.status, "FAILED");
  assert.equal(target.steps.find((step) => step.summary === "Lire configuration indispensable")?.status, "FAILED");
  assert.match(String(target.steps.find((step) => step.summary === "Lire configuration indispensable")?.resultSummary), /TOOL ERROR/);
});
test("mission complexe récupère un FAIL prématuré puis utilise réellement le runtime", async () => {
  const objective = "Inspecte le repository. S’il est minimal, initialise une application React TypeScript puis crée une première page. Vérifie ensuite le build et Git diff.";
  const target = harness([
    { type: "FAIL", summary: "Impossible de poursuivre", error: "Aucun outil n’a encore été appelé dans cette session." },
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /RECOVERY(?::| 1\/3)/); assert.match(history, /list_files.*read_file.*write_file.*run_command.*git_status.*git_diff/); return { type: "TOOL_CALL", summary: "Inspecter la racine", tool: "list_files", input: { path: "." } }; },
    { type: "TOOL_CALL", summary: "Lire package.json", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Créer la page", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App(){return <main>ECLYRA</main>}" } },
    { type: "TOOL_CALL", summary: "Vérifier le build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Corriger la page", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App() { return <main>ECLYRA</main>; }" } },
    { type: "TOOL_CALL", summary: "Relancer le build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Vérifier Git status", tool: "git_status", input: {} },
    { type: "TOOL_CALL", summary: "Vérifier Git diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Application validée", report: "Repository inspecté, page React TypeScript créée, build validé et Git status/diff vérifiés sans commit ni push." },
  ], false, { commandResults: [
    { stdout: "", stderr: "src/App.tsx:1:1 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 8 },
    { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 },
  ] });
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(target.lists, ["."]);
  assert.ok(target.reads.includes("package.json"));
  assert.equal(target.writes.length, 2);
  assert.equal(target.commands.length, 2);
  assert.equal(target.steps.find((step) => step.summary === "Vérifier le build")?.status, "FAILED");
  assert.equal(target.steps.find((step) => step.summary === "Relancer le build")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.equal(target.run()?.status, "COMPLETED");
});

test("trois terminaisons prématurées sans outil échouent proprement sans boucle", async () => {
  const refusal = { type: "FAIL", summary: "Refus", error: "Je ne peux pas utiliser les outils." };
  const target = harness([refusal, refusal, refusal, refusal]);
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Inspecte et modifie le repository"), /refuse de progresser dans la récupération requise/);
  assert.equal(target.run()?.status, "FAILED");
  assert.equal(target.steps.filter((step) => step.summary === "Démarrage agentique incomplet").length, 3);
  assert.equal(target.contexts.length, 3);
  assert.equal(target.reads.length + target.writes.length + target.lists.length + target.commands.length, 0);
});
test("appel shell Git invalide reçoit une erreur structurée et ne boucle pas", async () => {
  const invalid = { type: "TOOL_CALL", summary: "Git combiné", tool: "run_command", input: { command: "git status --short && printf '\\n---DIFF---\\n' && git diff -- hello-forge.txt", args: [], cwd: "." } };
  const target = harness([
    invalid,
    invalid,
    (context: Record<string, unknown>) => { const serialized = JSON.stringify(context); assert.match(serialized, /run_command/); assert.match(serialized, /Appel identique déjà refusé|TOOL ERROR/); return { type: "TOOL_CALL", summary: "Git status dédié", tool: "git_status", input: {} }; },
    { type: "FINAL", summary: "Status vérifié", report: "Git status exécuté avec l’outil dédié." },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", "Vérifie Git status");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands.length, 0);
  assert.equal(target.steps.filter((step) => step.summary === "Git combiné").length, 2);
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
});

test("recovery Git mutatif invalide redirige vers artifact puis Publication V1.5", async () => {
  const invalidGit = { type: "TOOL_CALL", summary: "Créer la branche", tool: "run_command", input: { command: "git", args: ["switch", "-c", "forge/v15-live-publication-test"], cwd: "." } };
  const target = harness([
    { type: "PLAN", summary: "Préparer", plan: ["Créer le fichier", "Vérifier le diff", "Publier via le panneau contrôlé"] },
    invalidGit,
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /CONTROLLED_GIT_WORKFLOW/); assert.match(history, /write_file.*git_status.*git_diff.*FINAL/); assert.match(history, /panneau Publication V1\.5/); return { type: "TOOL_CALL", summary: "Créer le fichier demandé", tool: "write_file", input: { path: "forge-v15-live-test.txt", content: "NØLINE Forge V1.5 live publication test" } }; },
    { type: "TOOL_CALL", summary: "Vérifier Git status", tool: "git_status", input: {} },
    { type: "TOOL_CALL", summary: "Vérifier Git diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Artifact prêt", report: "Le fichier et le diff sont prêts; branche et commit restent des actions utilisateur du panneau Publication V1.5." },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", "Crée le fichier demandé puis prépare une branche Forge contrôlée");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands.length, 0);
  assert.deepEqual(target.writes, ["forge-v15-live-test.txt"]);
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.equal(target.artifacts.length, 1);
});

test("anti-loop bloque toujours trois appels Git invalides strictement identiques", async () => {
  const invalidGit = { type: "TOOL_CALL", summary: "Créer la branche", tool: "run_command", input: { command: "git", args: ["switch", "-c", "forge/repeat"], cwd: "." } };
  const target = harness([invalidGit, invalidGit, invalidGit]);
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Crée une branche Forge"), /répète un appel d’outil invalide/);
  assert.equal(target.run()?.status, "FAILED");
  assert.equal(target.commands.length, 0);
  assert.equal(target.steps.filter((step) => step.tool === "run_command").length, 2);
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
  ], false, { commandResults: [
    { stdout: "", stderr: "src/index.ts:1:1 test failure", exitCode: 1, timedOut: false, truncated: false, durationMs: 8 },
    { stdout: "tests pass", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 },
  ] });
  const result = await target.runner.run("user-a", "conversation-a", "Corriger le testbed");
  assert.equal(result.status, "COMPLETED"); assert.equal(target.commands.length, 2); assert.equal(target.writes.length, 2); assert.equal(target.run()?.baseCommitSha, "a".repeat(40)); assert.equal(target.steps.find((step) => step.summary === "Tester")?.status, "FAILED"); assert.equal(target.steps.find((step) => step.summary === "Retester")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /repository-secret-source|"content":"first"/);
});

test("authentification et ownership sont dérivés côté serveur", async () => { await assert.rejects(() => harness([]).runner.run("", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "UNAUTHENTICATED"); await assert.rejects(() => harness([]).runner.run("user-b", "conversation-a", "Mission"), /not found/); });
test("annulation empêche tout appel modèle ou outil", async () => { const target = harness([{ type: "FINAL", summary: "non", report: "non" }], true); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "CANCELLED"); assert.equal(target.steps.length, 0); assert.equal(target.run()?.status, "CANCELLED"); });
test("annulation pendant un outil ne peut pas réactiver le run", async () => { const checks = [false, false, false, false, true]; const target = harness([{ type: "PLAN", summary: "plan", plan: ["status"] }, { type: "TOOL_CALL", summary: "status", tool: "git_status", input: {} }], () => checks.shift() ?? true); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "CANCELLED"); assert.equal(target.run()?.status, "CANCELLED"); });test("limite outils arrête la boucle", async () => { const decisions = [{ type: "PLAN", summary: "plan", plan: ["inspecter"] }, ...Array.from({ length: FORGE_AGENT_LIMITS.maxToolCalls + 1 }, () => ({ type: "TOOL_CALL", summary: "status", tool: "git_status", input: {} }))]; const target = harness(decisions); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "LIMIT"); assert.equal(target.run()?.status, "FAILED"); });
test("filesystem normalise les slashs terminaux et refuse traversal, absolu et fichiers sensibles", () => { assert.equal(normalizeAgentPath("src/", true), "src"); assert.equal(normalizeAgentPath("./src/", true), "src"); assert.equal(normalizeAgentPath("src/components/", true), "src/components"); assert.throws(() => normalizeAgentPath("../secret")); assert.throws(() => normalizeAgentPath("/etc/passwd")); assert.throws(() => normalizeAgentPath("C:/Windows")); assert.throws(() => normalizeAgentPath(".env")); assert.equal(normalizeAgentPath(".env.example"), ".env.example"); });
test("command policy refuse shell, secrets, host et Git write", () => { for (const input of [{ command: "bash", args: [], cwd: "." }, { command: "node", args: ["/etc/passwd"], cwd: "." }, { command: "git", args: ["status"], cwd: "." }, { command: "npm", args: ["publish"], cwd: "." }, { command: "vercel", args: ["deploy"], cwd: "." }, { command: "env", args: [], cwd: "." }, { command: "npm", args: ["install", "--token", "provider-secret"], cwd: "." }]) assert.throws(() => normalizeAgentCommand(input)); assert.equal(normalizeAgentCommand({ command: "npm", args: ["test"], cwd: ".", timeoutMs: 999999 }).timeoutMs, 60_000); });
test("protocole modèle borne les décisions et outils", () => { const source = fs.readFileSync("lib/forge/agent-model.ts", "utf8"); for (const type of ["PLAN", "TOOL_CALL", "FINAL", "FAIL"]) assert.match(source, new RegExp(type)); assert.doesNotMatch(source, /git_push|git_commit/); assert.match(source, /jsonMode: true/); assert.match(source, /RECOVERY/); assert.match(source, /INSPECTION_SATISFIED/); for (const tool of ["list_files", "search_code", "read_file", "write_file", "delete_file", "run_command", "git_status", "git_diff"]) assert.match(source, new RegExp(tool)); });
test("redaction supprime tokens et secrets des résumés", () => { const text = sanitizeAgentText("OPENAI_API_KEY=super-secret-value ghp_abcdefghijklmnopqrstuvwxyz https://user:password@example.com Bearer provider-token"); assert.doesNotMatch(text, /super-secret|ghp_|user:password|provider-token/); });
test("routes agentiques exigent authenticateForge et n’exposent aucun secret", () => { for (const path of ["app/api/forge/conversations/[conversationId]/agent-runs/route.ts", "app/api/forge/conversations/[conversationId]/agent-runs/[runId]/route.ts"]) { const source = fs.readFileSync(path, "utf8"); assert.match(source, /authenticateForge\(request\)/); assert.doesNotMatch(source, /DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY|providerRuntimeId/); } });
test("limite étapes empêche toute boucle infinie", async () => { const target = harness(Array.from({ length: FORGE_AGENT_LIMITS.maxSteps }, () => ({ type: "PLAN", summary: "plan", plan: ["continuer"] }))); await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Mission"), (error: unknown) => (error as { code?: string }).code === "LIMIT"); assert.equal(target.steps.length, FORGE_AGENT_LIMITS.maxSteps); });
test("runtime agentique revalide workspace runtime SHA et expiration", () => { const source = fs.readFileSync("lib/forge/agent-runtime.ts", "utf8"); assert.match(source, /findRuntimeByWorkspace/); assert.match(source, /runtime\.status !== "READY"/); assert.match(source, /runtime\.expiresAt/); assert.match(source, /runtime\.baseCommitSha !== workspace\.baseCommitSha/); assert.doesNotMatch(source, /child_process|execSync|spawnSync/); });
test("migration RLS relie user projet conversation workspace et runtime", () => { const sql = fs.readFileSync("supabase/migrations/20260824_forge_v14_agentic_execution_loop.sql", "utf8"); for (const value of ["auth.uid() = forge_agent_runs.user_id", "c.id = forge_agent_runs.conversation_id", "p.id = forge_agent_runs.forge_project_id", "w.id = forge_agent_runs.workspace_id", "rt.id = forge_agent_runs.runtime_id", "auth.uid() = forge_agent_steps.user_id", "r.id = forge_agent_steps.run_id", "drop policy if exists", "enable row level security"]) assert.ok(sql.includes(value)); assert.doesNotMatch(sql, /provider_runtime_id|private key/i); });
test("contrat DB des steps Forge reste synchronisé avec les types runtime", () => {
  const foundation = fs.readFileSync("supabase/migrations/20260824_forge_v14_agentic_execution_loop.sql", "utf8");
  const extension = fs.readFileSync("supabase/migrations/20260924135359_extend_forge_agent_step_tools.sql", "utf8");
  const stepSchema = foundation.slice(foundation.indexOf("create table if not exists public.forge_agent_steps"));
  const values = (sql: string, column: string) => {
    const match = sql.match(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]+)\\)`, "is"));
    if (!match) throw new Error(`contrainte ${column} absente`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]).sort();
  };
  assert.deepEqual(values(stepSchema, "type"), [...FORGE_AGENT_STEP_TYPES].sort());
  assert.deepEqual(values(stepSchema, "status"), [...FORGE_AGENT_STEP_STATUSES].sort());
  assert.deepEqual(values(extension, "tool"), [...FORGE_AGENT_TOOL_NAMES].sort());
  assert.ok(FORGE_AGENT_TOOL_NAMES.includes("search_code"));
  assert.match(extension, /drop constraint if exists forge_agent_steps_tool_check/i);
  assert.match(extension, /add constraint forge_agent_steps_tool_check/i);
  assert.doesNotMatch(extension, /drop table|truncate|disable row level security/i);
  const runtime = fs.readFileSync("lib/forge/agent-foundation.ts", "utf8");
  assert.match(runtime, /DISCOVERY_REQUIRED/);
  assert.match(runtime, /PHASE_ACTION_REJECTED/);
});
test("titre automatique est déterministe et ne consomme aucun modèle", () => { assert.equal(deriveForgeConversationTitle("Inspecte package.json et indique le nom du projet."), "Inspection package.json"); });
test("renommage session et titre automatique conservent auth ownership et titre manuel", () => { const route = fs.readFileSync("app/api/forge/conversations/[conversationId]/route.ts", "utf8"), store = fs.readFileSync("lib/forge/forge-store.ts", "utf8"); assert.match(route, /authenticateForge\(request\)/); assert.match(route, /setForgeConversationTitle\(user\.id/); assert.match(store, /getForgeConversation\(userId, conversationId\)/); assert.match(store, /conversation\.title !== DEFAULT_FORGE_CONVERSATION_TITLE/); });
test("aucun secret ou accès host dans le bundle agentique", () => { const sources = ["lib/forge/agent-foundation.ts", "lib/forge/agent-model.ts", "lib/forge/agent-runtime.ts", "components/ForgeAgentRunnerPanel.tsx"].map((path) => fs.readFileSync(path, "utf8")).join("\n"); assert.doesNotMatch(sources, /process\.env\.(?:DAYTONA_API_KEY|GITHUB_APP_PRIVATE_KEY)|child_process|Bun\.spawn|Deno\.Command/); });

test("repository minimal récupère npm en échec puis initialise, relit, valide et produit Git", async () => {
  const objective = "Transforme ce repository minimal en application TypeScript multi-fichiers. Installe les dépendances, lance le build, corrige les erreurs, puis vérifie Git status et Git diff.";
  const target = harness([
    { type: "TOOL_CALL", summary: "Inspecter", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire README", tool: "read_file", input: { path: "README.md" } },
    { type: "TOOL_CALL", summary: "Installer", tool: "run_command", input: { command: "npm", args: ["install"], cwd: "." } },
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /COMMAND_EXECUTED_NONZERO.*command=npm.*args=.*install.*exitCode=1/); assert.match(history, /registry temporairement indisponible/); assert.match(history, /"args":\["install"\]/); return { type: "TOOL_CALL", summary: "Relister après npm", tool: "list_files", input: { path: "." } }; },
    { type: "TOOL_CALL", summary: "Relire après npm", tool: "read_file", input: { path: "README.md" } },
    { type: "TOOL_CALL", summary: "Créer package", tool: "write_file", input: { path: "package.json", content: '{"scripts":{"build":"tsc"}}' } },
    { type: "TOOL_CALL", summary: "Créer index", tool: "write_file", input: { path: "index.html", content: "<main id=app></main>" } },
    { type: "TOOL_CALL", summary: "Créer source", tool: "write_file", input: { path: "src/main.ts", content: "export const state = 'draft';" } },
    { type: "TOOL_CALL", summary: "Relister après mutation", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Build initial", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Corriger source", tool: "write_file", input: { path: "src/main.ts", content: "export const state = 'ready';" } },
    { type: "TOOL_CALL", summary: "Build final", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Application créée, build réussi et preuves Git obtenues." },
    { type: "FINAL", summary: "Terminé", report: "Application créée, build réussi et preuves Git obtenues." },
    { type: "FINAL", summary: "Terminé", report: "Application créée, build réussi; Git status et Git diff réels vérifiés sans commit ni push." },
  ], false, {
    entries: [{ path: ".git", type: "directory", size: 0 }, { path: "README.md", type: "file", size: 18 }, { path: "hello-forge.txt", type: "file", size: 23 }],
    files: { "README.md": "# Minimal testbed", "hello-forge.txt": "Hello from NØLINE Forge" },
    commandResults: [
      { stdout: "", stderr: "npm ERR! registry temporairement indisponible", exitCode: 1, timedOut: false, truncated: false, durationMs: 12 },
      { stdout: "", stderr: "src/main.ts: erreur simulée", exitCode: 2, timedOut: false, truncated: false, durationMs: 15 },
      { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 9 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", objective);
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(target.commands.map((command) => [command.command, command.args, command.cwd]), [["npm", ["install"], "."], ["npm", ["run", "build"], "."], ["npm", ["run", "build"], "."]]);
  assert.equal(target.lists.length, 3);
  assert.equal(target.reads.filter((path) => path === "README.md").length, 2);
  assert.equal(target.files.get("index.html"), "<main id=app></main>");
  assert.equal(target.files.get("src/main.ts"), "export const state = 'ready';");
  assert.match(String(target.steps.find((step) => step.summary === "Installer")?.resultSummary), /npm install exited 1.*registry temporairement indisponible/);
  assert.equal(target.steps.find((step) => step.summary === "Relister après npm")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.summary === "Relire après npm")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.summary === "Build initial")?.status, "FAILED");
  assert.equal(target.steps.find((step) => step.summary === "Build final")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /git_add|git_commit|git_push/);
});

test("write_file invalide reste récupérable, observable et ne compte pas comme mutation", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Écriture incomplète", tool: "write_file", input: { path: "index.html" } },
    { type: "FAIL", summary: "Abandon prématuré", error: "write_file a échoué." },
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /contentProvided[^]*false/); assert.match(history, /INVALID_INPUT/); assert.match(history, /RECOVERY(?::| 1\/3)/); assert.match(history, /write_file/); return { type: "TOOL_CALL", summary: "Écriture corrigée", tool: "write_file", input: { path: "index.html", content: "<!doctype html>" } }; },
    { type: "FINAL", summary: "Terminé", report: "index.html créé et vérifié." },
    { type: "FINAL", summary: "Terminé", report: "index.html créé; Git status vérifié." },
    { type: "FINAL", summary: "Terminé", report: "index.html créé; Git status et Git diff vérifiés." },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", "Crée index.html puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.writes.length, 1);
  assert.equal(target.files.get("index.html"), "<!doctype html>");
  assert.match(String(target.steps.find((step) => step.summary === "Écriture incomplète")?.resultSummary), /TOOL ERROR \[INVALID_INPUT\].*contentProvided.*false/);
  assert.equal(target.steps.find((step) => step.summary === "Écriture corrigée")?.status, "COMPLETED");
});


test("list_files normalise src slash terminal et la persistance ordonne recovery puis FINAL", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lister la racine", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Lister src", tool: "list_files", input: { path: "src/" } },
    { type: "TOOL_CALL", summary: "Écriture incomplète", tool: "write_file", input: { path: "src/index.ts" } },
    { type: "FAIL", summary: "Abandon prématuré", error: "write_file a échoué." },
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /TOOL ERROR \[INVALID_INPUT\]/); assert.match(history, /RECOVERY(?::| 1\/3)/); return { type: "TOOL_CALL", summary: "Écrire source", tool: "write_file", input: { path: "src/index.ts", content: "export const ready = true;" } }; },
    { type: "TOOL_CALL", summary: "Valider", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Source créée et testée." },
    { type: "FINAL", summary: "Terminé", report: "Source créée, testée et Git status vérifié." },
    { type: "FINAL", summary: "Terminé", report: "Source créée, testée; Git status et Git diff réels vérifiés." },
  ], false, { files: { "package.json": '{"scripts":{}}' }, commandResults: [{ stdout: "PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 }] });
  const result = await target.runner.run("user-a", "conversation-a", "Inspecte puis crée la source, lance les tests et vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.runCreates(), 1);
  assert.deepEqual(target.lists, [".", "src"]);
  assert.equal((target.steps.find((step) => step.summary === "Lister src")?.input as Record<string, unknown>)?.path, "src");
  assert.equal(target.steps.find((step) => step.summary === "Écriture incomplète")?.status, "FAILED");
  assert.equal(target.steps.find((step) => step.summary === "Écrire source")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.deepEqual(target.steps.map((step) => step.stepNumber), target.steps.map((_step, index) => index + 1));
  assert.equal(new Set(target.steps.map((step) => step.stepNumber)).size, target.steps.length);
  assert.match(String(target.run()?.finalReport), /Git status et Git diff réels/);
});

test("migration AgentRun aligne idempotemment objective sur la limite 50000", () => {
  const sql = fs.readFileSync("supabase/migrations/20260825_forge_agent_objective_length.sql", "utf8");
  assert.match(sql, /drop constraint if exists forge_agent_runs_objective_check/i);
  assert.match(sql, /add constraint forge_agent_runs_objective_check/i);
  assert.match(sql, /length\(objective\) between 1 and 50000/i);
  assert.doesNotMatch(sql, /drop table|truncate/i);
});

test("diagnostic de persistance expose seulement opération et code sûrs", () => {
  const source = fs.readFileSync("lib/forge/agent-store.ts", "utf8");
  assert.match(source, /Forge agent persistence failure/);
  assert.match(source, /\{ operation, code \}/);
  assert.match(source, /Persistance Forge impossible \(\$\{operation\}, code \$\{code\}\)/);
  assert.doesNotMatch(source, /console\.error\([^\n]*(?:path|body|userId|runId|token|secret)/i);
});


test("mission complexe dépasse 20 étapes utiles et termine dans le budget borné", async () => {
  const decisions: Array<Record<string, unknown>> = [
    ...Array.from({ length: 5 }, (_item, index) => ({ type: "TOOL_CALL", summary: `Lire config ${index}`, tool: "read_file", input: { path: `config-${index}.json` } })),
    ...Array.from({ length: 12 }, (_item, index) => ({ type: "TOOL_CALL", summary: `Créer fichier ${index}`, tool: "write_file", input: { path: `src/file-${index}.ts`, content: `export const value${index} = ${index};` } })),
    { type: "TOOL_CALL", summary: "Valider une première fois", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Inspecter après mutations", tool: "list_files", input: { path: "src" } },
    { type: "TOOL_CALL", summary: "Appliquer la correction", tool: "write_file", input: { path: "src/final.ts", content: "export const ready = true;" } },
    { type: "TOOL_CALL", summary: "Validation finale", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Implémentation et validations terminées." },
    { type: "FINAL", summary: "Terminé", report: "Implémentation, validations et Git status terminés." },
    { type: "FINAL", summary: "Terminé", report: "Implémentation, validations, Git status et Git diff réels terminés sans commit ni push." },
  ];
  const target = harness(decisions, false, { commandResults: [
    { stdout: "PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 5 },
    { stdout: "PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 5 },
  ] });
  const result = await target.runner.run("user-a", "conversation-a", "Crée une application multi-fichiers, lance les tests et vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.ok(target.steps.length > 20);
  assert.equal(target.steps.length, 25);
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.doesNotMatch(JSON.stringify(target.steps), /git_add|git_commit|git_push/);
});

test("anti-loop arrête quatre inspections répétées bien avant le plafond de 60 étapes", async () => {
  const repeated = { type: "TOOL_CALL", summary: "Relister", tool: "list_files", input: { path: "." } };
  const target = harness([{ ...repeated, summary: "Inspection initiale" }, ...Array.from({ length: 10 }, () => repeated)]);
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Inspecte le repository."), /ne progresse pas après quatre récupérations structurées/);
  assert.equal(target.lists.length, 1);
  assert.equal(target.steps.length, 6);
  assert.ok(target.steps.length < FORGE_AGENT_LIMITS.maxSteps);
});

test("budget Forge reste borné à 60 étapes, 48 outils et contraintes SQL alignées", () => {
  assert.equal(FORGE_AGENT_LIMITS.maxSteps, 60);
  assert.equal(FORGE_AGENT_LIMITS.maxToolCalls, 48);
  assert.equal(FORGE_AGENT_LIMITS.maxRuntimeSeconds, 240);
  assert.equal(FORGE_AGENT_LIMITS.maxCommandTimeoutMs, 60_000);
  const sql = fs.readFileSync("supabase/migrations/20260825_forge_agent_step_budget.sql", "utf8");
  assert.match(sql, /drop constraint if exists forge_agent_steps_step_number_check/i);
  assert.match(sql, /step_number between 1 and 60/i);
  assert.doesNotMatch(sql, /drop table|truncate/i);
});


test("repository minimal: validation npm non applicable quitte la recovery sans mutation corrective artificielle", async () => {
  const fileContent = "NØLINE Forge V1.5 live publication test";
  const realPatch = `diff --git a/forge-v15-live-test.txt b/forge-v15-live-test.txt
new file mode 100644
--- /dev/null
+++ b/forge-v15-live-test.txt
@@ -0,0 +1 @@
+${fileContent}`;
  const target = harness([
    { type: "TOOL_CALL", summary: "Inspecter le repository minimal", tool: "list_files", input: { path: "." } },
    { type: "TOOL_CALL", summary: "Lire README", tool: "read_file", input: { path: "README.md" } },
    { type: "TOOL_CALL", summary: "Créer le fichier de test", tool: "write_file", input: { path: "forge-v15-live-test.txt", content: fileContent } },
    { type: "TOOL_CALL", summary: "Relire le fichier de test", tool: "read_file", input: { path: "forge-v15-live-test.txt" } },
    { type: "TOOL_CALL", summary: "Tester npm si applicable", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    (context: Record<string, unknown>, constraint?: Record<string, unknown>) => {
      assert.equal(constraint?.phase, "NORMAL");
      assert.match(JSON.stringify(context), /VALIDATION_NOT_APPLICABLE/);
      return { type: "FINAL", summary: "Final prématuré avant Git", report: "Je vais terminer la mission." };
    },
    { type: "FINAL", summary: "Final prématuré après status", report: "Je vais terminer la mission." },
    { type: "FINAL", summary: "Final prématuré après diff", report: "Je vais terminer la mission." },
    { type: "FINAL", summary: "Mission terminée", report: "Le fichier demandé existe avec le contenu exact; validation npm non applicable; Git status et Git diff réels vérifiés." },
  ], false, {
    entries: [{ path: "README.md", type: "file", size: 48 }],
    files: { "README.md": "# Forge Testbed\nRepository minimal de validation Forge." },
    missingFiles: ["package.json"],
    commandResults: [{ stdout: "", stderr: "npm error code ENOENT\nnpm error path /home/daytona/repo/package.json", exitCode: 254, timedOut: false, truncated: false, durationMs: 5 }],
    gitDiff: { added: ["forge-v15-live-test.txt"], modified: [], deleted: [], patch: realPatch, truncated: false },
  });
  const result = await target.runner.run("user-a", "conversation-a", "Crée forge-v15-live-test.txt contenant exactement NØLINE Forge V1.5 live publication test, puis valide si applicable et vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.files.get("forge-v15-live-test.txt"), fileContent);
  assert.equal(target.writes.filter((path: string) => path === "forge-v15-live-test.txt").length, 1);
  assert.equal(target.writes.includes("package.json"), false);
  assert.ok(target.reads.includes("README.md"));
  assert.ok(target.reads.includes("forge-v15-live-test.txt"));
  assert.equal(target.reads.includes("package.json"), false);
  assert.equal(target.commands.length, 1);
  assert.equal(target.constraints.some((constraint) => constraint?.phase === "CORRECTION_REQUIRED"), false);
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.equal(target.steps.filter((step) => step.type === "FINAL" && step.status === "COMPLETED").length, 1);
  assert.match(String(target.steps.find((step) => step.summary === "Résultat final prématuré")?.resultSummary), /NEXT_REQUIRED_ACTION: final/);
  assert.deepEqual(target.steps.filter((step) => step.tool === "git_status" || step.tool === "git_diff").map((step) => step.tool), ["git_status", "git_diff"]);
  assert.equal(target.artifacts.length, 1);
  assert.equal(target.artifacts[0]?.patch, realPatch);
  assert.ok(target.events.indexOf("ARTIFACT") < target.events.lastIndexOf("FINAL"));
});

test("NEXT_REQUIRED_ACTION guide FAIL de git_status vers git_diff puis artifact et FINAL", async () => {
  const incomplete = { type: "FAIL", summary: "Mission incomplète", error: "Je tente de terminer trop tôt." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Créer résultat", tool: "write_file", input: { path: "result.txt", content: "ready" } },
    incomplete,
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /NEXT_REQUIRED_ACTION: git_status/); return { type: "TOOL_CALL", summary: "Status requis", tool: "git_status", input: {} }; },
    incomplete,
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /NEXT_REQUIRED_ACTION: git_diff/); return { type: "TOOL_CALL", summary: "Diff requis", tool: "git_diff", input: {} }; },
    incomplete,
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /NEXT_REQUIRED_ACTION: final/); return { type: "FINAL", summary: "Mission terminée", report: "result.txt a été créé; Git status et Git diff réels ont été vérifiés et artifact sauvegardé." }; },
  ]);
  const result = await target.runner.run("user-a", "conversation-a", "Crée result.txt contenant ready puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(target.steps.filter((step) => step.tool === "git_status" || step.tool === "git_diff").map((step) => step.tool), ["git_status", "git_diff"]);
  assert.equal(target.artifacts.length, 1);
  assert.ok(target.events.indexOf("ARTIFACT") < target.events.lastIndexOf("FINAL"));
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 3);
});

test("validation réellement disponible en échec reste bloquée en correction et interdit COMPLETED", async () => {
  const build = { type: "TOOL_CALL", summary: "Build réel", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const premature = { type: "FINAL", summary: "Faux succès", report: "Le build est terminé." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Modifier le code", tool: "write_file", input: { path: "src/App.tsx", content: "broken" } },
    build,
    premature,
    premature,
    premature,
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build"}}', "src/App.tsx": "before" },
    commandResults: [{ stdout: "", stderr: "src/App.tsx:1:1 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 5 }],
  });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Modifie src/App.tsx puis exécute le build disponible."), /aucune action compatible avec la phase CORRECTION_REQUIRED/);
  assert.equal(target.run()?.status, "FAILED");
  assert.equal(target.commands.length, 1);
  assert.equal(target.artifacts.length, 0);
  assert.equal(target.steps.some((step) => step.type === "FINAL" && step.status === "COMPLETED"), false);
  assert.ok(target.constraints.some((constraint) => constraint?.phase === "CORRECTION_REQUIRED"));
});
test("validation npm non nulle impose correction puis autorise la revalidation exacte", async () => {
  const build = { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const premature = { type: "FINAL", summary: "Mission incomplète", report: "Je termine sans corriger." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Créer application", tool: "write_file", input: { path: "src/App.tsx", content: "export default () => <main>draft</main>" } },
    build,
    premature,
    { type: "FAIL", summary: "Abandon", error: "Mission incomplète." },
    (context: Record<string, unknown>, constraint?: Record<string, unknown>) => {
      const retry = JSON.stringify(context);
      assert.equal(constraint?.phase, "CORRECTION_REQUIRED");
      assert.deepEqual(constraint?.allowedTools, ["write_file", "delete_file"]);
      assert.match(retry, /PHASE_ACTION_REJECTED attempt=1\/3 phase=CORRECTION_REQUIRED rejected=FINAL/);
      assert.match(retry, /PHASE_ACTION_REJECTED attempt=2\/3 phase=CORRECTION_REQUIRED rejected=FAIL/);
      assert.match(retry, /NEXT_REQUIRED_ACTION/);
      return { type: "TOOL_CALL", summary: "Corriger application", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App() { return <main>ready</main>; }" } };
    },
    premature,
    build,
    { type: "FINAL", summary: "Terminé", report: "Application corrigée et build réussi." },
    { type: "FINAL", summary: "Terminé", report: "Application corrigée, build réussi et Git status vérifié." },
    { type: "FINAL", summary: "Terminé", report: "Application corrigée, build réussi, Git status et Git diff réels vérifiés sans commit ni push." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build"}}' },
    commandResults: [
      { stdout: "vite build", stderr: "src/App.tsx: TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 10 },
      { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 9 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Inspecte puis crée l’application, lance le build, corrige les erreurs et vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands.length, 2);
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 0);
  assert.equal(target.steps.findLast((step) => step.summary === "Build")?.status, "COMPLETED");
  assert.ok(target.constraints.some((constraint) => constraint?.phase === "CORRECTION_REQUIRED"));
  assert.ok(target.constraints.some((constraint) => constraint?.phase === "REVALIDATION_REQUIRED"));
  assert.equal(target.steps.find((step) => step.tool === "git_status")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.ok(target.steps.length < 60);
  assert.doesNotMatch(JSON.stringify(target.steps), /git_add|git_commit|git_push/);
});
test("script npm absent observé dans package.json ne déclenche aucun retry runtime aveugle", async () => {
  const lint = { type: "TOOL_CALL", summary: "Lint", tool: "run_command", input: { command: "npm", args: ["run", "lint"], cwd: ".", validation: true } };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    lint,
    lint,
    (context: Record<string, unknown>) => { const history = JSON.stringify(context); assert.match(history, /NPM_SCRIPT_UNAVAILABLE/); assert.match(history, /Scripts observés: build/); return { type: "TOOL_CALL", summary: "Ajouter lint", tool: "write_file", input: { path: "package.json", content: '{"scripts":{"build":"vite build","lint":"eslint ."}}' } }; },
    lint,
    { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Scripts lint et build validés." },
    { type: "FINAL", summary: "Terminé", report: "Script lint ajouté, validation et Git status réussis." },
    { type: "FINAL", summary: "Terminé", report: "Script lint ajouté, validation, Git status et Git diff réussis sans commit ni push." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build"}}' },
    commandResults: [{ stdout: "lint PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 }, { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 }],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Ajoute un script lint, exécute la validation puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands.length, 2);
  assert.match(String(target.steps.find((step) => step.summary === "Script npm indisponible")?.resultSummary), /NPM_SCRIPT_UNAVAILABLE/);
  assert.match(String(target.steps.find((step) => step.summary === "Validation identique suspendue")?.resultSummary), /COMMAND_RETRY_BLOCKED/);
});

test("répétition de validation incompatible est stoppée sans nouvel appel runtime", async () => {
  const build = { type: "TOOL_CALL", summary: "Build répété", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const target = harness(Array.from({ length: 6 }, () => build), false, { commandResults: [{ stdout: "", stderr: "build error", exitCode: 1, timedOut: false, truncated: false, durationMs: 6 }] });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Lance le build et corrige les erreurs."), /aucune action compatible avec la phase DIAGNOSTIC/);
  assert.equal(target.commands.length, 1);
  assert.equal(target.steps.filter((step) => step.tool === "run_command").length, 1);
  assert.ok(target.steps.length < FORGE_AGENT_LIMITS.maxSteps);
});
test("run_command invalide conserve un recovery de protocole précis", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Commande invalide", tool: "run_command", input: { command: "npm run build && npm test", args: [], cwd: ".", validation: true } },
    { type: "TOOL_CALL", summary: "Commande corrigée", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Validation exécutée." },
  ], false, { commandResults: [{ stdout: "PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 5 }] });
  const result = await target.runner.run("user-a", "conversation-a", "Lance le build.");
  assert.equal(result.status, "COMPLETED");
  assert.match(String(target.steps.find((step) => step.summary === "Commande invalide")?.resultSummary), /RUN_COMMAND_CONTRACT/);
  assert.equal(target.commands.length, 1);
});

test("trace Production: les phases imposent diagnostic, correction et revalidation", async () => {
  const prematureFail = { type: "FAIL", summary: "Mission incomplète", error: "Impossible de poursuivre sans correction." };
  const prematureFinal = { type: "FINAL", summary: "Terminé", report: "Inspection terminée mais aucune correction disponible." };
  const build = { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Git status prématuré", tool: "git_status", input: {} },
    build,
    prematureFail,
    prematureFinal,
    (_context: Record<string, unknown>, constraint?: Record<string, unknown>) => { assert.equal(constraint?.phase, "CORRECTION_REQUIRED"); assert.deepEqual(constraint?.allowedDecisionTypes, ["TOOL_CALL"]); assert.deepEqual(constraint?.allowedTools, ["write_file", "delete_file"]); return { type: "TOOL_CALL", summary: "Corriger source", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App() { return <main>ready</main>; }" } }; },
    prematureFail,
    (_context: Record<string, unknown>, constraint?: Record<string, unknown>) => { assert.equal(constraint?.phase, "REVALIDATION_REQUIRED"); assert.deepEqual(constraint?.allowedTools, ["run_command"]); return build; },
    { type: "FINAL", summary: "Terminé", report: "Correction appliquée et build réussi." },
    { type: "FINAL", summary: "Terminé", report: "Correction, build et Git status vérifiés." },
    { type: "FINAL", summary: "Terminé", report: "Correction, build, Git status et Git diff vérifiés sans commit ni push." },
  ], false, {
    entries: [{ path: "package.json", type: "file", size: 42 }, { path: "src", type: "directory", size: 0 }],
    files: { "package.json": '{"scripts":{"build":"vite build"}}', "src/App.tsx": "export default () => <main>broken</main>" },
    commandResults: [
      { stdout: "vite build", stderr: "src/App.tsx:4:2 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 8 },
      { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 7 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Corrige l'application, lance le build puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands.length, 2);
  assert.deepEqual(target.reads, ["package.json", "src/App.tsx", "src/App.tsx"]);
  assert.equal(target.files.get("src/App.tsx"), "export default function App() { return <main>ready</main>; }");
  assert.equal(target.steps.findLast((step) => step.summary === "Build")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_status" && step.summary !== "Git status prématuré")?.status, "COMPLETED");
  assert.equal(target.steps.find((step) => step.tool === "git_diff")?.status, "COMPLETED");
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 0);
  assert.ok(target.steps.length < 30);
  assert.ok(target.commands.length + target.reads.length + target.writes.length < 20);
  assert.doesNotMatch(JSON.stringify(target.steps), /git_add|git_commit|git_push/);
});
test("vrai anti-loop refuse trois terminaisons incompatibles sans consommer de steps", async () => {
  const build = { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const refusal = { type: "FAIL", summary: "Refus", error: "Je ne corrige pas le projet." };
  const target = harness([build, refusal, refusal, refusal, refusal], false, {
    commandResults: [{ stdout: "", stderr: "src/App.tsx:1:1 TypeScript error", exitCode: 1, timedOut: false, truncated: false, durationMs: 5 }],
  });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Corrige l'application et lance le build."), /aucune action compatible avec la phase CORRECTION_REQUIRED/);
  assert.equal(target.commands.length, 1);
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 0);
  assert.equal(target.steps.length, 3);
  assert.equal(target.constraints.filter((constraint) => constraint?.phase === "CORRECTION_REQUIRED").length, 3);
  const correctionContexts = target.contexts.filter((_, index) => target.constraints[index]?.phase === "CORRECTION_REQUIRED");
  assert.doesNotMatch(JSON.stringify(correctionContexts[0]), /PHASE_ACTION_REJECTED/);
  assert.match(JSON.stringify(correctionContexts[1]), /PHASE_ACTION_REJECTED attempt=1\/3/);
  assert.match(JSON.stringify(correctionContexts[2]), /PHASE_ACTION_REJECTED attempt=2\/3/);
  assert.ok(target.commands.length < FORGE_AGENT_LIMITS.maxToolCalls);
});
test("diagnostic de validation ignore la bannière Node.js et lit le vrai fichier en erreur", async () => {
  const build = { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const target = harness([
    build,
    { type: "TOOL_CALL", summary: "Corriger source", tool: "write_file", input: { path: "src/App.tsx", content: "export default function App() { return <main>ready</main>; }" } },
    build,
    { type: "FINAL", summary: "Terminé", report: "Source corrigée et build réussi." },
    { type: "FINAL", summary: "Terminé", report: "Source corrigée, build et Git status réussis." },
    { type: "FINAL", summary: "Terminé", report: "Source corrigée, build, Git status et Git diff réussis." },
  ], false, {
    files: { "src/App.tsx": "export default () => <main>broken</main>" },
    commandResults: [
      { stdout: "New version of Node.js available\nsrc/App.tsx:1:1 TypeScript error", stderr: "", exitCode: 1, timedOut: false, truncated: false, durationMs: 5 },
      { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 5 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Corrige l'application, lance le build puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.ok(target.reads.includes("src/App.tsx"));
  assert.equal(target.reads.includes("Node.js"), false);
});
test("recovery découvre le code pertinent après des lectures ambiguës puis corrige et valide", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Explorer src", tool: "list_files", input: { path: "src" } },
    { type: "TOOL_CALL", summary: "Lire types non pertinents", tool: "read_file", input: { path: "src/modules/agent-builder/types/index.ts" } },
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "FAIL", summary: "Contexte insuffisant", error: "Je manque de contexte pour localiser le Model Gateway et les contrats Usage." },
    (context: Record<string, unknown>, constraint?: Record<string, unknown>) => {
      assert.equal(constraint?.phase, "DISCOVERY_REQUIRED");
      assert.deepEqual(constraint?.allowedTools, ["search_code", "list_files", "read_file"]);
      assert.match(JSON.stringify(context), /RECOVERY_DISCOVERY/);
      return { type: "TOOL_CALL", summary: "Rechercher les contrats", tool: "search_code", input: { query: "ModelGateway|UsageEvent", path: "." } };
    },
    (context: Record<string, unknown>) => { assert.match(JSON.stringify(context), /lib\/ai\/gateway\/model-gateway\.ts/); return { type: "TOOL_CALL", summary: "Lire le gateway partagé", tool: "read_file", input: { path: "lib/ai/gateway/model-gateway.ts" } }; },
    { type: "TOOL_CALL", summary: "Ajouter l'adaptation", tool: "write_file", input: { path: "lib/forge/usage-adapter.ts", content: "export const usage = 'UNKNOWN';" } },
    { type: "TOOL_CALL", summary: "Tester", tool: "run_command", input: { command: "npm", args: ["test"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Adaptation ajoutée et tests réussis." },
    { type: "FINAL", summary: "Terminé", report: "Adaptation ajoutée, tests et Git status réussis." },
    { type: "FINAL", summary: "Terminé", report: "Adaptation ajoutée, tests, Git status et Git diff réussis; publication disponible ensuite dans le panneau contrôlé." },
  ], false, {
    files: {
      "package.json": '{"scripts":{"test":"node --test"}}',
      "src/modules/agent-builder/types/index.ts": "export type AgentBuilder = unknown;",
      "lib/ai/gateway/model-gateway.ts": "export interface ModelGateway {}",
    },
    commandResults: [
      { stdout: "lib/ai/gateway/model-gateway.ts:1:export interface ModelGateway {}\nlib/core/usage/usage.ts:1:export type UsageEvent = unknown", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 },
      { stdout: "tests PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 8 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Intègre Usage au Model Gateway, ajoute des tests et prépare ensuite une PR contrôlée.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.commands[0]?.command, "rg");
  assert.ok(target.reads.includes("lib/ai/gateway/model-gateway.ts"));
  assert.ok(target.writes.includes("lib/forge/usage-adapter.ts"));
  assert.equal(target.constraints.filter((constraint) => constraint?.phase === "DISCOVERY_REQUIRED").length, 1);
  assert.equal(target.artifacts.length, 1);
});
test("découverte non pertinente répétée s'arrête au budget borné", async () => {
  const decisions: Array<Record<string, unknown>> = [];
  for (let index = 0; index < FORGE_AGENT_LIMITS.maxRecoveryDiscoveryCalls; index += 1) {
    decisions.push({ type: "FAIL", summary: "Contexte insuffisant", error: "Je manque de contexte pour localiser le code pertinent." });
    decisions.push({ type: "TOOL_CALL", summary: `Recherche sans résultat ${index}`, tool: "search_code", input: { query: `missing-symbol-${index}`, path: "." } });
  }
  decisions.push({ type: "FAIL", summary: "Toujours insuffisant", error: "Je manque encore de contexte pour localiser le code pertinent." });
  const target = harness(decisions, false, { commandResults: Array.from({ length: FORGE_AGENT_LIMITS.maxRecoveryDiscoveryCalls }, () => ({ stdout: "", stderr: "", exitCode: 1, timedOut: false, truncated: false, durationMs: 2 })) });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Modifie le code pertinent et teste le résultat."), /découverte de récupération Forge est épuisée/);
  assert.equal(target.commands.length, FORGE_AGENT_LIMITS.maxRecoveryDiscoveryCalls);
  assert.ok(target.steps.length < FORGE_AGENT_LIMITS.maxSteps);
  assert.equal(target.artifacts.length, 0);
});
test("refus explicite malgré un contexte suffisant reste terminal sans découverte libre", async () => {
  const refusal = { type: "FAIL", summary: "Refus", error: "Je refuse d'appliquer la mutation demandée." };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire cible", tool: "read_file", input: { path: "src/index.ts" } },
    refusal,
    refusal,
    refusal,
  ], false, { files: { "src/index.ts": "export const value = 1;" } });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Modifie src/index.ts et teste le résultat."), /refuse de progresser/);
  assert.equal(target.constraints.some((constraint) => constraint?.phase === "DISCOVERY_REQUIRED"), false);
  assert.equal(target.writes.length, 0);
  assert.equal(target.artifacts.length, 0);
});
test("ENOENT du cwd Daytona ne transforme pas package.json repository en fichier absent", async () => {
  const typecheck = { type: "TOOL_CALL", summary: "Typecheck", tool: "run_command", input: { command: "npm", args: ["run", "typecheck"], validation: true } };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    typecheck,
    (_context: Record<string, unknown>, constraint?: Record<string, unknown>) => {
      assert.equal(constraint?.phase, "REVALIDATION_REQUIRED");
      assert.match(String(constraint?.instruction), /COMMAND_CWD_MISMATCH/);
      assert.match(String(constraint?.instruction), /ne le crée ni ne le réécris/);
      return typecheck;
    },
    { type: "FINAL", summary: "Terminé", report: "package.json a été lu dans le repository et npm run typecheck a réellement réussi depuis sa racine." },
  ], false, {
    files: { "package.json": '{"scripts":{"typecheck":"tsc --noEmit"}}' },
    commandResults: [
      { stdout: "", stderr: "npm error code ENOENT\nnpm error path /home/daytona/package.json", exitCode: 254, timedOut: false, truncated: false, durationMs: 5 },
      { stdout: "typecheck PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 5 },
    ],
  });
  const result = await target.runner.run("user-a", "conversation-a", "Lis package.json puis lance npm run typecheck.");
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(target.reads, ["package.json"]);
  assert.equal(target.writes.includes("package.json"), false);
  assert.equal(target.commands.length, 2);
});


test("completion gate: build disponible et réussi autorise COMPLETED sans inventer typecheck", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Build réellement exécuté avec succès." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build"}}' },
    commandResults: [{ stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 }],
  });
  assert.equal((await target.runner.run("user-a", "conversation-a", "Inspecte package.json puis finalise.")).status, "COMPLETED");
  assert.deepEqual(target.commands.map((command) => command.args), [["run", "build"]]);
  assert.doesNotMatch(JSON.stringify(target.steps), /npm run typecheck/);
});

test("completion gate: build réussi ne remplace pas lint disponible, puis les deux autorisent COMPLETED", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Trop tôt", report: "Build réussi." },
    (context: Record<string, unknown>) => {
      assert.match(JSON.stringify(context), /exécuter npm run lint.*exitCode 0/);
      return { type: "TOOL_CALL", summary: "Lint", tool: "run_command", input: { command: "npm", args: ["run", "lint"], cwd: ".", validation: true } };
    },
    { type: "FINAL", summary: "Terminé", report: "Build et lint réellement exécutés avec succès." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build","lint":"eslint ."}}' },
    commandResults: [
      { stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 },
      { stdout: "lint PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 },
    ],
  });
  assert.equal((await target.runner.run("user-a", "conversation-a", "Inspecte package.json puis finalise.")).status, "COMPLETED");
  assert.equal(target.steps.filter((step) => step.summary === "Mission incomplète").length, 1);
  assert.deepEqual(target.commands.map((command) => command.args), [["run", "build"], ["run", "lint"]]);
});

test("completion gate: placeholder npm test standard est ignoré", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } },
    { type: "FINAL", summary: "Terminé", report: "Build disponible exécuté avec succès; test placeholder ignoré." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build","test":"echo \\"Error: no test specified\\" && exit 1"}}' },
    commandResults: [{ stdout: "build PASS", stderr: "", exitCode: 0, timedOut: false, truncated: false, durationMs: 4 }],
  });
  assert.equal((await target.runner.run("user-a", "conversation-a", "Inspecte package.json puis finalise.")).status, "COMPLETED");
  assert.deepEqual(target.commands.map((command) => command.args), [["run", "build"]]);
});

test("completion gate: texte Build completed avec exitCode non nul reste un échec réel", async () => {
  const build = { type: "TOOL_CALL", summary: "Build", tool: "run_command", input: { command: "npm", args: ["run", "build"], cwd: ".", validation: true } };
  const target = harness([
    { type: "TOOL_CALL", summary: "Lire package", tool: "read_file", input: { path: "package.json" } },
    build,
    { type: "FINAL", summary: "Trop tôt", report: "Build completed." },
  ], false, {
    files: { "package.json": '{"scripts":{"build":"vite build"}}' },
    commandResults: [{ stdout: "Build completed", stderr: "fatal build error", exitCode: 1, timedOut: false, truncated: false, durationMs: 4 }],
  });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Inspecte package.json puis lance le build."), /missing decision/);
  assert.equal(target.steps.find((step) => step.summary === "Build")?.status, "FAILED");
  assert.match(String(target.steps.find((step) => step.summary === "Build")?.resultSummary), /exited 1/);
  assert.notEqual(target.run()?.status, "COMPLETED");
});


test("artifact COMPLETED persiste le vrai Git diff avant FINAL et reste lié au run hors runtime", async () => {
  const realPatch = "diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+real runtime content";
  const target = harness([
    { type: "TOOL_CALL", summary: "Modifier", tool: "write_file", input: { path: "src/index.ts", content: "real runtime content" } },
    { type: "TOOL_CALL", summary: "Status", tool: "git_status", input: {} },
    { type: "TOOL_CALL", summary: "Diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Terminé", report: "Rapport modèle sans le contenu réel du patch." },
  ], false, { gitDiff: { added: [], modified: ["src/index.ts"], deleted: [], patch: realPatch, truncated: false } });
  const result = await target.runner.run("user-a", "conversation-a", "Modifie src/index.ts puis vérifie Git status et Git diff.");
  assert.equal(result.status, "COMPLETED");
  assert.equal(target.artifacts.length, 1);
  assert.deepEqual(target.artifacts[0], {
    runId: "run-a", repository: "yNono57/noline-forge-testbed", baseCommitSha: "a".repeat(40), sourceBranch: "main",
    changedFiles: ["src/index.ts"], additions: 1, deletions: 1, patch: realPatch, status: "READY",
    artifactId: "artifact-1", createdAt: "2026-08-24T00:00:01.000Z",
  });
  assert.ok(target.events.indexOf("ARTIFACT") < target.events.lastIndexOf("FINAL"));
  target.files.clear();
  const replacementRuntime = { runtimeId: "runtime-b", status: "READY" };
  assert.equal(replacementRuntime.runtimeId, "runtime-b");
  assert.equal(target.artifacts[0]?.runId, "run-a");
  assert.equal(target.artifacts[0]?.patch, realPatch);
  assert.doesNotMatch(String(target.artifacts[0]?.patch), /Rapport modèle/);
});

test("échec de persistance artifact interdit le faux COMPLETED et conserve le runtime mock", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Modifier", tool: "write_file", input: { path: "src/index.ts", content: "ready" } },
    { type: "TOOL_CALL", summary: "Status", tool: "git_status", input: {} },
    { type: "TOOL_CALL", summary: "Diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Terminé", report: "Ne doit pas être persisté comme terminé." },
  ], false, { artifactFailure: true });
  await assert.rejects(() => target.runner.run("user-a", "conversation-a", "Modifie src/index.ts puis vérifie Git status et Git diff."), /Persistance artifact indisponible/);
  assert.equal(target.run()?.status, "FAILED");
  assert.equal(target.steps.some((step) => step.type === "FINAL" && step.status === "COMPLETED"), false);
  assert.equal(target.files.get("src/index.ts"), "ready");
});

test("artifact refuse explicitement diff tronqué, trop volumineux et chemins sensibles", () => {
  const base = { added: ["src/index.ts"], modified: [] as string[], deleted: [] as string[], patch: "+safe", truncated: false };
  assert.throws(() => createCompletionArtifactInput("run-a", "owner/repo", "a".repeat(40), "main", { ...base, truncated: true }), /trop volumineux/);
  assert.throws(() => createCompletionArtifactInput("run-a", "owner/repo", "a".repeat(40), "main", { ...base, patch: "x".repeat(FORGE_RUN_ARTIFACT_MAX_PATCH_CHARACTERS + 1) }), /trop volumineux/);
  assert.throws(() => createCompletionArtifactInput("run-a", "owner/repo", "a".repeat(40), "main", { ...base, added: [".env"] }), /chemin sensible/);
});

test("artifact sans changement Git est persisté EMPTY de façon déterministe", async () => {
  const target = harness([
    { type: "TOOL_CALL", summary: "Modifier puis restaurer", tool: "write_file", input: { path: "src/index.ts", content: "unchanged" } },
    { type: "TOOL_CALL", summary: "Status", tool: "git_status", input: {} },
    { type: "TOOL_CALL", summary: "Diff", tool: "git_diff", input: {} },
    { type: "FINAL", summary: "Terminé", report: "Aucun changement Git final." },
  ], false, { gitDiff: { added: [], modified: [], deleted: [], patch: "", truncated: false } });
  assert.equal((await target.runner.run("user-a", "conversation-a", "Modifie puis restaure src/index.ts et contrôle Git status et Git diff.")).status, "COMPLETED");
  assert.deepEqual({ status: target.artifacts[0]?.status, changedFiles: target.artifacts[0]?.changedFiles, patch: target.artifacts[0]?.patch }, { status: "EMPTY", changedFiles: [], patch: "" });
});

test("migration artifact est additive, bornée et protégée par ownership RLS", () => {
  const sql = fs.readFileSync("supabase/migrations/20260825_forge_run_artifacts.sql", "utf8");
  for (const value of ["create table if not exists public.forge_run_artifacts", "run_id uuid not null unique", "length(patch) <= 200000", "enable row level security", "auth.uid() = forge_run_artifacts.user_id", "r.id = forge_run_artifacts.run_id"]) assert.ok(sql.toLowerCase().includes(value.toLowerCase()));
  assert.doesNotMatch(sql, /drop table|truncate/i);
});
