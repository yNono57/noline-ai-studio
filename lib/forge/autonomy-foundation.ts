import { normalizeRuntimePath } from "./runtime-foundation";

type ForgeAgentPhase = "NORMAL" | "DISCOVERY_REQUIRED" | "ENVIRONMENT_REQUIRED" | "DIAGNOSTIC" | "CORRECTION_REQUIRED" | "REVALIDATION_REQUIRED";
const sensitivePath = /(^|\/)(\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?)(\/|$)/i;
function normalizeAgentPath(value: unknown, allowRoot = false) { const path = normalizeRuntimePath(typeof value === "string" ? value : "", allowRoot); if (sensitivePath.test(path) && !/\.env\.example$/i.test(path)) throw new Error("Ce chemin sensible n’est pas accessible à l’agent."); return path; }
function sanitizeAgentText(value: string, max: number) { return value.replace(/(sk-[A-Za-z0-9_-]{12,}|gh[opsu]_[A-Za-z0-9_]{12,}|(?:API_KEY|PRIVATE_KEY|TOKEN|SECRET)\s*[:=]\s*\S+)/gi, "[REDACTED]").replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[REDACTED]@").replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, max); }

export type ForgeSearchMode = "ANY_TERM" | "ALL_TERMS" | "EXACT_SYMBOL" | "LITERAL";
export type ForgeSearchQuery = { terms: string[]; mode: ForgeSearchMode; path: string; extensions: string[]; maxResults: number };
export type ForgeSearchMatch = { path: string; line: number; snippet: string; matchedTerms: string[] };
export type ForgeSearchResult = { interpretation: ForgeSearchQuery; matches: ForgeSearchMatch[]; totalMatches: number; truncated: boolean; zeroResult: boolean; guidance: string | null };
export type ForgeValidationClassification = "ENVIRONMENT" | "APPLICATION" | "TEST" | "UNKNOWN";
export type ForgeWorkingMemory = {
  objective: string;
  plan: string[];
  currentPlanItem: number;
  completedPlanItems: number[];
  relevantFiles: string[];
  filesRead: string[];
  intendedMutationTargets: string[];
  filesMutated: string[];
  gitDiffSummary: string | null;
  latestValidationCommand: string | null;
  latestValidationClassification: ForgeValidationClassification | null;
  latestValidationResult: "PASS" | "FAIL" | null;
  unresolvedProblems: string[];
  remainingCompletionGates: string[];
};

const SEARCH_LIMIT = 80;
const MEMORY_LIST_LIMIT = 20;
const sourceExtension = /^[a-z0-9][a-z0-9+.-]{0,11}$/i;

export function normalizeForgeSearchInput(input: Record<string, unknown>): ForgeSearchQuery {
  const legacy = typeof input.query === "string" ? input.query.trim() : "";
  const supplied = Array.isArray(input.terms) ? input.terms : [];
  let terms = supplied.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  const requestedMode = typeof input.mode === "string" ? input.mode.toUpperCase() : "";
  const mode: ForgeSearchMode = ["ANY_TERM", "ALL_TERMS", "EXACT_SYMBOL", "LITERAL"].includes(requestedMode)
    ? requestedMode as ForgeSearchMode
    : terms.length > 0 ? "ANY_TERM" : legacy.includes("|") ? "ANY_TERM" : legacy.split(/\s+/).length > 1 ? "ANY_TERM" : "LITERAL";
  if (!terms.length && legacy) terms = mode === "ANY_TERM" ? legacy.split(/\s*\|\s*|\s+/) : [legacy];
  terms = [...new Set(terms.map((term) => term.slice(0, 120)))].slice(0, 8);
  if (!terms.length || terms.some((term) => term.length < 2 || /[\r\n\0]/.test(term))) throw new Error("Requête de recherche de code invalide.");
  const extensions = Array.isArray(input.extensions)
    ? [...new Set(input.extensions.filter((item): item is string => typeof item === "string").map((item) => item.replace(/^\./, "").toLowerCase()).filter((item) => sourceExtension.test(item)))].slice(0, 8)
    : [];
  return { terms, mode, path: normalizeAgentPath(input.path ?? ".", true), extensions, maxResults: Math.max(1, Math.min(Number(input.maxResults) || 40, SEARCH_LIMIT)) };
}

export function forgeSearchSignature(search: ForgeSearchQuery) {
  return JSON.stringify({ terms: [...search.terms].map((term) => term.toLowerCase()).sort(), mode: search.mode, path: search.path.toLowerCase(), extensions: [...search.extensions].sort() });
}

export function buildForgeSearchArgs(search: ForgeSearchQuery) {
  const args = ["--line-number", "--no-heading", "--color", "never", "--fixed-strings"];
  if (search.mode === "EXACT_SYMBOL") args.push("--word-regexp");
  for (const glob of ["!.git/**", "!node_modules/**", "!.next/**", "!.env*", "!.npmrc", "!credentials*", "!secrets*", "!id_rsa*", "!id_ed25519*"]) args.push("--glob", glob);
  for (const extension of search.extensions) args.push("--glob", `*.${extension}`);
  for (const term of search.terms) args.push("-e", term);
  args.push("--", search.path);
  return args;
}

export function parseForgeSearchOutput(search: ForgeSearchQuery, stdout: string, truncated = false): ForgeSearchResult {
  const raw = stdout.split(/\r?\n/).filter(Boolean);
  const parsed = raw.map((line): ForgeSearchMatch | null => {
    const match = /^(.+?):(\d+):(.*)$/.exec(line);
    if (!match) return null;
    const snippet = sanitizeAgentText(match[3].trim(), 320);
    const lower = snippet.toLowerCase();
    const matchedTerms = search.terms.filter((term) => lower.includes(term.toLowerCase()));
    return { path: match[1].replace(/\\/g, "/"), line: Number(match[2]), snippet, matchedTerms };
  }).filter((item): item is ForgeSearchMatch => Boolean(item));
  const filtered = search.mode === "ALL_TERMS" ? parsed.filter((match) => match.matchedTerms.length === search.terms.length) : parsed;
  const matches = filtered.slice(0, search.maxResults);
  const zeroResult = matches.length === 0;
  return {
    interpretation: search,
    matches,
    totalMatches: filtered.length,
    truncated: truncated || filtered.length > matches.length,
    zeroResult,
    guidance: zeroResult ? `Aucun résultat. Interprétation ${search.mode}: ${search.terms.join(" OR ")}. Simplifie ou sépare les termes, essaie un symbole exact, ou ajuste path/extensions.` : null,
  };
}

export function classifyForgeValidation(output: string, exitCode: number | null, timedOut: boolean): ForgeValidationClassification {
  if (exitCode === 0 && !timedOut) return "UNKNOWN";
  const text = output.toLowerCase();
  const systemicModules = ["react/jsx-runtime", "next/server", "cannot find name 'process'", "cannot find name \"process\"", "@types/node"];
  const missingModuleCount = (text.match(/cannot find module/g) || []).length;
  if (timedOut || /command not found|enoent|npm err! code e(?:noent|resolve)|could not read package\.json|could not find package\.json/.test(text) || missingModuleCount >= 3 || systemicModules.filter((needle) => text.includes(needle)).length >= 2) return "ENVIRONMENT";
  if (/\b(test|spec)\b[\s\S]*(?:fail|error)|(?:fail|error)[\s\S]*\b(test|spec)\b|assertionerror|expected .* (?:to|but)/.test(text)) return "TEST";
  if (/\.(?:ts|tsx|js|jsx|py|go|rs|java|css|scss):\d+(?::\d+)?|type error|syntaxerror|eslint/.test(text)) return "APPLICATION";
  return "UNKNOWN";
}

export function createForgeWorkingMemory(objective: string, plan: string[]): ForgeWorkingMemory {
  return { objective: sanitizeAgentText(objective, 1000), plan: plan.slice(0, 8), currentPlanItem: 0, completedPlanItems: [], relevantFiles: [], filesRead: [], intendedMutationTargets: [], filesMutated: [], gitDiffSummary: null, latestValidationCommand: null, latestValidationClassification: null, latestValidationResult: null, unresolvedProblems: [], remainingCompletionGates: [] };
}

export function rememberUnique(list: string[], value: string) { if (value && !list.includes(value)) list.push(value); if (list.length > MEMORY_LIST_LIMIT) list.splice(0, list.length - MEMORY_LIST_LIMIT); }
export function hasMutationProvenance(memory: ForgeWorkingMemory, path: string) { return memory.filesRead.includes(path) && (memory.relevantFiles.includes(path) || memory.intendedMutationTargets.includes(path)); }
export function hasSufficientDiscovery(memory: ForgeWorkingMemory) { return memory.relevantFiles.some((path) => memory.filesRead.includes(path)) && memory.intendedMutationTargets.length > 0; }
export function compactForgeWorkingMemory(memory: ForgeWorkingMemory, phase: ForgeAgentPhase) {
  return { ...memory, objective: sanitizeAgentText(memory.objective, 1000), plan: memory.plan.slice(0, 8), relevantFiles: memory.relevantFiles.slice(-MEMORY_LIST_LIMIT), filesRead: memory.filesRead.slice(-MEMORY_LIST_LIMIT), intendedMutationTargets: memory.intendedMutationTargets.slice(-MEMORY_LIST_LIMIT), filesMutated: memory.filesMutated.slice(-MEMORY_LIST_LIMIT), unresolvedProblems: memory.unresolvedProblems.slice(-8).map((item) => sanitizeAgentText(item, 400)), remainingCompletionGates: memory.remainingCompletionGates.slice(0, 10), phase };
}

export type ForgeReplayMetrics = { steps: number; toolCalls: number; searches: number; zeroResultSearches: number; relevantReads: number; irrelevantReads: number; mutations: number; validationAttempts: number; recoveryActions: number; repeatedActions: number; result: "COMPLETED" | "FAILED" };
export function replayRun4FailureClass(options: { repeatedZeroResults?: boolean; irrelevantMutation?: boolean; environmentRepairable?: boolean; discoveryBudget?: number } = {}): ForgeReplayMetrics {
  const metrics: ForgeReplayMetrics = { steps: 1, toolCalls: 0, searches: 0, zeroResultSearches: 0, relevantReads: 0, irrelevantReads: 0, mutations: 0, validationAttempts: 0, recoveryActions: 0, repeatedActions: 0, result: "FAILED" };
  const budget = options.discoveryBudget ?? 6;
  const seen = new Set<string>();
  const searches = options.repeatedZeroResults ? Array.from({ length: budget + 1 }, (_, index) => ({ terms: [`missing-${index}`], mode: "ANY_TERM" as const, path: ".", extensions: ["ts"], maxResults: 20 })) : [{ terms: ["provider", "gateway", "usage", "cost"], mode: "ANY_TERM" as const, path: ".", extensions: ["ts"], maxResults: 20 }];
  for (const search of searches) {
    const signature = forgeSearchSignature(search);
    metrics.steps += 1;
    if (seen.has(signature)) { metrics.repeatedActions += 1; continue; }
    seen.add(signature);
    if (metrics.searches >= budget) { metrics.recoveryActions += 1; return metrics; }
    metrics.searches += 1; metrics.toolCalls += 1;
    if (options.repeatedZeroResults) { metrics.zeroResultSearches += 1; metrics.recoveryActions += 1; continue; }
    const result = parseForgeSearchOutput(search, "lib/ai/gateway/model-gateway.ts:12:export class ModelGateway {}\nlib/core/usage/usage.ts:8:export type UsageEvent = unknown");
    if (result.zeroResult) metrics.zeroResultSearches += 1;
  }
  if (options.repeatedZeroResults) return metrics;
  metrics.steps += 2; metrics.toolCalls += 2; metrics.relevantReads += 2;
  if (options.irrelevantMutation) { metrics.steps += 1; metrics.recoveryActions += 1; return metrics; }
  metrics.steps += 2; metrics.toolCalls += 2; metrics.validationAttempts += 1; metrics.recoveryActions += 1;
  if (options.environmentRepairable === false) return metrics;
  metrics.steps += 1; metrics.toolCalls += 1;
  metrics.steps += 1; metrics.toolCalls += 1; metrics.mutations += 1;
  metrics.steps += 2; metrics.toolCalls += 2; metrics.validationAttempts += 1;
  metrics.steps += 3; metrics.toolCalls += 2;
  metrics.result = "COMPLETED";
  return metrics;
}
