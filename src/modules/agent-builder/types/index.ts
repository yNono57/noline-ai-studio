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

export interface UXJourneyStep {
  name: string;
  userGoal: string;
  interaction: string;
  friction: string;
  successSignal: string;
}

export interface UXStrategy {
  score: number;
  summary: string;
  designPrinciples: string[];
  primaryJourney: UXJourneyStep[];
  onboarding: string[];
  keyScreens: string[];
  accessibility: string[];
  retentionMechanisms: string[];
}

export interface PricingTier {
  name: string;
  target: string;
  monthlyPrice: string;
  annualPrice: string;
  features: string[];
  limits: string[];
}

export interface PricingStrategy {
  score: number;
  summary: string;
  recommendedModel: string;
  valueMetric: string;
  tiers: PricingTier[];
  trialStrategy: string;
  upsells: string[];
  validationTests: string[];
  keyMetrics: string[];
}

export interface MarketingChannel {
  channel: string;
  objective: string;
  audience: string;
  message: string;
  actions: string[];
}

export interface MarketingStrategy {
  score: number;
  summary: string;
  positioning: string;
  corePromise: string;
  channels: MarketingChannel[];
  launchPlan: string[];
  contentPillars: string[];
  acquisitionFunnel: string[];
  keyMetrics: string[];
}

export interface DevelopmentPhase {
  order: number;
  name: string;
  objective: string;
  duration: string;
  difficulty: "low" | "medium" | "high";
  deliverables: string[];
  acceptanceCriteria: string[];
}

export interface DevelopmentPlan {
  score: number;
  summary: string;
  architecture: string;
  stackRecommendations: string[];
  phases: DevelopmentPhase[];
  dependencies: string[];
  technicalRisks: string[];
  qualityGates: string[];
}

export interface AIImplementationPlan {
  score: number;
  summary: string;
  modelStrategy: string;
  promptArchitecture: string[];
  dataRequirements: string[];
  retrievalStrategy: string;
  guardrails: string[];
  evaluationPlan: string[];
  observability: string[];
  costOptimization: string[];
}

export interface ExecutiveSummary {
  score: number;
  summary: string;
  vision: string;
  opportunity: string;
  keyFindings: string[];
  priorities: string[];
  nextSteps: string[];
}

export interface FinancialScenario {
  year: string;
  conservativeRevenue: string;
  targetRevenue: string;
  ambitiousRevenue: string;
}

export interface FinancialForecast {
  score: number;
  summary: string;
  assumptions: string[];
  scenarios: FinancialScenario[];
  costDrivers: string[];
  breakEvenHypothesis: string;
  keyMetrics: string[];
  disclaimer: string;
}

export interface CompetitorProfile {
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
}

export interface CompetitorAnalysis {
  score: number;
  summary: string;
  marketPosition: string;
  competitors: CompetitorProfile[];
  differentiationOpportunities: string[];
  monitoringActions: string[];
}

export interface LegalCompliance {
  score: number;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  obligations: string[];
  keyRisks: string[];
  requiredActions: string[];
  disclaimer: string;
}

export interface SalesPack {
  score: number;
  summary: string;
  elevatorPitch: string;
  valuePropositions: string[];
  discoveryQuestions: string[];
  objectionHandling: CustomerObjection[];
  closingSequence: string[];
}

export interface BrandingPack {
  score: number;
  summary: string;
  brandPositioning: string;
  personality: string[];
  nameIdeas: string[];
  taglines: string[];
  visualDirection: string[];
  voiceGuidelines: string[];
}

export interface SEOKeyword {
  keyword: string;
  intent: string;
  priority: "low" | "medium" | "high";
}

export interface SEOStrategy {
  score: number;
  summary: string;
  keywords: SEOKeyword[];
  contentPillars: string[];
  priorityPages: string[];
  technicalActions: string[];
  keyMetrics: string[];
}

export interface ProductEpic {
  name: string;
  goal: string;
  priority: "low" | "medium" | "high";
  stories: string[];
}

export interface ProductBacklog {
  score: number;
  summary: string;
  epics: ProductEpic[];
  definitionOfDone: string[];
  releaseCriteria: string[];
}

export interface TechnicalDiagrams {
  score: number;
  summary: string;
  architectureDiagram: string;
  dataFlowDiagram: string;
  components: string[];
  implementationNotes: string[];
}

export interface PromptTemplate {
  name: string;
  purpose: string;
  systemPrompt: string;
  userTemplate: string;
  variables: string[];
}

export interface PromptPack {
  score: number;
  summary: string;
  prompts: PromptTemplate[];
  usageGuidelines: string[];
  evaluationCriteria: string[];
}

export interface GenerateExpertStrategiesInput {
  analysis: IdeaAnalysis;
  businessScore: BusinessScore;
  agent: GeneratedAgent;
  roadmap: AgentRoadmap;
  recommendations: ProductRecommendation[];
  context?: AgentBuilderContext;
}

export interface GenerateProjectDeliverablesInput
  extends GenerateExpertStrategiesInput {
  uxStrategy: UXStrategy;
  pricingStrategy: PricingStrategy;
  marketingStrategy: MarketingStrategy;
  developmentPlan: DevelopmentPlan;
  aiImplementationPlan: AIImplementationPlan;
}
