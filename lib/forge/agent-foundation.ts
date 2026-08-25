import { FORGE_RUNTIME_LIMITS, normalizeRuntimeCommand, normalizeRuntimePath, type ForgeRuntimeCommand, type ForgeRuntimeCommandResult, type ForgeRuntimeFile, type ForgeRuntimeFileEntry, type ForgeRuntimeGitDiff, type ForgeRuntimeGitStatus } from "./runtime-foundation";
import { FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS } from "./agent-limits";

export const FORGE_AGENT_LIMITS = { maxSteps: 60, maxToolCalls: 48, maxRuntimeSeconds: 240, maxCommandTimeoutMs: 60_000, maxOutputCharacters: 20_000, maxObjectiveCharacters: FORGE_AGENT_MAX_OBJECTIVE_CHARACTERS } as const;
export type ForgeAgentRunStatus = "QUEUED" | "PLANNING" | "RUNNING" | "VALIDATING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ForgeAgentStepType = "PLAN" | "TOOL_CALL" | "FINAL" | "FAIL";
export type ForgeAgentToolName = "list_files" | "read_file" | "write_file" | "delete_file" | "run_command" | "git_status" | "git_diff";
export type ForgeAgentRun = { runId: string; userId: string; projectId: string; conversationId: string; workspaceId: string; runtimeId: string; status: ForgeAgentRunStatus; objective: string; baseCommitSha: string; plan: string[]; finalReport: string | null; createdAt: string; startedAt: string | null; completedAt: string | null; lastActivityAt: string | null; error: string | null };
export type ForgeAgentRunView = Omit<ForgeAgentRun, "userId">;
export type ForgeAgentStep = { stepId: string; runId: string; stepNumber: number; type: ForgeAgentStepType; summary: string; tool: ForgeAgentToolName | null; input: Record<string, unknown>; resultSummary: string | null; status: "RUNNING" | "COMPLETED" | "FAILED"; startedAt: string; completedAt: string | null };
export type ForgeAgentDecision = { type: "PLAN"; summary: string; plan: string[] } | { type: "TOOL_CALL"; summary: string; tool: ForgeAgentToolName; input: Record<string, unknown> } | { type: "FINAL"; summary: string; report: string } | { type: "FAIL"; summary: string; error: string };
export type ForgeMissionRequirements = { mutation: boolean; validation: boolean; gitStatus: boolean; gitDiff: boolean };
type ForgeValidationRecovery = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  failureMutationVersion: number;
  filesystemRevision: number;
  inspectionsSinceFailure: Set<string>;
  filesReadSinceFailure: Set<string>;
  candidateFiles: string[];
  correctionMutationVersion: number | null;
  failureKind: "VALIDATION" | "COMMAND_CWD";
};
export type ForgeAgentPhase = "NORMAL" | "DIAGNOSTIC" | "CORRECTION_REQUIRED" | "REVALIDATION_REQUIRED";
export type ForgeAgentDecisionConstraint = { phase: ForgeAgentPhase; allowedDecisionTypes: ForgeAgentDecision["type"][]; allowedTools: ForgeAgentToolName[]; instruction: string };
export type ForgeAgentModelContext = { objective: string; repository: string; branch: string; baseCommitSha: string; status: ForgeAgentRunStatus; phase: ForgeAgentPhase; steps: Array<{ type: ForgeAgentStepType; summary: string; tool: ForgeAgentToolName | null; input: Record<string, unknown>; resultSummary: string | null; status: ForgeAgentStep["status"] }> };
export interface ForgeAgentModelProvider { readonly key: string; decide(context: ForgeAgentModelContext, constraint?: ForgeAgentDecisionConstraint): Promise<ForgeAgentDecision>; }
export interface ForgeAgentRuntimeAdapter { listFiles(path: string): Promise<ForgeRuntimeFileEntry[]>; readFile(path: string): Promise<ForgeRuntimeFile>; writeFile(path: string, content: string): Promise<ForgeRuntimeFile>; deleteFile(path: string): Promise<void>; executeCommand(command: Partial<ForgeRuntimeCommand>): Promise<ForgeRuntimeCommandResult>; getGitStatus(): Promise<ForgeRuntimeGitStatus>; getGitDiff(): Promise<ForgeRuntimeGitDiff>; }
export class ForgeAgentError extends Error { constructor(readonly code: "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "LIMIT" | "CANCELLED" | "MODEL" | "PERSISTENCE", message: string) { super(message); this.name = "ForgeAgentError"; } }
export function publicAgentRun(run: ForgeAgentRun): ForgeAgentRunView { const { userId, ...view } = run; void userId; return view; }
export function normalizeAgentObjective(value: unknown) { if (typeof value !== "string" || !value.trim()) throw new ForgeAgentError("INVALID_INPUT", "La mission Forge ne peut pas être vide."); if (value.trim().length > FORGE_AGENT_LIMITS.maxObjectiveCharacters) throw new ForgeAgentError("INVALID_INPUT", `La mission Forge dépasse la limite de sécurité de ${FORGE_AGENT_LIMITS.maxObjectiveCharacters} caractères.`); return value.trim(); }
export function sanitizeAgentText(value: string, max: number = FORGE_AGENT_LIMITS.maxOutputCharacters) { return value.replace(/(sk-[A-Za-z0-9_-]{12,}|gh[opsu]_[A-Za-z0-9_]{12,}|(?:API_KEY|PRIVATE_KEY|TOKEN|SECRET)\s*[:=]\s*\S+)/gi, "[REDACTED]").replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[REDACTED]@").replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, max); }
const sensitivePath = /(^|\/)(\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?)(\/|$)/i;
export function normalizeAgentPath(value: unknown, allowRoot = false) { const path = normalizeRuntimePath(typeof value === "string" ? value : "", allowRoot); if (sensitivePath.test(path) && !/\.env\.example$/i.test(path)) throw new ForgeAgentError("INVALID_INPUT", "Ce chemin sensible n’est pas accessible à l’agent."); return path; }
export function normalizeAgentCommand(input: Record<string, unknown>) { const command = normalizeRuntimeCommand({ command: input.command as string, args: input.args as string[], cwd: input.cwd as string, timeoutMs: Math.min(Number(input.timeoutMs) || 30_000, FORGE_AGENT_LIMITS.maxCommandTimeoutMs), maxOutputBytes: Math.min(Number(input.maxOutputBytes) || 250_000, FORGE_RUNTIME_LIMITS.maxCommandOutputBytes) }); const joined = [command.command, ...command.args].join(" "); if (/^(?:env|printenv|export|set|bash|sh|zsh|powershell|pwsh|cmd|curl|wget|ssh|scp|git|gh|vercel|supabase|daytona|docker|kubectl|terraform|aws|gcloud|az)$/i.test(command.command) || /(?:\/etc\/|\/proc\/|\/root\/|DAYTONA_API_KEY|OPENAI_API_KEY|GITHUB_APP_|SUPABASE_SERVICE)/i.test(joined) || /(?:^|\s)--?(?:token|password|api[-_]?key|_authToken)(?:=|\s|$)/i.test(joined) || (/^(?:npm|pnpm|yarn)$/i.test(command.command) && /^(?:publish|unpublish|login|logout|owner|access|token|deprecate)(?:\s|$)/i.test(command.args.join(" ")))) throw new ForgeAgentError("INVALID_INPUT", "Cette commande est interdite par la policy Forge."); return command; }

export type ForgeAgentRunnerDependencies = {
  resolveContext(userId: string, conversationId: string): Promise<{ projectId: string; workspaceId: string; runtimeId: string; repository: string; branch: string; baseCommitSha: string }>;
  createRun(input: Omit<ForgeAgentRun, "runId" | "createdAt">): Promise<ForgeAgentRun>;
  updateRun(userId: string, runId: string, input: Partial<Pick<ForgeAgentRun, "status" | "plan" | "finalReport" | "startedAt" | "completedAt" | "lastActivityAt" | "error">>): Promise<ForgeAgentRun>;
  appendStep(userId: string, input: Omit<ForgeAgentStep, "stepId">): Promise<ForgeAgentStep>;
  updateStep(userId: string, stepId: string, input: Pick<ForgeAgentStep, "resultSummary" | "status" | "completedAt">): Promise<ForgeAgentStep>;
  isCancelled(userId: string, runId: string): Promise<boolean>;
  runtime(userId: string, conversationId: string): ForgeAgentRuntimeAdapter;
  model: ForgeAgentModelProvider;
  now(): string;
};

export function createInitialAgentPlan(_objective: string) {
  return ["Inspecter les fichiers nécessaires", "Exécuter la mission dans le sandbox", "Valider le résultat et produire le diff"];
}
export function deriveForgeMissionRequirements(objective: string): ForgeMissionRequirements {
  const normalized = objective.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mutation = /\b(cree?r?|creation|ajoute?r?|modifie?r?|ecri(?:s|re|ture)|supprime?r?|implemente?r?|developpe?r?|construi(?:s|re)|initialise?r?|transforme?r?|corrige?r?|refactor(?:e|er)?|installe?r?|scaffold(?:er)?|generate|build an? (?:app|application|project)|create|add|modify|write|delete|implement|develop|initialize|transform|fix)\b/.test(normalized);
  const nonGitObjective = normalized.replace(/\b(?:verifie?r?|check)\s+git\s+(?:status|diff)\b/g, "").replace(/git\s+(?:status|diff)/g, "");
  const validation = /\b(validation|valide?r?|verifie?r?|test(?:s|er)?|build|lint|typecheck|type-check|compile?r?|compilation)\b/.test(nonGitObjective);
  const gitStatus = mutation || /\bgit\s+status\b/.test(normalized);
  const gitDiff = mutation || /\bgit\s+diff\b|\bdiff\s+git\b/.test(normalized);
  return { mutation, validation, gitStatus, gitDiff };
}
export function createForgeAgentRunner(deps: ForgeAgentRunnerDependencies) {
  async function run(userId: string, conversationId: string, objectiveInput: unknown) {
    if (!userId.trim()) throw new ForgeAgentError("UNAUTHENTICATED", "Authentification requise.");
    const objective = sanitizeAgentText(normalizeAgentObjective(objectiveInput), FORGE_AGENT_LIMITS.maxObjectiveCharacters);
    const context = await deps.resolveContext(userId, conversationId);
    const requirements = deriveForgeMissionRequirements(objective);
    const started = Date.now();
    let run = await deps.createRun({ userId, projectId: context.projectId, conversationId, workspaceId: context.workspaceId, runtimeId: context.runtimeId, status: "QUEUED", objective, baseCommitSha: context.baseCommitSha, plan: [], finalReport: null, startedAt: null, completedAt: null, lastActivityAt: null, error: null });
    const steps: ForgeAgentStep[] = [];
    const failedCalls = new Map<string, number>();
    const failedValidationCommands = new Map<string, { mutationVersion: number; resultSummary: string }>();
    const successfulInspections = new Set<string>();
    const knownMissingInspections = new Set<string>();
    let toolCalls = 0;
    let successfulToolCalls = 0;
    let blockingToolFailures = 0;
    let lastRecoverableFailure: string | null = null;
    let validationFailed = false;
    let validationAttempted = false;
    let mutationOccurred = false;
    let mutationVersion = 0;
    let inspectionRevision = 0;
    let stalledDecisions = 0;
    let gitStatusSucceeded = false;
    let gitDiffSucceeded = false;
    let prematureTerminations = 0;
    let inspectionSatisfied = false;
    let minimalRepositoryConfirmed = false;
    let packageScripts: Map<string, string> | null = null;
    const successfulPackageValidations = new Set<string>();
    let validationRecovery: ForgeValidationRecovery | null = null;
    let lastPrematureProgressKey: string | null = null;
    let prematureWithoutProgress = 0;
    try {
      run = await deps.updateRun(userId, run.runId, { status: "PLANNING", startedAt: deps.now(), lastActivityAt: deps.now() });
      if (await deps.isCancelled(userId, run.runId)) throw new ForgeAgentError("CANCELLED", "Run annulé.");
      const initialPlan = createInitialAgentPlan(objective);
      const planTime = deps.now();
      steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: 1, type: "PLAN", summary: "Plan initial Forge", tool: null, input: {}, resultSummary: initialPlan.join("\n"), status: "COMPLETED", startedAt: planTime, completedAt: planTime }));
      run = await deps.updateRun(userId, run.runId, { status: "RUNNING", plan: initialPlan, lastActivityAt: planTime });
      for (let number = 2; number <= FORGE_AGENT_LIMITS.maxSteps; number += 1) {
        if (Date.now() - started > FORGE_AGENT_LIMITS.maxRuntimeSeconds * 1000) throw new ForgeAgentError("LIMIT", "Durée maximale du run atteinte.");
        if (await deps.isCancelled(userId, run.runId)) throw new ForgeAgentError("CANCELLED", "Run annulé.");
        const phase = currentAgentPhase(validationRecovery);
        const decisionContext: ForgeAgentModelContext = {
          objective, repository: context.repository, branch: context.branch, baseCommitSha: context.baseCommitSha, status: run.status, phase,
          steps: steps.slice(-12).map(({ type, summary, tool, input, resultSummary, status }) => ({ type, summary, tool, input, resultSummary: resultSummary?.slice(0, 8_000) || null, status })),
        };
        const decision = forcedPhaseDecision(phase, validationRecovery) ?? await decideForPhase(deps.model, decisionContext, phase, validationRecovery);
        if (await deps.isCancelled(userId, run.runId)) throw new ForgeAgentError("CANCELLED", "Run annulé.");
        const now = deps.now();
        if (decision.type === "PLAN") {
          const plan = decision.plan.slice(0, 8).map((item) => sanitizeAgentText(item, 500));
          steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "PLAN", summary: sanitizeAgentText(decision.summary, 1000), tool: null, input: {}, resultSummary: plan.join("\n"), status: "COMPLETED", startedAt: now, completedAt: now }));
          run = await deps.updateRun(userId, run.runId, { status: "RUNNING", plan, lastActivityAt: now });
          continue;
        }
        if (decision.type === "TOOL_CALL") {
          const safeInput = safeToolInput(decision.tool, decision.input);
          const signature = `${mutationVersion}:${decision.tool}:${JSON.stringify(safeInput)}`;
          const inspectionSignature = `${inspectionRevision}:${decision.tool}:${JSON.stringify(safeInput)}`;
          const commandKey = decision.tool === "run_command" ? JSON.stringify({ command: safeInput.command, args: safeInput.args, cwd: safeInput.cwd, validation: safeInput.validation }) : null;
          const previousCommandFailure = commandKey ? failedValidationCommands.get(commandKey) : undefined;
          if (commandKey && previousCommandFailure?.mutationVersion === mutationVersion) {
            stalledDecisions += 1;
            const remaining = remainingCompletionActions(requirements, { mutationOccurred, validationAttempted, validationFailed, gitStatusSucceeded, gitDiffSucceeded }, packageScripts, successfulPackageValidations);
            const recovery = sanitizeAgentText(`COMMAND_RETRY_BLOCKED: la même commande a déjà échoué sans mutation depuis. ${previousCommandFailure.resultSummary} filesystemRevision=${inspectionRevision}; mutationRevision=${mutationVersion}; completionGates=${remaining.join("; ") || "aucune"}. Retry identique interdit avant progression. Actions autorisées: read_file, list_files, write_file, delete_file, ou une commande différente justifiée.`, 3000);
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: "Validation identique suspendue", tool: decision.tool, input: safeInput, resultSummary: recovery, status: "FAILED", startedAt: now, completedAt: now }));
            if (stalledDecisions >= 4) throw new ForgeAgentError("MODEL", "Le modèle Forge répète une validation en échec sans corriger le projet.");
            continue;
          }
          const requestedNpmScript = npmScriptName(safeInput);
          if (requestedNpmScript && packageScripts && !packageScripts.has(requestedNpmScript)) {
            stalledDecisions += 1;
            validationAttempted = true;
            validationFailed = true;
            const available = [...packageScripts.keys()].sort();
            const recovery = sanitizeAgentText(`NPM_SCRIPT_UNAVAILABLE: le script ${requestedNpmScript} n'existe pas dans package.json. Scripts observés: ${available.length ? available.join(", ") : "aucun"}. Aucun appel runtime effectué. Crée/corrige le script demandé avec write_file ou utilise une validation réellement disponible; ne répète pas cette commande sans mutation. mutationRevision=${mutationVersion}.`, 2200);
            if (commandKey) failedValidationCommands.set(commandKey, { mutationVersion, resultSummary: recovery });
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: "Script npm indisponible", tool: decision.tool, input: safeInput, resultSummary: recovery, status: "FAILED", startedAt: now, completedAt: now }));
            if (stalledDecisions >= 4) throw new ForgeAgentError("MODEL", "Le modèle Forge répète une validation indisponible sans corriger package.json.");
            continue;
          }
          const previousFailures = failedCalls.get(signature) || 0;
          if (previousFailures >= 2) throw new ForgeAgentError("MODEL", "Le modèle Forge répète un appel d’outil invalide sans le corriger.");
          if ((decision.tool === "list_files" || decision.tool === "read_file") && (successfulInspections.has(inspectionSignature) || knownMissingInspections.has(inspectionSignature))) {
            stalledDecisions += 1;
            const remaining = remainingCompletionActions(requirements, { mutationOccurred, validationAttempted, validationFailed, gitStatusSucceeded, gitDiffSucceeded }, packageScripts, successfulPackageValidations);
            const duplicateMessage = sanitizeAgentText(`INSPECTION_SATISFIED: ${decision.tool} ${String(safeInput.path ?? ".")} est déjà satisfait pour la version filesystem courante. Aucun appel runtime supplémentaire. Completion gates restantes: ${remaining.length ? remaining.join("; ") : "aucune; choisis une inspection différente justifiée ou FINAL"}. Prochaine décision: TOOL_CALL faisant progresser la première gate restante.`, 1800);
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: "Inspection déjà satisfaite", tool: decision.tool, input: safeInput, resultSummary: duplicateMessage, status: "COMPLETED", startedAt: now, completedAt: now }));
            if (stalledDecisions >= 4) throw new ForgeAgentError("MODEL", "Le modèle Forge ne progresse pas après quatre récupérations structurées.");
            continue;
          }
          if (previousFailures === 1) {
            const duplicateMessage = "Appel identique déjà refusé. Corrige le schéma de l’outil; pour Git utilise git_status puis git_diff, sans shell composé.";
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: sanitizeAgentText(decision.summary, 1000), tool: decision.tool, input: safeInput, resultSummary: duplicateMessage, status: "FAILED", startedAt: now, completedAt: now }));
            failedCalls.set(signature, 2);
            continue;
          }
          if (++toolCalls > FORGE_AGENT_LIMITS.maxToolCalls) throw new ForgeAgentError("LIMIT", "Nombre maximal d’outils atteint.");
          const executing = await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: sanitizeAgentText(decision.summary, 1000), tool: decision.tool, input: safeInput, resultSummary: null, status: "RUNNING", startedAt: now, completedAt: null });
          const validation = decision.tool === "run_command" && decision.input.validation === true;
          if (validation) validationAttempted = true;
          try {
            const result = await executeTool(deps.runtime(userId, conversationId), decision.tool, decision.input);
            const commandFailed = decision.tool === "run_command" && ((result as ForgeRuntimeCommandResult).timedOut || (result as ForgeRuntimeCommandResult).exitCode !== 0);
            if (validation) validationFailed = commandFailed;
            const persistedSummary = summarizeToolResult(decision.tool, result, false, decision.input);
            const modelSummary = commandFailed
              ? commandFailureRecovery(decision.input, result as ForgeRuntimeCommandResult, inspectionRevision, mutationVersion, packageScripts !== null)
              : summarizeToolResult(decision.tool, result, true, decision.input);
            const persisted = await deps.updateStep(userId, executing.stepId, { resultSummary: persistedSummary, status: commandFailed ? "FAILED" : "COMPLETED", completedAt: deps.now() });
            if (decision.tool === "run_command") inspectionRevision += 1;
            if (commandFailed) {
              stalledDecisions = 0;
              prematureTerminations = 0;
              if (commandKey) failedValidationCommands.set(commandKey, { mutationVersion, resultSummary: modelSummary });
              lastRecoverableFailure = modelSummary;
              if (validation) { validationRecovery = createValidationRecovery(decision.input, result as ForgeRuntimeCommandResult, inspectionRevision, mutationVersion, packageScripts !== null); if (validationRecovery.failureKind === "COMMAND_CWD" && commandKey) failedValidationCommands.delete(commandKey); }
            }
            else {
              successfulToolCalls += 1;
              stalledDecisions = 0;
              prematureTerminations = 0;
              if (commandKey) failedValidationCommands.delete(commandKey);
              if (decision.tool === "write_file" || decision.tool === "delete_file") { mutationOccurred = true; mutationVersion += 1; inspectionRevision += 1; lastRecoverableFailure = null; gitStatusSucceeded = false; gitDiffSucceeded = false; successfulPackageValidations.clear(); if (validationRecovery) validationRecovery.correctionMutationVersion = mutationVersion; if (requirements.validation) { validationAttempted = false; validationFailed = false; } }
              if (decision.tool === "run_command") { lastRecoverableFailure = null; if (validation && requestedNpmScript && availablePackageValidations(packageScripts).has(requestedNpmScript)) successfulPackageValidations.add(requestedNpmScript); if (validation && validationRecovery && (mutationVersion > validationRecovery.failureMutationVersion || validationRecovery.failureKind === "COMMAND_CWD")) validationRecovery = null; }
              if (decision.tool === "list_files" || decision.tool === "read_file") { successfulInspections.add(inspectionSignature); inspectionSatisfied = true; }
              if (validationRecovery && decision.tool === "list_files") validationRecovery.inspectionsSinceFailure.add(normalizeAgentPath(decision.input.path ?? ".", true));
              if (validationRecovery && decision.tool === "read_file") { const path = normalizeAgentPath(decision.input.path); validationRecovery.inspectionsSinceFailure.add(path); validationRecovery.filesReadSinceFailure.add(path); }
              if (decision.tool === "list_files" && normalizeAgentPath(decision.input.path ?? ".", true) === ".") minimalRepositoryConfirmed = isMinimalRepositoryListing(result);
              if (decision.tool === "read_file" && normalizeAgentPath(decision.input.path) === "package.json") packageScripts = parsePackageScripts((result as ForgeRuntimeFile).content);
              if (decision.tool === "write_file" && normalizeAgentPath(decision.input.path) === "package.json" && typeof decision.input.content === "string") packageScripts = parsePackageScripts(decision.input.content);
              if (decision.tool === "git_status") gitStatusSucceeded = true;
              if (decision.tool === "git_diff") gitDiffSucceeded = true;
            }
            steps.push({ ...persisted, resultSummary: modelSummary });
            if (await deps.isCancelled(userId, run.runId)) throw new ForgeAgentError("CANCELLED", "Run annulé.");
            run = await deps.updateRun(userId, run.runId, { status: validation ? "VALIDATING" : "RUNNING", lastActivityAt: deps.now() });
          } catch (error) {
            if (error instanceof ForgeAgentError && error.code === "CANCELLED") throw error;
            if (validation) validationFailed = true;
            if (decision.tool === "run_command") inspectionRevision += 1;
            failedCalls.set(signature, 1);
            const missingOptionalFile = decision.tool === "read_file" && hasErrorCode(error, "NOT_FOUND");
            if (missingOptionalFile) stalledDecisions = 0;
            if (missingOptionalFile) knownMissingInspections.add(inspectionSignature);
            if (missingOptionalFile && validationRecovery && decision.tool === "read_file") { const missingPath = normalizeAgentPath(decision.input.path); validationRecovery.inspectionsSinceFailure.add(missingPath); validationRecovery.candidateFiles = validationRecovery.candidateFiles.filter((path) => path !== missingPath); }
            if (!missingOptionalFile && isBlockingToolError(error)) blockingToolFailures += 1;
            const reason = sanitizeAgentText(error instanceof Error ? error.message : "Outil en échec.", 1000);
            const code = getErrorCode(error);
            const actionable = missingOptionalFile
              ? sanitizeAgentText(`OPTIONAL FILE ABSENT: ${reason} Cette absence est une information d'inspection, pas un blocker runtime. N'essaie pas de relire ce chemin; poursuis avec la prochaine obligation.`, 1400)
              : decision.tool === "run_command" && code === "INVALID_INPUT"
                ? sanitizeAgentText(`TOOL ERROR [INVALID_INPUT] tool=run_command input=${JSON.stringify(safeInput)}: ${reason} RUN_COMMAND_CONTRACT: command doit être un exécutable simple; args un tableau séparé; cwd un chemin relatif; aucun &&, pipe ou redirection. Corrige l'input avant le prochain TOOL_CALL.`, 2200)
                : sanitizeAgentText(`TOOL ERROR [${code}] tool=${decision.tool} input=${JSON.stringify(safeInput)}: ${reason} Prochaine action: corrige cet input ou utilise un autre outil autorisé; git_status/git_diff sont des outils dédiés.`, 1800);
            if (!missingOptionalFile && !isBlockingToolError(error)) lastRecoverableFailure = actionable;
            const failed = await deps.updateStep(userId, executing.stepId, { resultSummary: actionable, status: "FAILED", completedAt: deps.now() });
            steps.push({ ...failed, resultSummary: actionable });
            run = await deps.updateRun(userId, run.runId, { status: "RUNNING", lastActivityAt: deps.now() });
          }
          continue;
        }
        if (decision.type === "FINAL") {
          if (!isGroundedAgentFinal(decision.report, successfulToolCalls) && !validationRecovery) {
            prematureTerminations += 1;
            const recovery = startupRecoveryMessage(prematureTerminations);
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FAIL", summary: "Résultat final prématuré", tool: null, input: {}, resultSummary: recovery, status: "FAILED", startedAt: now, completedAt: now }));
            if (prematureTerminations >= 3) throw new ForgeAgentError("MODEL", "Le modèle Forge refuse d’utiliser les outils après trois demandes de récupération.");
            continue;
          }
          const missingRequirements = getMissingCompletionRequirements(requirements, { mutationOccurred, validationAttempted, validationFailed }, packageScripts, successfulPackageValidations);
          const validationRecoveryMissing = validationRecoveryRequirements(validationRecovery);
          if (missingRequirements.length || validationRecoveryMissing.length) {
            prematureTerminations += 1;
            const progress = registerPrematureRecovery(validationRecovery, missingRequirements, lastPrematureProgressKey, prematureWithoutProgress);
            lastPrematureProgressKey = progress.key;
            prematureWithoutProgress = progress.count;
            const recovery = completionRecoveryMessage(prematureTerminations, [...new Set([...validationRecoveryMissing, ...missingRequirements])], { inspectionSatisfied, minimalRepositoryConfirmed }, undefined, lastRecoverableFailure, validationRecovery);
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FAIL", summary: "Mission incomplète", tool: null, input: {}, resultSummary: recovery, status: "FAILED", startedAt: now, completedAt: now }));
            if (prematureWithoutProgress >= 3) throw new ForgeAgentError("MODEL", "Le modèle Forge tente de terminer sans progresser dans la récupération requise.");
            continue;
          }
          const missingEvidence = [requirements.gitStatus && !gitStatusSucceeded ? "git_status" : "", requirements.gitDiff && !gitDiffSucceeded ? "git_diff" : ""].filter(Boolean);
          if (missingEvidence.length) {
            const mandatoryTool = missingEvidence[0] as "git_status" | "git_diff";
            if (++toolCalls > FORGE_AGENT_LIMITS.maxToolCalls) throw new ForgeAgentError("LIMIT", "Nombre maximal d’outils atteint.");
            const executing = await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "TOOL_CALL", summary: mandatoryTool === "git_status" ? "Vérification Git status obligatoire" : "Vérification Git diff obligatoire", tool: mandatoryTool, input: {}, resultSummary: null, status: "RUNNING", startedAt: now, completedAt: null });
            try {
              const result = await executeTool(deps.runtime(userId, conversationId), mandatoryTool, {});
              const persisted = await deps.updateStep(userId, executing.stepId, { resultSummary: summarizeToolResult(mandatoryTool, result, false), status: "COMPLETED", completedAt: deps.now() });
              successfulToolCalls += 1;
              prematureTerminations = 0;
              if (mandatoryTool === "git_status") gitStatusSucceeded = true;
              else gitDiffSucceeded = true;
              steps.push({ ...persisted, resultSummary: summarizeToolResult(mandatoryTool, result, true) });
              run = await deps.updateRun(userId, run.runId, { status: "VALIDATING", lastActivityAt: deps.now() });
            } catch (error) {
              const reason = sanitizeAgentText(error instanceof Error ? error.message : "Vérification Git en échec.", 1000);
              const failed = await deps.updateStep(userId, executing.stepId, { resultSummary: reason, status: "FAILED", completedAt: deps.now() });
              steps.push({ ...failed, resultSummary: reason });
              throw error;
            }
            continue;
          }
          if (validationFailed) {
            steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FAIL", summary: "Validation encore en échec", tool: null, input: {}, resultSummary: "Une validation explicitement demandée doit repasser avant la fin.", status: "FAILED", startedAt: now, completedAt: now }));
            continue;
          }
          const report = sanitizeAgentText(decision.report, 20_000);
          await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FINAL", summary: sanitizeAgentText(decision.summary, 1000), tool: null, input: {}, resultSummary: report, status: "COMPLETED", startedAt: now, completedAt: now });
          return deps.updateRun(userId, run.runId, { status: "COMPLETED", finalReport: report, completedAt: deps.now(), lastActivityAt: deps.now() });
        }
        const missingRequirements = getMissingCompletionRequirements(requirements, { mutationOccurred, validationAttempted, validationFailed }, packageScripts, successfulPackageValidations);
        const validationRecoveryMissing = validationRecoveryRequirements(validationRecovery);
        if (successfulToolCalls === 0 || ((missingRequirements.length || validationRecoveryMissing.length) && blockingToolFailures === 0)) {
          prematureTerminations += 1;
          const progress = registerPrematureRecovery(validationRecovery, missingRequirements, lastPrematureProgressKey, prematureWithoutProgress);
          lastPrematureProgressKey = progress.key;
          prematureWithoutProgress = progress.count;
          const recovery = successfulToolCalls === 0 && !validationRecovery ? startupRecoveryMessage(prematureTerminations, decision.error, lastRecoverableFailure) : completionRecoveryMessage(prematureTerminations, [...new Set([...validationRecoveryMissing, ...missingRequirements])], { inspectionSatisfied, minimalRepositoryConfirmed }, decision.error, lastRecoverableFailure, validationRecovery);
          steps.push(await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FAIL", summary: successfulToolCalls === 0 && !validationRecovery ? "Démarrage agentique incomplet" : "Mission incomplète", tool: null, input: {}, resultSummary: recovery, status: "FAILED", startedAt: now, completedAt: now }));
          if (prematureWithoutProgress >= 3) throw new ForgeAgentError("MODEL", "Le modèle Forge refuse de progresser dans la récupération requise.");
          continue;
        }
        await deps.appendStep(userId, { runId: run.runId, stepNumber: number, type: "FAIL", summary: sanitizeAgentText(decision.summary, 1000), tool: null, input: {}, resultSummary: sanitizeAgentText(decision.error, 1000), status: "FAILED", startedAt: now, completedAt: now });
        throw new ForgeAgentError("MODEL", sanitizeAgentText(decision.error, 1000));
      }
      throw new ForgeAgentError("LIMIT", "Nombre maximal d’étapes atteint.");
    } catch (error) {
      const cancelled = error instanceof ForgeAgentError && error.code === "CANCELLED";
      await deps.updateRun(userId, run.runId, { status: cancelled ? "CANCELLED" : "FAILED", error: sanitizeAgentText(error instanceof Error ? error.message : "Run Forge en échec.", 1000), completedAt: deps.now(), lastActivityAt: deps.now() });
      throw error;
    }
  }
  return { run };
}

function currentAgentPhase(recovery: ForgeValidationRecovery | null): ForgeAgentPhase {
  if (!recovery) return "NORMAL";
  if (recovery.correctionMutationVersion !== null) return "REVALIDATION_REQUIRED";
  if (recovery.filesReadSinceFailure.size > 0) return "CORRECTION_REQUIRED";
  return "DIAGNOSTIC";
}
function decisionConstraint(phase: ForgeAgentPhase, recovery: ForgeValidationRecovery | null): ForgeAgentDecisionConstraint {
  if (phase === "DIAGNOSTIC") return { phase, allowedDecisionTypes: ["TOOL_CALL"], allowedTools: ["list_files", "read_file"], instruction: recovery ? validationRecoveryInstruction(recovery) : "Inspecte uniquement les fichiers nécessaires." };
  if (phase === "CORRECTION_REQUIRED") return { phase, allowedDecisionTypes: ["TOOL_CALL"], allowedTools: ["write_file", "delete_file"], instruction: recovery ? validationRecoveryInstruction(recovery) : "Applique une mutation corrective." };
  if (phase === "REVALIDATION_REQUIRED") return { phase, allowedDecisionTypes: ["TOOL_CALL"], allowedTools: ["run_command"], instruction: recovery ? validationRecoveryInstruction(recovery) : "Relance la validation après mutation." };
  return { phase, allowedDecisionTypes: ["PLAN", "TOOL_CALL", "FINAL", "FAIL"], allowedTools: ["list_files", "read_file", "write_file", "delete_file", "run_command", "git_status", "git_diff"], instruction: "Choisis la prochaine action utile selon les completion gates." };
}
function forcedPhaseDecision(phase: ForgeAgentPhase, recovery: ForgeValidationRecovery | null): ForgeAgentDecision | null {
  if (phase !== "DIAGNOSTIC" || !recovery) return null;
  const candidate = recovery.candidateFiles.find((path) => !recovery.filesReadSinceFailure.has(path) && !recovery.inspectionsSinceFailure.has(path));
  return candidate ? { type: "TOOL_CALL", summary: "Diagnostic ciblé de la validation", tool: "read_file", input: { path: candidate } } : null;
}
async function decideForPhase(model: ForgeAgentModelProvider, context: ForgeAgentModelContext, phase: ForgeAgentPhase, recovery: ForgeValidationRecovery | null) {
  const constraint = decisionConstraint(phase, recovery);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const decision = await model.decide(context, constraint);
    if (isDecisionCompatible(decision, constraint, recovery)) return decision;
  }
  throw new ForgeAgentError("MODEL", `Le modèle Forge n'a produit aucune action compatible avec la phase ${phase}.`);
}
function isDecisionCompatible(decision: ForgeAgentDecision, constraint: ForgeAgentDecisionConstraint, recovery: ForgeValidationRecovery | null) {
  if (!constraint.allowedDecisionTypes.includes(decision.type)) return false;
  if (decision.type !== "TOOL_CALL") return true;
  if (!constraint.allowedTools.includes(decision.tool)) return false;
  if (constraint.phase !== "REVALIDATION_REQUIRED" || !recovery) return true;
  try {
    const safe = safeToolInput("run_command", decision.input);
    return decision.input.validation === true
      && safe.command === recovery.command
      && JSON.stringify(safe.args) === JSON.stringify(recovery.args)
      && safe.cwd === recovery.cwd;
  } catch {
    return false;
  }
}
function startupRecoveryMessage(attempt: number, modelError?: string, lastRecoverableFailure?: string | null) {
  const reason = modelError ? `La terminaison demandée a été refusée: ${sanitizeAgentText(modelError, 500)} ` : "";
  const toolFailure = lastRecoverableFailure ? `Dernier échec récupérable: ${sanitizeAgentText(lastRecoverableFailure, 900)} ` : "";
  return sanitizeAgentText(`${reason}${toolFailure}RECOVERY ${attempt}/3: aucun outil n’a encore réussi. La prochaine décision doit être un TOOL_CALL valide. Outils disponibles: list_files, read_file, write_file, delete_file, run_command, git_status, git_diff. Commence normalement par list_files {"path":"."}, puis inspecte les fichiers nécessaires. run_command exige un exécutable simple et des args séparés; aucun shell composé.`, 1600);
}
function getMissingCompletionRequirements(requirements: ForgeMissionRequirements, state: { mutationOccurred: boolean; validationAttempted: boolean; validationFailed: boolean }, packageScripts: Map<string, string> | null = null, successfulPackageValidations: Set<string> = new Set()) {
  const missing: string[] = [];
  if (requirements.mutation && !state.mutationOccurred) missing.push("créer ou modifier les fichiers demandés avec write_file/delete_file");
  if (requirements.validation && !state.validationAttempted) missing.push("lancer la validation demandée avec run_command et input.validation=true");
  if (requirements.validation && state.validationAttempted && state.validationFailed) missing.push("corriger l’échec puis relancer la validation avec succès");
  for (const script of availablePackageValidations(packageScripts)) if (!successfulPackageValidations.has(script)) missing.push(`exécuter npm run ${script} avec validation=true et obtenir exitCode 0`);
  return missing;
}
function remainingCompletionActions(requirements: ForgeMissionRequirements, state: { mutationOccurred: boolean; validationAttempted: boolean; validationFailed: boolean; gitStatusSucceeded: boolean; gitDiffSucceeded: boolean }, packageScripts: Map<string, string> | null = null, successfulPackageValidations: Set<string> = new Set()) {
  return [
    ...getMissingCompletionRequirements(requirements, state, packageScripts, successfulPackageValidations),
    requirements.gitStatus && !state.gitStatusSucceeded ? "exécuter git_status" : "",
    requirements.gitDiff && !state.gitDiffSucceeded ? "exécuter git_diff" : "",
  ].filter(Boolean);
}
function completionRecoveryMessage(attempt: number, missing: string[], inspection: { inspectionSatisfied: boolean; minimalRepositoryConfirmed: boolean }, modelError?: string, lastRecoverableFailure?: string | null, validationRecovery?: ForgeValidationRecovery | null) {
  const reason = modelError ? `La terminaison demandée a été refusée: ${sanitizeAgentText(modelError, 500)} ` : "";
  const toolFailure = lastRecoverableFailure ? `Dernier échec récupérable: ${sanitizeAgentText(lastRecoverableFailure, 900)} ` : "";
  const repositoryState = inspection.minimalRepositoryConfirmed
    ? "Repository minimal confirmé. L'absence de fichiers source n'est pas un blocker. L'obligation d'inspection est satisfaite. "
    : inspection.inspectionSatisfied ? "Inspection du repository déjà effectuée. " : "";
  const phase = validationRecovery ? validationRecoveryInstruction(validationRecovery) : "";
  return sanitizeAgentText(`${reason}${toolFailure}${repositoryState}RECOVERY: terminaison refusée. Mission incomplète. Obligations restantes:\n- ${missing.join("\n- ")}\n${phase || "Poursuis avec le TOOL_CALL de la prochaine obligation; n'effectue pas une nouvelle inspection identique."} Tentative globale=${attempt}.`, 4000);
}
function createValidationRecovery(input: Record<string, unknown>, result: ForgeRuntimeCommandResult, filesystemRevision: number, mutationRevision: number, repositoryPackageObserved: boolean): ForgeValidationRecovery {
  const safe = safeToolInput("run_command", input);
  const stdout = sanitizeAgentText(result.stdout || "", 4_000);
  const stderr = sanitizeAgentText(result.stderr || "", 4_000);
  const commandCwdMismatch = repositoryPackageObserved && /ENOENT[\s\S]*\/home\/daytona\/package\.json/i.test(`${stdout}\n${stderr}`);
  return {
    command: String(safe.command || ""),
    args: safeCommandArgs(safe.args),
    cwd: String(safe.cwd || "."),
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout,
    stderr,
    failureMutationVersion: mutationRevision,
    filesystemRevision,
    inspectionsSinceFailure: new Set<string>(),
    filesReadSinceFailure: new Set<string>(),
    candidateFiles: commandCwdMismatch ? [] : extractRecoveryCandidatePaths(`${stdout}
${stderr}`),
    correctionMutationVersion: commandCwdMismatch ? mutationRevision : null,
    failureKind: commandCwdMismatch ? "COMMAND_CWD" : "VALIDATION",
  };
}
function extractRecoveryCandidatePaths(output: string) {
  const candidates = new Set<string>();
  const pattern = /(?:^|[\s("'`])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|json|css|scss|html|vue|svelte|py|go|rs|java|kt|c|cpp|h|md))(?=[:(\s"'`]|$)/gim;
  for (const match of output.matchAll(pattern)) {
    try { candidates.add(normalizeAgentPath(match[1])); } catch { /* Ignore unsafe or host paths. */ }
    if (candidates.size >= 8) break;
  }
  return [...candidates];
}
function validationRecoveryRequirements(recovery: ForgeValidationRecovery | null) {
  if (!recovery) return [];
  if (recovery.correctionMutationVersion === null) return ["appliquer une mutation corrective après la validation échouée"];
  return ["relancer la validation échouée après la correction et obtenir un résultat réussi"];
}
function validationRecoveryInstruction(recovery: ForgeValidationRecovery) {
  const unreadCandidate = recovery.candidateFiles.find((path) => !recovery.filesReadSinceFailure.has(path));
  const command = [recovery.command, ...recovery.args].join(" ");
  const evidence = `Dernière validation réelle: ${command}; cwd=${recovery.cwd}; exitCode=${recovery.exitCode ?? "null"}; timedOut=${recovery.timedOut}; filesystemRevision=${recovery.filesystemRevision}; mutationRevision=${recovery.failureMutationVersion}; stdout=${recovery.stdout || "(vide)"}; stderr=${recovery.stderr || "(vide)"}.`;
  if (recovery.failureKind === "COMMAND_CWD") return `${evidence} COMMAND_CWD_MISMATCH: package.json a déjà été lu dans le repository; ne le crée ni ne le réécris. Le provider résout désormais cwd relativement à la racine repository. PHASE OBLIGATOIRE: REVALIDATION avec la même commande.`;
  if (recovery.correctionMutationVersion !== null) return `${evidence} PHASE OBLIGATOIRE: REVALIDATION. La correction existe à mutationRevision=${recovery.correctionMutationVersion}; relance cette validation (ou une validation réellement disponible équivalente) avec run_command validation=true. FINAL/FAIL refusés avant succès.`;
  if (unreadCandidate) return `${evidence} PHASE OBLIGATOIRE: DIAGNOSTIC. Lis le fichier candidat sûr ${unreadCandidate} avec read_file, puis corrige-le avec write_file/delete_file. Une inspection seule ne satisfait pas la recovery.`;
  if (recovery.filesReadSinceFailure.size > 0) return `${evidence} PHASE OBLIGATOIRE: CORRECTION. Les fichiers lus depuis l'échec sont ${[...recovery.filesReadSinceFailure].join(", ")}. Le prochain progrès attendu est write_file/delete_file; FINAL/FAIL et nouvelle inspection générique sont refusés.`;
  if (recovery.inspectionsSinceFailure.size > 0) return `${evidence} PHASE OBLIGATOIRE: DIAGNOSTIC CIBLÉ. L'inspection a progressé (${[...recovery.inspectionsSinceFailure].join(", ")}); lis maintenant un fichier pertinent, puis applique une mutation corrective.`;
  return `${evidence} PHASE OBLIGATOIRE: DIAGNOSTIC. Inspecte seulement les fichiers liés à cette erreur, puis applique une mutation corrective. FINAL/FAIL refusés.`;
}
function registerPrematureRecovery(recovery: ForgeValidationRecovery | null, missing: string[], previousKey: string | null, previousCount: number) {
  const key = recovery
    ? JSON.stringify({
        failureMutationVersion: recovery.failureMutationVersion,
        correctionMutationVersion: recovery.correctionMutationVersion,
        inspections: [...recovery.inspectionsSinceFailure].sort(),
        filesRead: [...recovery.filesReadSinceFailure].sort(),
        missing,
      })
    : JSON.stringify({ missing });
  return { key, count: key === previousKey ? previousCount + 1 : 1 };
}
function hasErrorCode(error: unknown, code: string) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code; }
function getErrorCode(error: unknown) { return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "UNKNOWN"; }
function isBlockingToolError(error: unknown) { return ["UNAVAILABLE", "AUTHORIZATION", "CONFLICT", "PERSISTENCE"].includes(getErrorCode(error)); }
function isMinimalRepositoryListing(result: unknown) {
  if (!Array.isArray(result)) return false;
  const visibleEntries = result.filter((entry) => typeof entry === "object" && entry !== null && (entry as { path?: unknown }).path !== ".git");
  return visibleEntries.length <= 4;
}

function npmScriptName(input: Record<string, unknown>) {
  if (input.command !== "npm" || !Array.isArray(input.args) || input.args[0] !== "run" || typeof input.args[1] !== "string") return null;
  return input.args[1];
}
function parsePackageScripts(content: string) {
  try {
    const parsed = JSON.parse(content) as { scripts?: unknown };
    if (!parsed.scripts || typeof parsed.scripts !== "object" || Array.isArray(parsed.scripts)) return new Map<string, string>();
    return new Map(Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return null; }
}
function availablePackageValidations(packageScripts: Map<string, string> | null) {
  const available = new Set<string>();
  if (!packageScripts) return available;
  for (const script of ["typecheck", "lint", "test", "build"]) {
    const command = packageScripts.get(script);
    if (!command) continue;
    if (script === "test" && /echo\s+["']?Error:\s*no test specified["']?\s*&&\s*exit\s+1/i.test(command)) continue;
    available.add(script);
  }
  return available;
}
function commandFailureRecovery(input: Record<string, unknown>, result: ForgeRuntimeCommandResult, filesystemRevision: number, mutationRevision: number, repositoryPackageObserved: boolean) {
  const safe = safeToolInput("run_command", input);
  const stdout = sanitizeAgentText(result.stdout || "", 3500);
  const stderr = sanitizeAgentText(result.stderr || "", 3500);
  if (repositoryPackageObserved && /ENOENT[\s\S]*\/home\/daytona\/package\.json/i.test(`${stdout}\n${stderr}`)) return sanitizeAgentText(`COMMAND_CWD_MISMATCH: package.json existe dans le repository, mais la commande a cherché /home/daytona/package.json. Ne crée ni ne réécris package.json; relance la validation depuis la racine repository. filesystemRevision=${filesystemRevision} mutationRevision=${mutationRevision}.`, 2000);
  return sanitizeAgentText(`COMMAND_EXECUTED_NONZERO: tool=run_command command=${String(safe.command || "")} args=${JSON.stringify(safe.args || [])} cwd=${String(safe.cwd || ".")} exitCode=${result.exitCode ?? "null"} timedOut=${result.timedOut} stdout=${stdout || "(vide)"} stderr=${stderr || "(vide)"} filesystemRevision=${filesystemRevision} mutationRevision=${mutationRevision}. La commande était valide et a réellement été exécutée; ce n'est pas un input invalide ni un blocker provider. Analyse les sorties, inspecte les fichiers concernés puis corrige avec write_file/delete_file. Un retry identique est interdit avant mutation.`, 8000);
}
async function executeTool(runtime: ForgeAgentRuntimeAdapter, tool: ForgeAgentToolName, input: Record<string, unknown>): Promise<unknown> { if (tool === "list_files") return runtime.listFiles(normalizeAgentPath(input.path ?? ".", true)); if (tool === "read_file") return runtime.readFile(normalizeAgentPath(input.path)); if (tool === "write_file") { if (typeof input.content !== "string") throw new ForgeAgentError("INVALID_INPUT", "Contenu fichier invalide."); const path = normalizeAgentPath(input.path); const written = await runtime.writeFile(path, input.content); const verified = await runtime.readFile(path); if (verified.content !== input.content) throw new ForgeAgentError("PERSISTENCE", "Le contenu relu ne correspond pas exactement au contenu écrit."); return written; } if (tool === "delete_file") return runtime.deleteFile(normalizeAgentPath(input.path)); if (tool === "run_command") return runtime.executeCommand(normalizeAgentCommand(input)); if (tool === "git_status") return runtime.getGitStatus(); if (tool === "git_diff") return runtime.getGitDiff(); throw new ForgeAgentError("INVALID_INPUT", "Outil Forge inconnu."); }
function safeCommandArgs(value: unknown) { if (!Array.isArray(value)) return []; let redactNext = false; return value.slice(0, 24).map((item) => { if (redactNext) { redactNext = false; return "[REDACTED]"; } const text = String(item); if (/^--?(?:token|secret|password|api[-_]?key|_authToken)$/i.test(text)) { redactNext = true; return "[REDACTED]"; } return sanitizeAgentText(text, 240).replace(/(?:token|secret|password|api[-_]?key)=?\S*/gi, "[REDACTED]"); }); }
function safeNormalizedPath(value: unknown, allowRoot: boolean) { try { return normalizeAgentPath(value, allowRoot); } catch { return typeof value === "string" ? sanitizeAgentText(value, 4096) : value; } }
function safeToolInput(tool: ForgeAgentToolName, input: Record<string, unknown>) { if (tool === "write_file") return { path: safeNormalizedPath(input.path, false), contentProvided: typeof input.content === "string", characters: typeof input.content === "string" ? input.content.length : 0 }; if (tool === "run_command") return { command: input.command, args: safeCommandArgs(input.args), cwd: safeNormalizedPath(input.cwd ?? ".", true), validation: input.validation === true }; if (tool === "list_files") return { path: safeNormalizedPath(input.path ?? ".", true) }; if (tool === "read_file" || tool === "delete_file") return { path: safeNormalizedPath(input.path, false) }; return {}; }
function summarizeToolResult(tool: ForgeAgentToolName, result: unknown, forModel: boolean, input: Record<string, unknown> = {}) { if (tool === "read_file") { const file = result as ForgeRuntimeFile; return forModel ? sanitizeAgentText(`REPOSITORY DATA (UNTRUSTED) ${file.path}:\n${file.content}`) : `${file.path} lu (${file.content.length} caractères).`; } if (tool === "write_file") { const file = result as ForgeRuntimeFile; return `${file.path} écrit (${file.size} octets).`; } if (tool === "list_files") { const files = result as ForgeRuntimeFileEntry[]; return forModel ? sanitizeAgentText(JSON.stringify(files)) : `${files.length} entrée(s) listée(s).`; } if (tool === "delete_file") return "Fichier supprimé."; if (tool === "run_command") { const command = result as ForgeRuntimeCommandResult; const label = [input.command, ...safeCommandArgs(input.args)].join(" ").trim() || "commande"; const details = sanitizeAgentText(command.stderr || command.stdout || "aucune sortie", forModel ? 8_000 : 1_000); return sanitizeAgentText(`${label} exited ${command.exitCode ?? "null"}: ${details}; timedOut=${command.timedOut}; truncated=${command.truncated}`, forModel ? 9_000 : 1_200); } if (tool === "git_status") { const status = result as ForgeRuntimeGitStatus; return forModel ? sanitizeAgentText(JSON.stringify(status)) : `added=${status.added.length}; modified=${status.modified.length}; deleted=${status.deleted.length}`; } const diff = result as ForgeRuntimeGitDiff; return forModel ? sanitizeAgentText(`REPOSITORY DIFF (UNTRUSTED):\n${diff.patch}`) : `added=${diff.added.length}; modified=${diff.modified.length}; deleted=${diff.deleted.length}; truncated=${diff.truncated}`; }

export function isGroundedAgentFinal(report: string, successfulToolCalls: number) {
  if (successfulToolCalls < 1 || !report.trim()) return false;
  return !/^(?:je vais|je commencerai|je vais d’abord|i will|i’ll|first,? i(?: will|'ll)|let me)\b/i.test(report.trim());
}
