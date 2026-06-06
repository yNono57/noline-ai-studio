import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOfficialAgent } from "@/lib/official-agents";
import type { AgencyClient } from "@/lib/agency";
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
    if (!agent) return NextResponse.json({ error: "Agent inconnu." }, { status: 404 });

    const prompt = buildAgentPrompt(agent.systemPrompt, body.values || {}, body.client || null);
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ output: fallbackAgentOutput(agent.name, body.values, body.client || null), demo: true });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    stage = "openai_chat_completion";
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.75,
      max_tokens: 1400
    });
    const output = completion.choices[0]?.message?.content?.trim();
    if (!output) return NextResponse.json({ error: "Aucun contenu généré." }, { status: 502 });
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

function buildAgentPrompt(systemPrompt: string, values: Record<string, string>, client: AgencyClient | null) {
  const clientContext = client
    ? [
        `Nom: ${client.name}`,
        `Secteur: ${client.sector}`,
        `Slogan: ${client.slogan}`,
        `Couleurs: ${client.primaryColor}, ${client.secondaryColor}`,
        `Site: ${client.website}`,
        `Facebook: ${client.facebook}`,
        `Instagram: ${client.instagram}`,
        `LinkedIn: ${client.linkedin}`,
        `TikTok: ${client.tiktok}`
      ].join("\n")
    : "Aucun client sélectionné.";
  const variables = Object.entries(values)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `${systemPrompt}\n\nContexte client:\n${clientContext}\n\nDemande:\n${variables}\n\nRetourne uniquement le livrable final, prêt à utiliser.`;
}

function fallbackAgentOutput(name: string, values: Record<string, string>, client: AgencyClient | null) {
  const organization = client?.name || "Votre organisation";
  const type = values.contentType || values.publicationType || "contenu";
  return `${name}\n\n${type} pour ${organization}\n\nObjectif\n${values.objective || "Créer un message professionnel, clair et engageant."}\n\nProposition\n${organization} prépare une communication adaptée à son public et à son identité. ${values.additionalContext || "Le message valorise ses activités, son dynamisme et invite naturellement à passer à l’action."}\n\nAppel à l’action\nContactez ${organization}${client?.website ? ` sur ${client.website}` : ""} pour en savoir plus.`;
}
