import { NextResponse } from "next/server";
import {
  createWorkflow,
  getUserFromRequest,
  isSupabaseServerConfigured,
  listWorkflows
} from "@/lib/supabase-server";
import { normalizeWorkflow } from "@/lib/workflows";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof NextResponse) return user;
    const rows = await listWorkflows(user.id);
    const workflows = Array.isArray(rows)
      ? rows.map((row) => normalizeWorkflow(row as Record<string, unknown>))
      : [];
    return NextResponse.json(
      { workflows },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[workflows] Unable to list workflows", error);
    return NextResponse.json({ error: "Chargement des workflows impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof NextResponse) return user;
    const body = (await request.json()) as {
      agentId?: string;
      clientId?: string;
      title?: string;
      steps?: unknown[];
    };
    if (!body.agentId?.trim() || !body.title?.trim()) {
      return NextResponse.json({ error: "Agent et titre requis." }, { status: 400 });
    }
    const workflow = await createWorkflow({
      user_id: user.id,
      agent_id: body.agentId.trim(),
      client_id: body.clientId?.trim() || null,
      title: body.title.trim(),
      status: "draft",
      steps: Array.isArray(body.steps) ? body.steps : []
    });
    return NextResponse.json(
      { workflow: normalizeWorkflow(workflow as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[workflows] Unable to create workflow", error);
    return NextResponse.json({ error: "Création du workflow impossible." }, { status: 500 });
  }
}

async function requireUser(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  }
  const user = await getUserFromRequest(request);
  return user || NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}
