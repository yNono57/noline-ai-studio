import type { AgentBuilderV2Task } from "../prompts";

type JsonSchema = Record<string, unknown>;

const text = { type: "string" } as const;
const score = { type: "integer", minimum: 0, maximum: 100 } as const;
const textList = { type: "array", items: text } as const;

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false
  };
}

const scoreCriterion = object({ score, rationale: text });
const marketAssessment = object({
  score,
  marketSize: text,
  maturity: text,
  competition: text,
  difficulty: text,
  saasPotential: scoreCriterion,
  agencyPotential: scoreCriterion,
  licensingPotential: scoreCriterion
});

const ideaAnalysis = object({
  originalIdea: text,
  summary: text,
  sector: text,
  targetAudience: text,
  problem: text,
  need: text,
  valueProposition: text,
  assumptions: textList,
  confidence: { type: "string", enum: ["low", "medium", "high"] },
  marketAssessment
});

const businessScore = object({
  overall: score,
  market: scoreCriterion,
  profitability: scoreCriterion,
  originality: scoreCriterion,
  easeOfSale: scoreCriterion,
  scalability: scoreCriterion,
  marketNeed: scoreCriterion,
  targetClarity: scoreCriterion,
  differentiation: scoreCriterion,
  feasibility: scoreCriterion,
  monetizationPotential: scoreCriterion,
  strengths: textList,
  risks: textList,
  nextValidationStep: text
});

const persona = object({
  name: text,
  role: text,
  context: text,
  painPoints: textList,
  expectedOutcome: text
});
const objection = object({ objection: text, response: text });
const pricing = object({
  recommendedPrice: text,
  subscription: text,
  upsell: textList,
  rationale: text
});

const generatedAgent = object({
  name: text,
  description: text,
  sector: text,
  targetAudience: text,
  mission: text,
  features: textList,
  tone: textList,
  complexity: { type: "string", enum: ["simple", "intermediate", "advanced"] },
  businessGoal: text,
  systemPrompt: text,
  suggestedInputs: textList,
  expectedOutput: text,
  premiumFeatures: textList,
  v2Features: textList,
  futureFeatures: textList,
  differentiation: textList,
  personas: { type: "array", items: persona },
  customerObjections: { type: "array", items: objection },
  salesArguments: textList,
  pricing
});

const roadmapPhase = object({
  order: { type: "integer" },
  title: text,
  objective: text,
  deliverables: textList,
  estimatedDuration: text,
  priority: { type: "string", enum: ["low", "medium", "high"] },
  stage: { type: "string", enum: ["MVP", "V1", "V2", "V3"] },
  difficulty: { type: "string", enum: ["low", "medium", "high"] }
});
const agentRoadmap = object({
  objective: text,
  phases: { type: "array", items: roadmapPhase, minItems: 4 },
  successMetrics: textList,
  dependencies: textList
});

const productRecommendation = object({
  title: text,
  category: {
    type: "string",
    enum: [
      "positioning",
      "feature",
      "pricing",
      "distribution",
      "validation",
      "risk",
      "opportunity",
      "competitor",
      "improvement",
      "extension",
      "complementary_agent"
    ]
  },
  rationale: text,
  expectedImpact: text,
  effort: { type: "string", enum: ["low", "medium", "high"] },
  priority: { type: "string", enum: ["low", "medium", "high"] },
  actionItems: textList
});

const schemas: Record<AgentBuilderV2Task, JsonSchema> = {
  analyze_idea: ideaAnalysis,
  generate_business_score: businessScore,
  generate_agent: generatedAgent,
  generate_roadmap: agentRoadmap,
  generate_recommendations: object({
    recommendations: {
      type: "array",
      items: productRecommendation,
      minItems: 7
    }
  })
};

export function getAgentBuilderSchema(task: AgentBuilderV2Task): JsonSchema {
  return schemas[task];
}
