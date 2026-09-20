import { NextResponse } from "next/server";
import {
  AgentBuilderService,
  MockAgentBuilderGateway,
  OpenAIAgentBuilderGateway
} from "@/src/modules/agent-builder/services";
import { PAID_API_LIMITS, protectPaidApi } from "@/lib/paid-api-security";
import type {
  AgentRoadmap,
  AIImplementationPlan,
  BrandingPack,
  BusinessScore,
  CompetitorAnalysis,
  DevelopmentPlan,
  ExecutiveSummary,
  FinancialForecast,
  GeneratedAgent,
  IdeaAnalysis,
  LegalCompliance,
  MarketingStrategy,
  PricingStrategy,
  ProductBacklog,
  ProductRecommendation,
  PromptPack,
  SalesPack,
  SEOStrategy,
  TechnicalDiagrams,
  UXStrategy
} from "@/src/modules/agent-builder/types";

interface AgentBuilderV2Response {
  analysis: IdeaAnalysis;
  businessScore: BusinessScore;
  agent: GeneratedAgent;
  roadmap: AgentRoadmap;
  recommendations: ProductRecommendation[];
  uxStrategy: UXStrategy;
  pricingStrategy: PricingStrategy;
  marketingStrategy: MarketingStrategy;
  developmentPlan: DevelopmentPlan;
  aiImplementationPlan: AIImplementationPlan;
  executiveSummary: ExecutiveSummary;
  financialForecast: FinancialForecast;
  competitorAnalysis: CompetitorAnalysis;
  legalCompliance: LegalCompliance;
  salesPack: SalesPack;
  brandingPack: BrandingPack;
  seoStrategy: SEOStrategy;
  productBacklog: ProductBacklog;
  technicalDiagrams: TechnicalDiagrams;
  promptPack: PromptPack;
}

const MAX_IDEA_LENGTH = 2_000;

export async function POST(request: Request) {
  try {
    const access = await protectPaidApi(request, "agent-builder-v2", PAID_API_LIMITS.agentBuilder);
    if ("response" in access) return access.response;

    const body: unknown = await request.json();
    const idea = readIdea(body);

    if (!idea) {
      return NextResponse.json(
        { error: "Le champ « idea » est requis et doit être une chaîne non vide." },
        { status: 400 }
      );
    }

    if (idea.length > MAX_IDEA_LENGTH) {
      return NextResponse.json(
        { error: `Le champ « idea » ne doit pas dépasser ${MAX_IDEA_LENGTH} caractères.` },
        { status: 400 }
      );
    }

    const service = new AgentBuilderService(createGateway());
    const analysis = await service.analyzeIdea({ idea });
    const businessScore = await service.generateBusinessScore({ analysis });
    const agent = await service.generateAgent({ analysis, businessScore });
    const roadmap = await service.generateRoadmap({ analysis, agent });
    const recommendations = await service.generateRecommendations({
      analysis,
      businessScore,
      agent,
      roadmap
    });
    const expertInput = {
      analysis,
      businessScore,
      agent,
      roadmap,
      recommendations
    };
    const [
      uxStrategy,
      pricingStrategy,
      marketingStrategy,
      developmentPlan,
      aiImplementationPlan
    ] = await Promise.all([
      service.generateUXStrategy(expertInput),
      service.generatePricingStrategy(expertInput),
      service.generateMarketingStrategy(expertInput),
      service.generateDevelopmentPlan(expertInput),
      service.generateAIImplementationPlan(expertInput)
    ]);
    const deliverablesInput = {
      ...expertInput,
      uxStrategy,
      pricingStrategy,
      marketingStrategy,
      developmentPlan,
      aiImplementationPlan
    };
    const [
      executiveSummary,
      financialForecast,
      competitorAnalysis,
      legalCompliance,
      salesPack,
      brandingPack,
      seoStrategy,
      productBacklog,
      technicalDiagrams,
      promptPack
    ] = await Promise.all([
      service.generateExecutiveSummary(deliverablesInput),
      service.generateFinancialForecast(deliverablesInput),
      service.generateCompetitorAnalysis(deliverablesInput),
      service.generateLegalCompliance(deliverablesInput),
      service.generateSalesPack(deliverablesInput),
      service.generateBrandingPack(deliverablesInput),
      service.generateSEOStrategy(deliverablesInput),
      service.generateProductBacklog(deliverablesInput),
      service.generateTechnicalDiagrams(deliverablesInput),
      service.generatePromptPack(deliverablesInput)
    ]);

    const response: AgentBuilderV2Response = {
      analysis,
      businessScore,
      agent,
      roadmap,
      recommendations,
      uxStrategy,
      pricingStrategy,
      marketingStrategy,
      developmentPlan,
      aiImplementationPlan,
      executiveSummary,
      financialForecast,
      competitorAnalysis,
      legalCompliance,
      salesPack,
      brandingPack,
      seoStrategy,
      productBacklog,
      technicalDiagrams,
      promptPack
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[agent-builder-v2] Generation failed", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Le corps de la requête doit être un JSON valide." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Impossible de générer l'Agent Builder V2 pour le moment." },
      { status: 500 }
    );
  }
}

function createGateway() {
  const apiKey = process.env.OPENAI_API_KEY;
  const useMock = process.env.USE_MOCK?.toLowerCase() === "true";

  if (!apiKey || useMock) {
    return new MockAgentBuilderGateway();
  }

  return new OpenAIAgentBuilderGateway(
    apiKey,
    process.env.OPENAI_MODEL || "gpt-4.1-mini"
  );
}

function readIdea(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;

  const idea = (body as Record<string, unknown>).idea;
  return typeof idea === "string" && idea.trim() ? idea.trim() : null;
}
