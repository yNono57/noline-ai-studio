export type ConfidenceLevel = "low" | "medium" | "high";

export interface IdeaAnalysis {
  originalIdea: string;
  summary: string;
  sector: string;
  targetAudience: string;
  problem: string;
  need: string;
  valueProposition: string;
  assumptions: string[];
  confidence: ConfidenceLevel;
  marketAssessment: MarketAssessment;
}

export interface MarketAssessment {
  score: number;
  marketSize: string;
  maturity: string;
  competition: string;
  difficulty: string;
  saasPotential: ScoreCriterion;
  agencyPotential: ScoreCriterion;
  licensingPotential: ScoreCriterion;
}

export interface ScoreCriterion {
  score: number;
  rationale: string;
}

export interface BusinessScore {
  overall: number;
  market: ScoreCriterion;
  profitability: ScoreCriterion;
  originality: ScoreCriterion;
  easeOfSale: ScoreCriterion;
  scalability: ScoreCriterion;
  marketNeed: ScoreCriterion;
  targetClarity: ScoreCriterion;
  differentiation: ScoreCriterion;
  feasibility: ScoreCriterion;
  monetizationPotential: ScoreCriterion;
  strengths: string[];
  risks: string[];
  nextValidationStep: string;
}

export type AgentComplexity = "simple" | "intermediate" | "advanced";

export interface GeneratedAgent {
  name: string;
  description: string;
  sector: string;
  targetAudience: string;
  mission: string;
  features: string[];
  tone: string[];
  complexity: AgentComplexity;
  businessGoal: string;
  systemPrompt: string;
  suggestedInputs: string[];
  expectedOutput: string;
  premiumFeatures: string[];
  v2Features: string[];
  futureFeatures: string[];
  differentiation: string[];
  personas: AgentPersona[];
  customerObjections: CustomerObjection[];
  salesArguments: string[];
  pricing: AgentPricing;
}

export interface AgentPersona {
  name: string;
  role: string;
  context: string;
  painPoints: string[];
  expectedOutcome: string;
}

export interface CustomerObjection {
  objection: string;
  response: string;
}

export interface AgentPricing {
  recommendedPrice: string;
  subscription: string;
  upsell: string[];
  rationale: string;
}

export type RoadmapPriority = "low" | "medium" | "high";

export interface RoadmapPhase {
  order: number;
  title: string;
  objective: string;
  deliverables: string[];
  estimatedDuration: string;
  priority: RoadmapPriority;
  stage: "MVP" | "V1" | "V2" | "V3";
  difficulty: "low" | "medium" | "high";
}

export interface AgentRoadmap {
  objective: string;
  phases: RoadmapPhase[];
  successMetrics: string[];
  dependencies: string[];
}

export type RecommendationCategory =
  | "positioning"
  | "feature"
  | "pricing"
  | "distribution"
  | "validation"
  | "risk"
  | "opportunity"
  | "competitor"
  | "improvement"
  | "extension"
  | "complementary_agent";

export interface ProductRecommendation {
  title: string;
  category: RecommendationCategory;
  rationale: string;
  expectedImpact: string;
  effort: "low" | "medium" | "high";
  priority: RoadmapPriority;
  actionItems: string[];
}

export interface AgentBuilderContext {
  language?: string;
  market?: string;
  constraints?: string[];
}

export interface AnalyzeIdeaInput {
  idea: string;
  context?: AgentBuilderContext;
}

export interface GenerateBusinessScoreInput {
  analysis: IdeaAnalysis;
  context?: AgentBuilderContext;
}

export interface GenerateAgentInput {
  analysis: IdeaAnalysis;
  businessScore?: BusinessScore;
  context?: AgentBuilderContext;
}

export interface GenerateRoadmapInput {
  analysis: IdeaAnalysis;
  agent: GeneratedAgent;
  context?: AgentBuilderContext;
}

export interface GenerateRecommendationsInput {
  analysis: IdeaAnalysis;
  businessScore: BusinessScore;
  agent: GeneratedAgent;
  roadmap?: AgentRoadmap;
  context?: AgentBuilderContext;
}
