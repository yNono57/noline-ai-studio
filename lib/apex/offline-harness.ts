import type { ApexMissionContext, ApexPlanDraft, ApexReviewInput } from "./contracts";
import { createForgeHandoff, createApexTechnicalPlan } from "./planner";
import { createApexCorrectionRequest, reviewApexImplementation } from "./reviewer";

export function runApexOfflineHarness(context: ApexMissionContext, draft: ApexPlanDraft, firstImplementation: Omit<ApexReviewInput, "objective" | "technicalPlan">, correctedImplementation: Omit<ApexReviewInput, "objective" | "technicalPlan">) {
  const plan = createApexTechnicalPlan(context, draft);
  const handoff = createForgeHandoff(plan);
  const firstInput: ApexReviewInput = { objective: context.objective, technicalPlan: plan, ...firstImplementation };
  const firstReview = reviewApexImplementation(firstInput);
  if (firstReview.decision !== "REJECT") throw new Error("Offline harness expected the first implementation to be rejected.");
  const correction = createApexCorrectionRequest(firstReview, firstInput);
  const correctedInput: ApexReviewInput = { objective: context.objective, technicalPlan: plan, ...correctedImplementation };
  const finalReview = reviewApexImplementation(correctedInput);
  if (finalReview.decision !== "APPROVE") throw new Error("Offline harness expected the corrected implementation to be approved.");
  return Object.freeze({ plan, handoff, firstReview, correction, finalReview });
}
