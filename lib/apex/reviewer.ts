import type { ApexCorrectionRequest, ApexFinding, ApexReviewInput, ApexReviewResult } from "./contracts";

const normalizePath = (value: string) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const matchesArea = (path: string, area: string) => {
  const normalizedArea = normalizePath(area).replace(/\/$/, "");
  return path === normalizedArea || path.startsWith(`${normalizedArea}/`);
};

function finding(input: ApexFinding): ApexFinding { return Object.freeze(input); }

export function reviewApexImplementation(input: ApexReviewInput, advisoryFindings: readonly ApexFinding[] = []): ApexReviewResult {
  const findings: ApexFinding[] = [...advisoryFindings];
  const scope = input.technicalPlan.scope;
  const artifactPaths = new Set(input.artifact.changedFiles.map(normalizePath));

  for (const file of input.filesChanged) {
    const path = normalizePath(file.path);
    const explicitlyExcluded = scope.outOfScope.some((area) => matchesArea(path, area));
    const directlyInScope = scope.inScope.some((area) => matchesArea(path, area));
    const architectureKnown = !file.architecturalArea || scope.architecturalAreas.includes(file.architecturalArea);
    const justifiedExpansion = scope.allowJustifiedExpansion && Boolean(file.scopeExpansionJustification?.trim()) && Boolean(file.relevanceEvidence?.trim());

    if (explicitlyExcluded) {
      findings.push(finding({ severity: "BLOCKING", category: "SCOPE", path, reason: "The file is inside an explicitly excluded scope.", requiredCorrection: "Revert this mutation or obtain a revised APEX plan that explicitly authorizes it." }));
    } else if (!directlyInScope && !justifiedExpansion) {
      findings.push(finding({ severity: "BLOCKING", category: "RELEVANCE", path, reason: "The mutation has no approved scope or evidence-backed expansion.", requiredCorrection: "Revert the mutation or provide relevance evidence and a bounded scope-expansion justification." }));
    } else if (!directlyInScope) {
      findings.push(finding({ severity: "WARNING", category: "SCOPE", path, reason: "The file was discovered outside the initial scope with documented relevance.", requiredCorrection: "Preserve the scope-expansion justification in the implementation summary." }));
    }

    if (!architectureKnown && !justifiedExpansion) {
      findings.push(finding({ severity: "BLOCKING", category: "ARCHITECTURE", path, reason: "The mutation crosses an unapproved architectural boundary without justification.", requiredCorrection: "Revert it or explicitly replan the architectural boundary with supporting evidence." }));
    }
    if (!file.relevanceEvidence?.trim()) {
      findings.push(finding({ severity: "BLOCKING", category: "RELEVANCE", path, reason: "Mission relevance was not established for this mutation.", requiredCorrection: "Provide evidence connecting the file to the mission or revert it." }));
    }
    if (file.publicContractChanged && !file.publicContractAuthorized) {
      findings.push(finding({ severity: "BLOCKING", category: "PUBLIC_CONTRACT", path, reason: "A public contract changed without plan authorization.", requiredCorrection: "Restore the public contract or obtain explicit authorization and add compatibility tests." }));
    }
    if (file.suspiciousRefactor) {
      findings.push(finding({ severity: "BLOCKING", category: "UNRELATED_REFACTOR", path, reason: "The diff contains an unrelated or insufficiently justified refactor.", requiredCorrection: "Remove the unrelated refactor from this change." }));
    }
    for (const category of file.securityCategories || []) {
      const blocking = category === "PRODUCTION_MUTATION" || category === "SECRETS" || category === "EXTERNAL_SIDE_EFFECT";
      findings.push(finding({ severity: blocking ? "BLOCKING" : "WARNING", category, path, reason: `The change touches the ${category} security boundary.`, requiredCorrection: blocking ? "Remove the unauthorized sensitive effect or obtain an explicit revised plan." : "Document the security evidence and retain focused regression coverage." }));
    }
    if (!artifactPaths.has(path)) {
      findings.push(finding({ severity: "BLOCKING", category: "COMPLETION_GATE", path, reason: "The changed file is missing from artifact metadata.", requiredCorrection: "Regenerate the artifact from the final Git diff." }));
    }
  }

  for (const required of input.technicalPlan.requiredValidation) {
    const evidence = input.validationEvidence.find((item) => item.command === required);
    if (!evidence || evidence.status !== "PASS") {
      findings.push(finding({ severity: "BLOCKING", category: "VALIDATION", reason: `Required validation did not pass: ${required}.`, requiredCorrection: `Run ${required} successfully and attach its evidence.` }));
    }
  }
  for (const criterion of input.technicalPlan.acceptanceCriteria) {
    const evidence = input.completionGateEvidence.find((item) => item.criterionId === criterion.id);
    if (!evidence?.satisfied || !evidence.evidence.trim()) {
      findings.push(finding({ severity: "BLOCKING", category: "COMPLETION_GATE", reason: `Acceptance criterion is missing evidence: ${criterion.id}.`, requiredCorrection: criterion.evidenceRequired }));
    }
  }
  if (input.filesChanged.length && input.artifact.status !== "READY") {
    findings.push(finding({ severity: "BLOCKING", category: "COMPLETION_GATE", reason: "A non-empty implementation has no READY artifact.", requiredCorrection: "Produce a final persisted artifact from the validated diff." }));
  }

  const deduplicated = [...new Map(findings.map((item) => [`${item.severity}:${item.category}:${item.path || ""}:${item.reason}`, item])).values()];
  const decision = deduplicated.some((item) => item.severity === "BLOCKING") ? "REJECT" : "APPROVE";
  return Object.freeze({ decision, findings: deduplicated, summary: decision === "APPROVE" ? "Implementation satisfies the approved plan and evidence gates." : "Implementation requires correction before approval." });
}

export function createApexCorrectionRequest(review: ApexReviewResult, input: ApexReviewInput): ApexCorrectionRequest {
  if (review.decision !== "REJECT") throw new TypeError("Correction requests require a REJECT decision.");
  const blockingFindings = review.findings.filter((item) => item.severity === "BLOCKING");
  return Object.freeze({
    blockingFindings,
    requiredCorrections: [...new Set(blockingFindings.map((item) => item.requiredCorrection))],
    requiredRevalidation: [...input.technicalPlan.requiredValidation],
  });
}
