import { NextResponse } from "next/server";
import {
  deleteWorkflow,
  getUserFromRequest,
  getWorkflow,
  isSupabaseServerConfigured
} from "@/lib/supabase-server";
import { normalizeWorkflow } from "@/lib/workflows";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    const row = await getWorkflow(user.id, id);
    if (!row) return NextResponse.json({ error: "Workflow introuvable." }, { status: 404 });
    return NextResponse.json({ workflow: normalizeWorkflow(row) });
  } catch (error) {
    console.error("[workflows/:id] Unable to load workflow", error);
    return NextResponse.json({ error: "Chargement impossible." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    const deleted = await deleteWorkflow(user.id, id);
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json({ error: "Workflow introuvable ou non autorisé." }, { status: 404 });
    }
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[workflows/:id] Unable to delete workflow", error);
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}

async function authenticate(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  }
  const user = await getUserFromRequest(request);
  return user || NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}
