import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getAgent,
  getUserFromRequest,
  isSupabaseServerConfigured,
  saveAgentGeneration
} from "@/lib/supabase-server";
import { getOfficialAgent } from "@/lib/official-agents";
import { logGenerationError } from "@/lib/server-diagnostics";

interface RunAgentBody {
  input?: unknown;
  localAgent?: {
    name?: unknown;
    systemPrompt?: unknown;
  };
}

const MAX_INPUT_LENGTH = 10_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let stage = "parse_request";
  let agentId = "";
  let userId: string | null = null;

  try {
    const { id } = await params;
    agentId = id;
    const body = (await request.json()) as RunAgentBody;
    const input = typeof body.input === "string" ? body.input.trim() : "";

    if (!input) {
      return NextResponse.json(
        { error: "Décris ta demande avant de lancer l’agent." },
        { status: 400 }
      );
    }
    if (input.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `La demande ne doit pas dépasser ${MAX_INPUT_LENGTH} caractères.` },
        { status: 400 }
      );
    }

    const officialAgent = getOfficialAgent(id);
    let agentName = officialAgent?.name || "";
    let systemPrompt = officialAgent?.systemPrompt || "";

    if (isSupabaseServerConfigured()) {
      stage = "authenticate_user";
      const user = await getUserFromRequest(request);
      userId = user?.id || null;

      if (!officialAgent) {
        if (!user) {
          return NextResponse.json(
            { error: "Connecte-toi pour utiliser cet agent." },
            { status: 401 }
          );
        }

        stage = "load_agent";
        const customAgent = await getAgent(user.id, id);
        if (!customAgent) {
          return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });
        }

        agentName = readText(customAgent.name) || "Agent personnalisé";
        systemPrompt =
          readText(customAgent.system_prompt) || readText(customAgent.output);
      }
    } else if (!officialAgent) {
      agentName = readUnknownText(body.localAgent?.name) || "Agent personnalisé";
      systemPrompt = readUnknownText(body.localAgent?.systemPrompt);
    }

    if (!systemPrompt) {
      return NextResponse.json(
        { error: "Cet agent ne possède aucun prompt système utilisable." },
        { status: 422 }
      );
    }

    let output: string;
    let demo = false;

    if (!process.env.OPENAI_API_KEY) {
      demo = true;
      output = buildDemoOutput(agentName, input);
    } else {
      stage = "openai_chat_completion";
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ],
        temperature: 0.7,
        max_tokens: 1800
      });

      output = completion.choices[0]?.message?.content?.trim() || "";
      if (!output) {
        return NextResponse.json({ error: "Aucune réponse générée." }, { status: 502 });
      }
    }

    let historySaved = false;
    if (userId) {
      try {
        stage = "save_history";
        await saveAgentGeneration({
          userId,
          agentId,
          agentName,
          userPrompt: input,
          output
        });
        historySaved = true;
      } catch (historyError) {
        logGenerationError({
          route: "/api/agents/[id]/run",
          stage: "save_history",
          error: historyError,
          context: { agentId, userId }
        });
      }
    }

    return NextResponse.json({ output, demo, historySaved });
  } catch (error) {
    logGenerationError({
      route: "/api/agents/[id]/run",
      stage,
      error,
      context: { agentId, userId }
    });
    return NextResponse.json(
      { error: "Impossible d’exécuter cet agent pour le moment." },
      { status: 500 }
    );
  }
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readUnknownText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildDemoOutput(agentName: string, input: string) {
  return `${agentName} — mode démonstration

Demande reçue :
${input}

L’agent est correctement configuré. Ajoute OPENAI_API_KEY pour obtenir sa réponse complète.`;
}
