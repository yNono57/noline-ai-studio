import type { ApexForgeHandoff, ApexMissionContext, ApexPlanDraft, ApexTechnicalPlan } from "./contracts";

const MAX_ITEMS = 24;
const MAX_TEXT = 2_000;

function boundedText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} cannot be empty.`);
  return normalized.slice(0, MAX_TEXT);
}

function boundedUnique(values: readonly string[], label: string) {
  const unique = [...new Set(values.map((value) => boundedText(value, label)))];
  if (!unique.length) throw new TypeError(`${label} cannot be empty.`);
  return unique.slice(0, MAX_ITEMS);
}

export function createApexTechnicalPlan(context: ApexMissionContext, draft: ApexPlanDraft): ApexTechnicalPlan {
  const acceptanceCriteria = draft.acceptanceCriteria.slice(0, MAX_ITEMS);
  if (!acceptanceCriteria.length) throw new TypeError("acceptanceCriteria cannot be empty.");
  const criterionIds = new Set<string>();
  for (const criterion of acceptanceCriteria) {
    if (!criterion.id.trim() || criterionIds.has(criterion.id)) throw new TypeError("Acceptance criterion ids must be unique and non-empty.");
    criterionIds.add(criterion.id);
    boundedText(criterion.description, "acceptance criterion");
    boundedText(criterion.evidenceRequired, "acceptance evidence");
  }
  return Object.freeze({
    objective: boundedText(context.objective, "objective"),
    scope: Object.freeze({
      inScope: boundedUnique(draft.inScope, "inScope"),
      outOfScope: boundedUnique(draft.outOfScope, "outOfScope"),
      architecturalAreas: boundedUnique(draft.architecturalAreas, "architecturalAreas"),
      likelyRelevantPaths: [...new Set(draft.likelyRelevantPaths.map((path) => boundedText(path, "likelyRelevantPaths")))].slice(0, MAX_ITEMS),
      allowJustifiedExpansion: draft.allowJustifiedExpansion ?? true,
    }),
    implementationSteps: boundedUnique(draft.implementationSteps, "implementationSteps"),
    requiredValidation: boundedUnique(draft.requiredValidation, "requiredValidation"),
    securityConsiderations: [...new Set(draft.securityConsiderations)].slice(0, MAX_ITEMS),
    acceptanceCriteria,
    forgeConstraints: [...context.constraints, ...draft.forgeConstraints].slice(0, MAX_ITEMS),
  });
}

export function createForgeHandoff(plan: ApexTechnicalPlan): ApexForgeHandoff {
  return Object.freeze({
    mission: plan.objective,
    technicalPlan: plan,
    inScope: plan.scope.inScope,
    outOfScope: plan.scope.outOfScope,
    acceptanceCriteria: plan.acceptanceCriteria,
    requiredValidation: plan.requiredValidation,
    constraints: plan.forgeConstraints,
  });
}
