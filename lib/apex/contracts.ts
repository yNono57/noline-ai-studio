import type { ModelId } from "@/lib/ai";

export type ApexReviewDecision = "APPROVE" | "REJECT";
export type ApexFindingSeverity = "BLOCKING" | "WARNING";
export const APEX_SECURITY_CATEGORIES = [
  "AUTH",
  "RLS_OWNERSHIP",
  "SECRETS",
  "EXTERNAL_SIDE_EFFECT",
  "PRODUCTION_MUTATION",
  "DEPENDENCY",
  "DATA_MIGRATION",
  "PERMISSION",
  "COST",
] as const;
export type ApexSecurityCategory = (typeof APEX_SECURITY_CATEGORIES)[number];
export type ApexFindingCategory =
  | "SCOPE"
  | "RELEVANCE"
  | "ARCHITECTURE"
  | "VALIDATION"
  | "PUBLIC_CONTRACT"
  | "COMPLETION_GATE"
  | "UNRELATED_REFACTOR"
  | ApexSecurityCategory;

export interface ApexConstraint {
  readonly id: string;
  readonly description: string;
  readonly kind: "REQUIRED" | "FORBIDDEN";
}

export interface ApexAcceptanceCriterion {
  readonly id: string;
  readonly description: string;
  readonly evidenceRequired: string;
}

export interface ApexScope {
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly architecturalAreas: readonly string[];
  readonly likelyRelevantPaths: readonly string[];
  readonly allowJustifiedExpansion: boolean;
}

export interface ApexMissionContext {
  readonly objective: string;
  readonly repositoryContext: string;
  readonly architectureContext: string;
  readonly relevantDiscoveredFiles: readonly string[];
  readonly constraints: readonly ApexConstraint[];
}

export interface ApexTechnicalPlan {
  readonly objective: string;
  readonly scope: ApexScope;
  readonly implementationSteps: readonly string[];
  readonly requiredValidation: readonly string[];
  readonly securityConsiderations: readonly ApexSecurityCategory[];
  readonly acceptanceCriteria: readonly ApexAcceptanceCriterion[];
  readonly forgeConstraints: readonly ApexConstraint[];
}

export interface ApexForgeHandoff {
  readonly mission: string;
  readonly technicalPlan: ApexTechnicalPlan;
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly acceptanceCriteria: readonly ApexAcceptanceCriterion[];
  readonly requiredValidation: readonly string[];
  readonly constraints: readonly ApexConstraint[];
}

export interface ApexChangedFile {
  readonly path: string;
  readonly summary: string;
  readonly architecturalArea?: string;
  readonly relevanceEvidence?: string;
  readonly scopeExpansionJustification?: string;
  readonly publicContractChanged?: boolean;
  readonly publicContractAuthorized?: boolean;
  readonly suspiciousRefactor?: boolean;
  readonly securityCategories?: readonly ApexSecurityCategory[];
}

export interface ApexValidationEvidence {
  readonly command: string;
  readonly status: "PASS" | "FAIL" | "NOT_RUN";
  readonly summary: string;
}

export interface ApexCompletionEvidence {
  readonly criterionId: string;
  readonly satisfied: boolean;
  readonly evidence: string;
}

export interface ApexArtifactMetadata {
  readonly status: "READY" | "EMPTY" | "MISSING";
  readonly changedFiles: readonly string[];
  readonly baseCommitSha?: string;
}

export interface ApexReviewInput {
  readonly objective: string;
  readonly technicalPlan: ApexTechnicalPlan;
  readonly forgeExecutionSummary: string;
  readonly filesChanged: readonly ApexChangedFile[];
  readonly gitDiff: string;
  readonly validationEvidence: readonly ApexValidationEvidence[];
  readonly completionGateEvidence: readonly ApexCompletionEvidence[];
  readonly artifact: ApexArtifactMetadata;
}

export interface ApexFinding {
  readonly severity: ApexFindingSeverity;
  readonly category: ApexFindingCategory;
  readonly path?: string;
  readonly reason: string;
  readonly requiredCorrection: string;
}

export interface ApexReviewResult {
  readonly decision: ApexReviewDecision;
  readonly findings: readonly ApexFinding[];
  readonly summary: string;
}

export interface ApexCorrectionRequest {
  readonly blockingFindings: readonly ApexFinding[];
  readonly requiredCorrections: readonly string[];
  readonly requiredRevalidation: readonly string[];
}

export interface ApexPlanDraft {
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly architecturalAreas: readonly string[];
  readonly likelyRelevantPaths: readonly string[];
  readonly implementationSteps: readonly string[];
  readonly requiredValidation: readonly string[];
  readonly securityConsiderations: readonly ApexSecurityCategory[];
  readonly acceptanceCriteria: readonly ApexAcceptanceCriterion[];
  readonly forgeConstraints: readonly ApexConstraint[];
  readonly allowJustifiedExpansion?: boolean;
}

export interface ApexModelConfiguration {
  readonly model: ModelId;
}

export type ApexFutureLoopState =
  | "APEX_PLAN"
  | "FORGE_RUN"
  | "APEX_REVIEW"
  | "FORGE_CORRECTION"
  | "PUBLICATION_GATE";

export const APEX_FUTURE_LOOP = Object.freeze({
  states: ["APEX_PLAN", "FORGE_RUN", "APEX_REVIEW", "FORGE_CORRECTION", "PUBLICATION_GATE"] as const,
  maximumCorrectionRounds: 2,
  active: false,
});
