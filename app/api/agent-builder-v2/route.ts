import { NextResponse } from "next/server";
import {
  AgentBuilderService,
  MockAgentBuilderGateway
} from "@/src/modules/agent-builder/services";
import type {
  AgentRoadmap,
  BusinessScore,
  GeneratedAgent,
  IdeaAnalysis,
  ProductRecommendation
} from "@/src/modules/agent-builder/types";

interface AgentBuilderV2Response {
  analysis: IdeaAnalysis;
  businessScore: BusinessScore;
  agent: GeneratedAgent;
  roadmap: AgentRoadmap;
  recommendations: ProductRecommendation[];
}

const MAX_IDEA_LENGTH = 2_000;

export async function POST(request: Request) {
  try {
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

    const service = new AgentBuilderService(new MockAgentBuilderGateway());
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

    const response: AgentBuilderV2Response = {
      analysis,
      businessScore,
      agent,
      roadmap,
      recommendations
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

function readIdea(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;

  const idea = (body as Record<string, unknown>).idea;
  return typeof idea === "string" && idea.trim() ? idea.trim() : null;
}
