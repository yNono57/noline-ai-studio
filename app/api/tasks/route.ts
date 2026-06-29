import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, selectFirst, supabaseAdmin } from "@/lib/supabase-server";
import { normalizeTask } from "@/lib/crm";

export async function GET(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const prospectId = new URL(request.url).searchParams.get("prospectId");
  const filter = prospectId ? `&prospect_id=eq.${encodeURIComponent(prospectId)}` : "";
  const rows = await supabaseAdmin(`/rest/v1/crm_tasks?user_id=eq.${user.id}${filter}&select=*&order=due_at.asc`, { method: "GET" });
  return NextResponse.json({ tasks: Array.isArray(rows) ? rows.map((row) => normalizeTask(row as Record<string, unknown>)) : [] });
}

export async function POST(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const body = await request.json();
  if (!(await ownsProspect(user.id, String(body.prospectId || "")))) {
    return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  }
  const data = await supabaseAdmin("/rest/v1/crm_tasks", { method: "POST", body: JSON.stringify({ user_id: user.id, prospect_id: body.prospectId, title: body.title, type: body.type, due_at: body.dueAt || null }) });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ task: normalizeTask(row as Record<string, unknown>) }, { status: 201 });
}

async function ownsProspect(userId: string, prospectId: string) {
  return Boolean(await selectFirst(
    `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(prospectId)}&user_id=eq.${userId}&select=id&limit=1`
  ));
}

export async function PATCH(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const body = await request.json();
  const data = await supabaseAdmin(`/rest/v1/crm_tasks?id=eq.${encodeURIComponent(body.id)}&user_id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ completed: Boolean(body.completed) }) });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ task: normalizeTask(row as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const id = new URL(request.url).searchParams.get("id") || "";
  await supabaseAdmin(`/rest/v1/crm_tasks?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`, { method: "DELETE" });
  return NextResponse.json({ success: true });
}

async function auth(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const user = await getUserFromRequest(request);
  return user || NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}
