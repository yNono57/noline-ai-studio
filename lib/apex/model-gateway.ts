import type { ModelGateway, ModelId } from "@/lib/ai";
import type { ApexFinding, ApexMissionContext, ApexPlanDraft, ApexReviewInput } from "./contracts";

export class ApexModelGateway {
  constructor(private readonly gateway: ModelGateway, private readonly model: ModelId) {}

  async draftPlan(context: ApexMissionContext): Promise<ApexPlanDraft> {
    const result = await this.gateway.generate({
      model: this.model,
      messages: [
        { role: "system", content: "You are APEX. Produce a bounded technical plan only. Do not implement code or invoke tools." },
        { role: "user", content: JSON.stringify(context) },
      ],
      structuredOutput: { name: "apex_technical_plan", schema: PLAN_SCHEMA, strict: true },
    });
    return parseJson<ApexPlanDraft>(result.text, "APEX plan");
  }

  async advisoryReview(input: ApexReviewInput): Promise<readonly ApexFinding[]> {
    const result = await this.gateway.generate({
      model: this.model,
      messages: [
        { role: "system", content: "You are APEX. Review only. Return structured findings; never modify code, run commands, or publish." },
        { role: "user", content: JSON.stringify(input) },
      ],
      structuredOutput: { name: "apex_review_findings", schema: FINDINGS_SCHEMA, strict: true },
    });
    return parseJson<{ findings: ApexFinding[] }>(result.text, "APEX review").findings;
  }
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new TypeError(`${label} returned invalid structured output.`);
  }
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["inScope", "outOfScope", "architecturalAreas", "likelyRelevantPaths", "implementationSteps", "requiredValidation", "securityConsiderations", "acceptanceCriteria", "forgeConstraints"],
  properties: {
    inScope: { type: "array", items: { type: "string" } },
    outOfScope: { type: "array", items: { type: "string" } },
    architecturalAreas: { type: "array", items: { type: "string" } },
    likelyRelevantPaths: { type: "array", items: { type: "string" } },
    implementationSteps: { type: "array", items: { type: "string" } },
    requiredValidation: { type: "array", items: { type: "string" } },
    securityConsiderations: { type: "array", items: { type: "string" } },
    acceptanceCriteria: { type: "array", items: { type: "object" } },
    forgeConstraints: { type: "array", items: { type: "object" } },
  },
} as const;

const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "category", "reason", "requiredCorrection"],
        properties: {
          severity: { enum: ["BLOCKING", "WARNING"] },
          category: { type: "string" },
          path: { type: "string" },
          reason: { type: "string" },
          requiredCorrection: { type: "string" },
        },
      },
    },
  },
} as const;
