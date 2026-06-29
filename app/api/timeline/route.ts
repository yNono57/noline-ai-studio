import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, selectFirst, supabaseAdmin } from "@/lib/supabase-server";
import { normalizeTimeline } from "@/lib/crm";

export async function GET(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const prospectId = new URL(request.url).searchParams.get("prospectId") || "";
  const encoded = encodeURIComponent(prospectId);
  const results = await Promise.allSettled([
    supabaseAdmin(`/rest/v1/crm_timeline?user_id=eq.${user.id}&prospect_id=eq.${encoded}&select=*&order=created_at.desc`, { method: "GET" }),
    supabaseAdmin(`/rest/v1/workflows?user_id=eq.${user.id}&client_id=eq.${encoded}&select=id,title,status,created_at&order=created_at.desc`, { method: "GET" }),
    supabaseAdmin(`/rest/v1/generations?user_id=eq.${user.id}&client_id=eq.${encoded}&select=*&order=created_at.desc`, { method: "GET" })
  ]);
  const rows = results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [];
  const workflows = results[1].status === "fulfilled" && Array.isArray(results[1].value) ? results[1].value : [];
  const generations = results[2].status === "fulfilled" && Array.isArray(results[2].value) ? results[2].value : [];
  const timeline = [
    ...rows.map((row) => normalizeTimeline(row as Record<string, unknown>)),
    ...workflows.map((row: Record<string, unknown>) => synthetic(row, prospectId, "workflow", "Workflow lancé")),
    ...generations.map((row: Record<string, unknown>) => synthetic(row, prospectId, "generation", "Génération IA"))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ timeline });
}

function synthetic(row: Record<string, unknown>, prospectId: string, type: "workflow" | "generation", title: string) {
  return {
    id: `${type}-${String(row.id)}`,
    prospectId,
    type,
    title,
    content: String(row.title || row.agent_name || ""),
    createdAt: String(row.created_at || "")
  };
}

export async function POST(request: Request) {
  const user = await auth(request); if (user instanceof NextResponse) return user;
  const body = await request.json();
  const prospectId = String(body.prospectId || "");
  const prospect = await selectFirst(
    `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(prospectId)}&user_id=eq.${user.id}&select=id&limit=1`
  );
  if (!prospect) {
    return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  }
  const data = await supabaseAdmin("/rest/v1/crm_timeline", { method: "POST", body: JSON.stringify({ user_id: user.id, prospect_id: prospectId, type: body.type || "note", title: body.title || "Note", content: body.content || "" }) });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ event: normalizeTimeline(row as Record<string, unknown>) }, { status: 201 });
}

async function auth(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const user = await getUserFromRequest(request);
  return user || NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}
