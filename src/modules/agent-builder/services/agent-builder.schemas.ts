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

const uxJourneyStep = object({
  name: text,
  userGoal: text,
  interaction: text,
  friction: text,
  successSignal: text
});
const uxStrategy = object({
  score,
  summary: text,
  designPrinciples: textList,
  primaryJourney: { type: "array", items: uxJourneyStep },
  onboarding: textList,
  keyScreens: textList,
  accessibility: textList,
  retentionMechanisms: textList
});

const pricingTier = object({
  name: text,
  target: text,
  monthlyPrice: text,
  annualPrice: text,
  features: textList,
  limits: textList
});
const pricingStrategy = object({
  score,
  summary: text,
  recommendedModel: text,
  valueMetric: text,
  tiers: { type: "array", items: pricingTier, minItems: 3 },
  trialStrategy: text,
  upsells: textList,
  validationTests: textList,
  keyMetrics: textList
});

const marketingChannel = object({
  channel: text,
  objective: text,
  audience: text,
  message: text,
  actions: textList
});
const marketingStrategy = object({
  score,
  summary: text,
  positioning: text,
  corePromise: text,
  channels: { type: "array", items: marketingChannel },
  launchPlan: textList,
  contentPillars: textList,
  acquisitionFunnel: textList,
  keyMetrics: textList
});

const developmentPhase = object({
  order: { type: "integer" },
  name: text,
  objective: text,
  duration: text,
  difficulty: { type: "string", enum: ["low", "medium", "high"] },
  deliverables: textList,
  acceptanceCriteria: textList
});
const developmentPlan = object({
  score,
  summary: text,
  architecture: text,
  stackRecommendations: textList,
  phases: { type: "array", items: developmentPhase },
  dependencies: textList,
  technicalRisks: textList,
  qualityGates: textList
});

const aiImplementationPlan = object({
  score,
  summary: text,
  modelStrategy: text,
  promptArchitecture: textList,
  dataRequirements: textList,
  retrievalStrategy: text,
  guardrails: textList,
  evaluationPlan: textList,
  observability: textList,
  costOptimization: textList
});

const executiveSummary = object({
  score,
  summary: text,
  vision: text,
  opportunity: text,
  keyFindings: textList,
  priorities: textList,
  nextSteps: textList
});
const financialScenario = object({
  year: text,
  conservativeRevenue: text,
  targetRevenue: text,
  ambitiousRevenue: text
});
const financialForecast = object({
  score,
  summary: text,
  assumptions: textList,
  scenarios: { type: "array", items: financialScenario, minItems: 3, maxItems: 3 },
  costDrivers: textList,
  breakEvenHypothesis: text,
  keyMetrics: textList,
  disclaimer: text
});
const competitorProfile = object({
  name: text,
  positioning: text,
  strengths: textList,
  weaknesses: textList
});
const competitorAnalysis = object({
  score,
  summary: text,
  marketPosition: text,
  competitors: { type: "array", items: competitorProfile },
  differentiationOpportunities: textList,
  monitoringActions: textList
});
const legalCompliance = object({
  score,
  summary: text,
  riskLevel: { type: "string", enum: ["low", "medium", "high"] },
  obligations: textList,
  keyRisks: textList,
  requiredActions: textList,
  disclaimer: text
});
const salesPack = object({
  score,
  summary: text,
  elevatorPitch: text,
  valuePropositions: textList,
  discoveryQuestions: textList,
  objectionHandling: { type: "array", items: objection },
  closingSequence: textList
});
const brandingPack = object({
  score,
  summary: text,
  brandPositioning: text,
  personality: textList,
  nameIdeas: textList,
  taglines: textList,
  visualDirection: textList,
  voiceGuidelines: textList
});
const seoKeyword = object({
  keyword: text,
  intent: text,
  priority: { type: "string", enum: ["low", "medium", "high"] }
});
const seoStrategy = object({
  score,
  summary: text,
  keywords: { type: "array", items: seoKeyword },
  contentPillars: textList,
  priorityPages: textList,
  technicalActions: textList,
  keyMetrics: textList
});
const productEpic = object({
  name: text,
  goal: text,
  priority: { type: "string", enum: ["low", "medium", "high"] },
  stories: textList
});
const productBacklog = object({
  score,
  summary: text,
  epics: { type: "array", items: productEpic },
  definitionOfDone: textList,
  releaseCriteria: textList
});
const technicalDiagrams = object({
  score,
  summary: text,
  architectureDiagram: text,
  dataFlowDiagram: text,
  components: textList,
  implementationNotes: textList
});
const promptTemplate = object({
  name: text,
  purpose: text,
  systemPrompt: text,
  userTemplate: text,
  variables: textList
});
const promptPack = object({
  score,
  summary: text,
  prompts: { type: "array", items: promptTemplate },
  usageGuidelines: textList,
  evaluationCriteria: textList
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
  }),
  generate_ux_strategy: uxStrategy,
  generate_pricing_strategy: pricingStrategy,
  generate_marketing_strategy: marketingStrategy,
  generate_development_plan: developmentPlan,
  generate_ai_implementation_plan: aiImplementationPlan,
  generate_executive_summary: executiveSummary,
  generate_financial_forecast: financialForecast,
  generate_competitor_analysis: competitorAnalysis,
  generate_legal_compliance: legalCompliance,
  generate_sales_pack: salesPack,
  generate_branding_pack: brandingPack,
  generate_seo_strategy: seoStrategy,
  generate_product_backlog: productBacklog,
  generate_technical_diagrams: technicalDiagrams,
  generate_prompt_pack: promptPack
};

export function getAgentBuilderSchema(task: AgentBuilderV2Task): JsonSchema {
  return schemas[task];
}
