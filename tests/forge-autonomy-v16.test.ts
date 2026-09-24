import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgeSearchArgs,
  classifyForgeValidation,
  compactForgeWorkingMemory,
  createForgeWorkingMemory,
  forgeSearchSignature,
  hasMutationProvenance,
  hasSufficientDiscovery,
  normalizeForgeSearchInput,
  parseForgeSearchOutput,
  rememberUnique,
  replayRun4FailureClass,
} from "../lib/forge/autonomy-foundation";

test("Search Code V2 transforme une phrase naturelle en recherche multi-termes littérale et bornée", () => {
  const search = normalizeForgeSearchInput({ query: "provider model gateway usage cost", path: ".", extensions: [".ts", "tsx"], maxResults: 12 });
  assert.equal(search.mode, "ANY_TERM");
  assert.deepEqual(search.terms, ["provider", "model", "gateway", "usage", "cost"]);
  assert.deepEqual(search.extensions, ["ts", "tsx"]);
  assert.equal(search.maxResults, 12);
  const args = buildForgeSearchArgs(search);
  assert.ok(args.includes("--fixed-strings"));
  assert.equal(args.filter((value: string) => value === "-e").length, 5);
  assert.ok(args.includes("!node_modules/**"));
  assert.ok(args.includes("!.env*"));
});

test("Search Code V2 supporte symbole exact, résultats structurés et feedback zéro résultat", () => {
  const exact = normalizeForgeSearchInput({ terms: ["ModelGateway"], mode: "EXACT_SYMBOL", path: "lib", maxResults: 1 });
  assert.ok(buildForgeSearchArgs(exact).includes("--word-regexp"));
  const result = parseForgeSearchOutput(exact, "lib/ai/gateway/model-gateway.ts:12:export class ModelGateway {}\nlib/other.ts:2:ModelGateway");
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0], { path: "lib/ai/gateway/model-gateway.ts", line: 12, snippet: "export class ModelGateway {}", matchedTerms: ["ModelGateway"] });
  assert.equal(result.totalMatches, 2);
  assert.equal(result.truncated, true);
  const empty = parseForgeSearchOutput(exact, "");
  assert.equal(empty.zeroResult, true);
  assert.match(empty.guidance || "", /Aucun résultat.*EXACT_SYMBOL.*Simplifie ou sépare/);
});

test("les recherches équivalentes partagent une signature globale indépendamment de l'ordre et de la casse", () => {
  const first = normalizeForgeSearchInput({ terms: ["Usage", "Gateway"], mode: "ANY_TERM", path: ".", extensions: ["tsx", "ts"] });
  const second = normalizeForgeSearchInput({ terms: ["gateway", "usage"], mode: "ANY_TERM", path: ".", extensions: ["ts", "tsx"] });
  assert.equal(forgeSearchSignature(first), forgeSearchSignature(second));
});

test("working memory conserve une provenance bornée et protège les mutations hors scope", () => {
  const memory = createForgeWorkingMemory("Corriger un composant", ["Découvrir", "Modifier", "Valider"]);
  rememberUnique(memory.relevantFiles, "src/relevant.ts");
  rememberUnique(memory.filesRead, "src/relevant.ts");
  rememberUnique(memory.intendedMutationTargets, "src/relevant.ts");
  rememberUnique(memory.filesRead, "app/unrelated.tsx");
  assert.equal(hasSufficientDiscovery(memory), true);
  assert.equal(hasMutationProvenance(memory, "src/relevant.ts"), true);
  assert.equal(hasMutationProvenance(memory, "app/unrelated.tsx"), false);
  for (let index = 0; index < 30; index += 1) rememberUnique(memory.unresolvedProblems, `problem-${index}`);
  const compact = compactForgeWorkingMemory(memory, "DISCOVERY_REQUIRED");
  assert.ok(compact.unresolvedProblems.length <= 8);
  assert.equal(compact.phase, "DISCOVERY_REQUIRED");
});

test("validation distingue environnement, application, tests et inconnu", () => {
  assert.equal(classifyForgeValidation("Cannot find module 'react/jsx-runtime'\nCannot find module 'next/server'\nCannot find module 'x'", 2, false), "ENVIRONMENT");
  assert.equal(classifyForgeValidation("src/app.ts:4:2 Type error: string is not number", 2, false), "APPLICATION");
  assert.equal(classifyForgeValidation("AssertionError: expected true to equal false in test", 1, false), "TEST");
  assert.equal(classifyForgeValidation("process exited unexpectedly", 1, false), "UNKNOWN");
});

test("replay Run 4 converge dans les budgets sans dérive Agent Builder", () => {
  const replay = replayRun4FailureClass();
  assert.deepEqual(replay, { steps: 13, toolCalls: 11, searches: 1, zeroResultSearches: 0, relevantReads: 2, irrelevantReads: 0, mutations: 1, validationAttempts: 2, recoveryActions: 1, repeatedActions: 0, result: "COMPLETED" });
  assert.ok(replay.steps < 60);
  assert.ok(replay.toolCalls < 48);
});

test("replay termine de façon bornée pour recherches vides, mutation hors scope et environnement irréparable", () => {
  const noResults = replayRun4FailureClass({ repeatedZeroResults: true });
  assert.equal(noResults.result, "FAILED");
  assert.equal(noResults.searches, 6);
  assert.ok(noResults.steps < 60);
  const drift = replayRun4FailureClass({ irrelevantMutation: true });
  assert.equal(drift.result, "FAILED");
  assert.equal(drift.mutations, 0);
  assert.equal(drift.recoveryActions, 1);
  const environment = replayRun4FailureClass({ environmentRepairable: false });
  assert.equal(environment.result, "FAILED");
  assert.equal(environment.validationAttempts, 1);
  assert.ok(environment.steps < 60);
});
