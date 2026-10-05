import assert from "node:assert/strict";
import test from "node:test";
import { ModelGateway, ModelRegistry, modelId } from "../lib/ai";
import {
  APEX_FUTURE_LOOP,
  APEX_SECURITY_CATEGORIES,
  ApexModelGateway,
  createApexCorrectionRequest,
  createApexTechnicalPlan,
  createForgeHandoff,
  reviewApexImplementation,
  runApexOfflineHarness,
  type ApexMissionContext,
  type ApexPlanDraft,
  type ApexReviewInput,
} from "../lib/apex";

const context: ApexMissionContext = {
  objective: "Integrate provider usage into the existing shared accounting contracts.",
  repositoryContext: "TypeScript application with shared Core, Model Gateway and Forge runtime.",
  architectureContext: "Product agents depend on Model Gateway; Core remains provider-neutral.",
  relevantDiscoveredFiles: ["lib/forge/forge-openai.ts", "lib/ai/gateway/model-gateway.ts", "lib/core/usage/contracts.ts"],
  constraints: [
    { id: "no-loop-change", kind: "FORBIDDEN", description: "Do not change the Forge agent loop." },
    { id: "unknown-not-zero", kind: "REQUIRED", description: "Unavailable usage remains UNKNOWN." },
  ],
};

const draft: ApexPlanDraft = {
  inScope: ["lib/forge", "lib/ai", "lib/core", "tests"],
  outOfScope: ["app/agent-builder", "app/pricing", "supabase/migrations"],
  architecturalAreas: ["FORGE", "MODEL_GATEWAY", "CORE_USAGE", "TESTS"],
  likelyRelevantPaths: context.relevantDiscoveredFiles,
  implementationSteps: ["Inspect the current provider boundary.", "Connect normalized usage without changing public contracts.", "Add focused regression tests."],
  requiredValidation: ["npm run test:forge", "npm run test:core", "npm run test:gateway"],
  securityConsiderations: ["COST", "SECRETS", "EXTERNAL_SIDE_EFFECT"],
  acceptanceCriteria: [
    { id: "usage", description: "Available provider units are represented.", evidenceRequired: "Focused usage regression test." },
    { id: "unknown", description: "Unavailable values remain UNKNOWN.", evidenceRequired: "Unknown-value regression test." },
  ],
  forgeConstraints: [{ id: "no-production", kind: "FORBIDDEN", description: "Do not mutate Production." }],
};

const plan = createApexTechnicalPlan(context, draft);
const validations = plan.requiredValidation.map((command) => ({ command, status: "PASS" as const, summary: "passed" }));
const completion = plan.acceptanceCriteria.map((criterion) => ({ criterionId: criterion.id, satisfied: true, evidence: criterion.evidenceRequired }));

function implementation(filesChanged: ApexReviewInput["filesChanged"], overrides: Partial<Omit<ApexReviewInput, "objective" | "technicalPlan" | "filesChanged">> = {}): ApexReviewInput {
  return {
    objective: context.objective,
    technicalPlan: plan,
    forgeExecutionSummary: "Implemented the bounded change and validation.",
    filesChanged,
    gitDiff: filesChanged.map((file) => `diff --git a/${file.path} b/${file.path}`).join("\n"),
    validationEvidence: validations,
    completionGateEvidence: completion,
    artifact: { status: "READY", changedFiles: filesChanged.map((file) => file.path), baseCommitSha: "abc123" },
    ...overrides,
  };
}

test("APEX plan and Forge handoff preserve bounded scope, criteria, validation and constraints", () => {
  assert.equal(plan.objective, context.objective);
  assert.deepEqual(plan.scope.inScope, draft.inScope);
  assert.deepEqual(plan.scope.outOfScope, draft.outOfScope);
  assert.equal(plan.acceptanceCriteria.length, 2);
  const handoff = createForgeHandoff(plan);
  assert.equal(handoff.mission, context.objective);
  assert.deepEqual(handoff.requiredValidation, draft.requiredValidation);
  assert.ok(handoff.constraints.some((constraint) => constraint.id === "no-loop-change"));
  assert.ok(handoff.constraints.some((constraint) => constraint.id === "no-production"));
});

test("APEX exposes the complete security review taxonomy", () => {
  assert.deepEqual(APEX_SECURITY_CATEGORIES, ["AUTH", "RLS_OWNERSHIP", "SECRETS", "EXTERNAL_SIDE_EFFECT", "PRODUCTION_MUTATION", "DEPENDENCY", "DATA_MIGRATION", "PERMISSION", "COST"]);
});

test("Run-4 drift into Agent Builder is blocking and rejected", () => {
  const review = reviewApexImplementation(implementation([{
    path: "app/agent-builder/page.tsx",
    summary: "Changed unrelated Agent Builder UI.",
    architecturalArea: "AGENT_BUILDER_UI",
    relevanceEvidence: "The compiler mentioned this file first.",
  }]));
  assert.equal(review.decision, "REJECT");
  assert.ok(review.findings.some((item) => item.severity === "BLOCKING" && item.category === "SCOPE" && item.path === "app/agent-builder/page.tsx"));
});

test("relevant implementation with complete evidence is approved", () => {
  const files = [
    { path: "lib/forge/forge-openai.ts", summary: "Exposes normalized provider usage.", architecturalArea: "FORGE", relevanceEvidence: "This is the current Forge provider boundary." },
    { path: "tests/forge-usage.test.ts", summary: "Covers known and unknown usage.", architecturalArea: "TESTS", relevanceEvidence: "Validates the acceptance criteria." },
  ];
  const review = reviewApexImplementation(implementation(files));
  assert.equal(review.decision, "APPROVE");
  assert.equal(review.findings.filter((item) => item.severity === "BLOCKING").length, 0);
});

test("legitimate discovered dependency is allowed with evidence and a bounded scope expansion", () => {
  const files = [{
    path: "lib/shared/provider-metadata.ts",
    summary: "Reuses existing provider metadata.",
    architecturalArea: "MODEL_GATEWAY",
    relevanceEvidence: "Imported by the existing Model Gateway usage normalization.",
    scopeExpansionJustification: "A shared dependency discovered after the initial plan is required to avoid duplication.",
  }];
  const review = reviewApexImplementation(implementation(files));
  assert.equal(review.decision, "APPROVE");
  assert.ok(review.findings.some((item) => item.severity === "WARNING" && item.category === "SCOPE"));
});

test("missing validation, public-contract drift and missing Completion Gate evidence reject", () => {
  const files = [{ path: "lib/forge/contracts.ts", summary: "Changed public response.", architecturalArea: "FORGE", relevanceEvidence: "Used by Forge.", publicContractChanged: true }];
  const review = reviewApexImplementation(implementation(files, {
    validationEvidence: validations.slice(1),
    completionGateEvidence: completion.slice(1),
  }));
  assert.equal(review.decision, "REJECT");
  assert.ok(review.findings.some((item) => item.category === "VALIDATION"));
  assert.ok(review.findings.some((item) => item.category === "PUBLIC_CONTRACT"));
  assert.ok(review.findings.some((item) => item.category === "COMPLETION_GATE"));
});

test("security-sensitive effects are blocking while review-only categories remain warnings", () => {
  const files = [{
    path: "lib/forge/provider.ts",
    summary: "Touches provider behavior.",
    architecturalArea: "FORGE",
    relevanceEvidence: "Provider boundary required by mission.",
    securityCategories: ["COST", "PRODUCTION_MUTATION"] as const,
  }];
  const review = reviewApexImplementation(implementation(files));
  assert.equal(review.decision, "REJECT");
  assert.ok(review.findings.some((item) => item.category === "COST" && item.severity === "WARNING"));
  assert.ok(review.findings.some((item) => item.category === "PRODUCTION_MUTATION" && item.severity === "BLOCKING"));
});

test("correction handoff contains only blocking findings and required revalidation", () => {
  const input = implementation([{
    path: "lib/shared/provider-metadata.ts",
    summary: "Expanded scope but also attempted Production mutation.",
    architecturalArea: "MODEL_GATEWAY",
    relevanceEvidence: "Required provider metadata.",
    scopeExpansionJustification: "Discovered dependency.",
    securityCategories: ["PRODUCTION_MUTATION"],
  }]);
  const review = reviewApexImplementation(input);
  const correction = createApexCorrectionRequest(review, input);
  assert.ok(correction.blockingFindings.length > 0);
  assert.ok(correction.blockingFindings.every((item) => item.severity === "BLOCKING"));
  assert.deepEqual(correction.requiredRevalidation, plan.requiredValidation);
});

test("offline harness proves reject, correction and approval without network", () => {
  const bad = implementation([{ path: "app/agent-builder/page.tsx", summary: "Unrelated UI mutation.", architecturalArea: "AGENT_BUILDER_UI", relevanceEvidence: "Compiler-first drift." }]);
  const good = implementation([{ path: "lib/forge/provider-usage.ts", summary: "Relevant usage adapter.", architecturalArea: "FORGE", relevanceEvidence: "Forge provider usage boundary." }]);
  const result = runApexOfflineHarness(context, draft, stripPlan(bad), stripPlan(good));
  assert.equal(result.firstReview.decision, "REJECT");
  assert.equal(result.finalReview.decision, "APPROVE");
  assert.ok(result.correction.requiredCorrections.length > 0);
  assert.equal(APEX_FUTURE_LOOP.active, false);
  assert.equal(APEX_FUTURE_LOOP.maximumCorrectionRounds, 2);
});

test("APEX model boundary uses the shared Model Gateway with a mocked provider", async () => {
  const apexModel = modelId("apex-mock");
  const outputs = [JSON.stringify(draft), JSON.stringify({ findings: [] })];
  const gateway = new ModelGateway({
    registry: new ModelRegistry([{ provider: "mock", id: apexModel, capabilities: { supported: new Set(["text", "structured_output"]) }, enabled: true, usageUnit: "tokens" }]),
    providers: [{ provider: "mock", async generate() { return { text: outputs.shift()!, model: apexModel, usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2, unit: "tokens" } }; } }],
    now: () => new Date("2026-10-05T00:00:00.000Z"),
  });
  const apex = new ApexModelGateway(gateway, apexModel);
  assert.deepEqual(await apex.draftPlan(context), draft);
  assert.deepEqual(await apex.advisoryReview(implementation([])), []);
});

function stripPlan(input: ApexReviewInput): Omit<ApexReviewInput, "objective" | "technicalPlan"> {
  const { objective: _objective, technicalPlan: _technicalPlan, ...rest } = input;
  return rest;
  void _objective;
  void _technicalPlan;
}
