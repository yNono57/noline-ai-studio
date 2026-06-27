import {
  AGENT_BUILDER_V2_SYSTEM_PROMPT,
  type AgentBuilderV2Task
} from "../prompts";
import type {
  AgentRoadmap,
  AnalyzeIdeaInput,
  BusinessScore,
  GenerateAgentInput,
  GenerateBusinessScoreInput,
  GeneratedAgent,
  GenerateRecommendationsInput,
  GenerateRoadmapInput,
  IdeaAnalysis,
  ProductRecommendation
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

  private run<TResult>(
    task: AgentBuilderV2Task,
    input: object,
    outputContract: string
  ): Promise<TResult> {
    return this.gateway.generate<TResult>({
      systemPrompt: AGENT_BUILDER_V2_SYSTEM_PROMPT,
      task,
      userPrompt: JSON.stringify({
        task,
        input,
        outputContract
      })
    });
  }
}
