import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { AgencyClient } from "@/lib/agency";
import { buildOfficialAgentPrompt, isSupporterOrganization } from "@/lib/agent-prompts";
import { getOfficialAgent } from "@/lib/official-agents";
import { logGenerationError } from "@/lib/server-diagnostics";

type RequestBody = {
  agentId: string;
  values: Record<string, string>;
  client?: AgencyClient | null;
};

export async function POST(request: Request) {
  let stage = "parse_request";
  let agentId: string | null = null;

  try {
    const body = (await request.json()) as RequestBody;
    agentId = body.agentId;
    const agent = getOfficialAgent(body.agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent inconnu." }, { status: 404 });
    }

    const prompt = buildOfficialAgentPrompt({
      agent,
      values: body.values || {},
      client: body.client || null
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        output: fallbackAgentOutput(agent.id, agent.name, body.values || {}, body.client || null),
        demo: true
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    stage = "openai_chat_completion";
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1800
    });

    const output = completion.choices[0]?.message?.content?.trim();
    if (!output) {
      return NextResponse.json({ error: "Aucun contenu généré." }, { status: 502 });
    }
    return NextResponse.json({ output });
  } catch (error) {
    logGenerationError({
      route: "/api/generate-agent",
      stage,
      error,
      context: { agentId }
    });

    return NextResponse.json({ error: "Impossible de lancer cet agent." }, { status: 500 });
  }
}

function fallbackAgentOutput(
  agentId: string,
  name: string,
  values: Record<string, string>,
  client: AgencyClient | null
) {
  if (agentId === "matchday-pro") {
    const supporterOrganization = isSupporterOrganization(client);
    const club =
      values.club?.trim() ||
      client?.relatedStructure?.trim() ||
      (!supporterOrganization ? client?.name?.trim() : "") ||
      "Le club";
    const opponent = values.opponent?.trim() || "son prochain adversaire";
    const supporterCall =
      supporterOrganization && client
        ? `, et ${client.name} appelle tous les supporters à venir pousser l'équipe`
        : "";

    return `${name}\n\n${club} affronte ${opponent}${supporterCall}.\n\nAjoutez OPENAI_API_KEY pour générer les déclinaisons complètes Facebook, Instagram, Story, WhatsApp et site web.`;
  }

  const organization = client?.name || values.company || values.clientName || "Votre organisation";
  const type = values.contentType || "contenu";
  return `${name}\n\n${type} pour ${organization}\n\nObjectif\n${values.objective || "Créer un message professionnel, clair et engageant."}\n\nProposition\n${organization} prépare une communication adaptée à son public et à son identité.\n\nAjoutez OPENAI_API_KEY pour produire le livrable complet.`;
}
