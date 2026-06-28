import { NextResponse } from "next/server";
import {
  deleteAgent,
  ensureProfile,
  getUserFromRequest,
  isSupabaseServerConfigured,
  listAgents,
  saveAgent
} from "@/lib/supabase-server";

type AgentRequest = {
  id?: string;
  name: string;
  clientType: string;
  mission: string;
  features: string;
  tone: string;
  complexity: string;
  businessGoal: string;
  output: string;
  description?: string;
  targetAudience?: string;
  systemPrompt?: string;
  source?: string;
};

export async function GET(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ agents: [], localOnly: true });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Connectez-vous pour voir vos agents." }, { status: 401 });
    }

    const agents = await listAgents(user.id);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("[agents] Unable to list agents", error);
    return NextResponse.json(
      { error: "Impossible de charger les agents." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ error: "Supabase n'est pas configure." }, { status: 501 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Connectez-vous pour sauvegarder un agent." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AgentRequest;
    const requiredFields: Array<keyof AgentRequest> = [
      "name",
      "clientType",
      "mission",
      "features",
      "tone",
      "complexity",
      "businessGoal",
      "output"
    ];
    const missingField = requiredFields.find((field) => !body[field]?.trim());

    if (missingField) {
      return NextResponse.json({ error: "Tous les champs de l'agent sont requis." }, { status: 400 });
    }

    await ensureProfile(user);
    const agent = await saveAgent({ userId: user.id, ...body });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[agents] Unable to save agent", error);
    return NextResponse.json(
      { error: "Impossible de sauvegarder l'agent." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ error: "Supabase n'est pas configure." }, { status: 501 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Connectez-vous pour supprimer un agent." }, { status: 401 });
    }

    const { id } = (await request.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "Agent introuvable." }, { status: 400 });
    }

    await deleteAgent(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[agents] Unable to delete agent", error);
    return NextResponse.json(
      { error: "Impossible de supprimer l'agent." },
      { status: 500 }
    );
  }
}
