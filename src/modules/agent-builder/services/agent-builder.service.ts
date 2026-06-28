import {
  AGENT_BUILDER_V2_SYSTEM_PROMPT,
  AGENT_BUILDER_V3_PROMPTS,
  type AgentBuilderV2Task
} from "../prompts";
import type {
  AgentRoadmap,
  AIImplementationPlan,
  AnalyzeIdeaInput,
  BusinessScore,
  DevelopmentPlan,
  GenerateAgentInput,
  GenerateBusinessScoreInput,
  GeneratedAgent,
  GenerateRecommendationsInput,
  GenerateRoadmapInput,
  GenerateExpertStrategiesInput,
  IdeaAnalysis,
  MarketingStrategy,
  PricingStrategy,
  ProductRecommendation
  ,
  UXStrategy
} from "../types";

export interface AgentBuilderRequest {
  systemPrompt: string;
  task: AgentBuilderV2Task;
  userPrompt: string;
}

/**
 * Adapter boundary for the future AI provider.
 *
 * The implementation is responsible for calling the provider, parsing its JSON
 * response and validating it before returning the requested result type.
 */
export interface AgentBuilderGateway {
  generate<TResult>(request: AgentBuilderRequest): Promise<TResult>;
}

export class AgentBuilderService {
  constructor(private readonly gateway: AgentBuilderGateway) {}

  analyzeIdea(input: AnalyzeIdeaInput): Promise<IdeaAnalysis> {
    return this.run<IdeaAnalysis>("analyze_idea", input, "IdeaAnalysis");
  }

  generateBusinessScore(input: GenerateBusinessScoreInput): Promise<BusinessScore> {
    return this.run<BusinessScore>(
      "generate_business_score",
      input,
      "BusinessScore"
    );
  }

  generateAgent(input: GenerateAgentInput): Promise<GeneratedAgent> {
    return this.run<GeneratedAgent>("generate_agent", input, "GeneratedAgent");
  }

  generateRoadmap(input: GenerateRoadmapInput): Promise<AgentRoadmap> {
    return this.run<AgentRoadmap>("generate_roadmap", input, "AgentRoadmap");
  }

  generateRecommendations(
    input: GenerateRecommendationsInput
  ): Promise<ProductRecommendation[]> {
    return this.run<ProductRecommendation[]>(
      "generate_recommendations",
      input,
      "ProductRecommendation[]"
    );
  }

  generateUXStrategy(input: GenerateExpertStrategiesInput): Promise<UXStrategy> {
    return this.run<UXStrategy>("generate_ux_strategy", input, "UXStrategy");
  }

  generatePricingStrategy(
    input: GenerateExpertStrategiesInput
  ): Promise<PricingStrategy> {
    return this.run<PricingStrategy>(
      "generate_pricing_strategy",
      input,
      "PricingStrategy"
    );
  }

  generateMarketingStrategy(
    input: GenerateExpertStrategiesInput
  ): Promise<MarketingStrategy> {
    return this.run<MarketingStrategy>(
      "generate_marketing_strategy",
      input,
      "MarketingStrategy"
    );
  }

  generateDevelopmentPlan(
    input: GenerateExpertStrategiesInput
  ): Promise<DevelopmentPlan> {
    return this.run<DevelopmentPlan>(
      "generate_development_plan",
      input,
      "DevelopmentPlan"
    );
  }

  generateAIImplementationPlan(
    input: GenerateExpertStrategiesInput
  ): Promise<AIImplementationPlan> {
    return this.run<AIImplementationPlan>(
      "generate_ai_implementation_plan",
      input,
      "AIImplementationPlan"
    );
  }

  private run<TResult>(
    task: AgentBuilderV2Task,
    input: object,
    outputContract: string
  ): Promise<TResult> {
    return this.gateway.generate<TResult>({
      systemPrompt:
        AGENT_BUILDER_V3_PROMPTS[task] || AGENT_BUILDER_V2_SYSTEM_PROMPT,
      task,
      userPrompt: JSON.stringify({
        task,
        input,
        outputContract
      })
    });
  }
}
