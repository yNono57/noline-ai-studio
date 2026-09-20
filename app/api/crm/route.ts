import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getUserFromRequest,
  isSupabaseServerConfigured,
  selectFirst,
  supabaseAdmin
} from "@/lib/supabase-server";
import { normalizeProspect } from "@/lib/crm";
import { PAID_API_LIMITS, protectPaidApi } from "@/lib/paid-api-security";

export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const rows = await supabaseAdmin(
      `/rest/v1/crm_prospects?user_id=eq.${user.id}&select=*&order=updated_at.desc`,
      { method: "GET" }
    );
    return NextResponse.json({
      prospects: Array.isArray(rows)
        ? rows.map((row) => normalizeProspect(row as Record<string, unknown>))
        : []
    });
  } catch (error) {
    console.error("[crm] list failed", error);
    return NextResponse.json({ error: "Chargement CRM impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "summary") {
      const access = await protectPaidApi(request, "crm-summary", PAID_API_LIMITS.generation);
      if ("response" in access) return access.response;
      return summarizeProspect(user.id, String(body.prospectId || ""));
    }
    if (!String(body.company || "").trim()) {
      return NextResponse.json({ error: "Entreprise requise." }, { status: 400 });
    }

    const data = await supabaseAdmin("/rest/v1/crm_prospects", {
      method: "POST",
      body: JSON.stringify(toDatabasePayload(user.id, body))
    });
    const row = Array.isArray(data) ? data[0] : data;
    await addTimeline(user.id, String((row as Record<string, unknown>).id), "created", "Prospect créé", "");
    return NextResponse.json({ prospect: normalizeProspect(row as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error("[crm] create failed", error);
    return NextResponse.json({ error: "Création impossible." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Prospect requis." }, { status: 400 });

    const before = await selectFirst<Record<string, unknown>>(
      `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=*&limit=1`
    );
    if (!before) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });

    const data = await supabaseAdmin(
      `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...toDatabasePayload(user.id, body),
          updated_at: new Date().toISOString()
        })
      }
    );
    const row = Array.isArray(data) ? data[0] : data;
    const statusChanged = before.status !== (row as Record<string, unknown>).status;
    const quoteSent = (row as Record<string, unknown>).status === "Proposition";
    await addTimeline(
      user.id,
      id,
      quoteSent ? "quote" : statusChanged ? "status" : "updated",
      quoteSent ? "Devis envoyé" : statusChanged ? "Statut modifié" : "Fiche modifiée",
      statusChanged ? `${before.status} → ${(row as Record<string, unknown>).status}` : ""
    );
    return NextResponse.json({ prospect: normalizeProspect(row as Record<string, unknown>) });
  } catch (error) {
    console.error("[crm] update failed", error);
    return NextResponse.json({ error: "Modification impossible." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authenticate(request);
    if (user instanceof NextResponse) return user;
    const id = new URL(request.url).searchParams.get("id") || "";
    const deleted = await supabaseAdmin(
      `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`,
      { method: "DELETE" }
    );
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[crm] delete failed", error);
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}

async function summarizeProspect(userId: string, prospectId: string) {
  const prospect = await selectFirst<Record<string, unknown>>(
    `/rest/v1/crm_prospects?id=eq.${encodeURIComponent(prospectId)}&user_id=eq.${userId}&select=*&limit=1`
  );
  if (!prospect) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  const [timeline, tasks] = await Promise.all([
    supabaseAdmin(`/rest/v1/crm_timeline?user_id=eq.${userId}&prospect_id=eq.${prospectId}&select=*&order=created_at.desc&limit=20`, { method: "GET" }),
    supabaseAdmin(`/rest/v1/crm_tasks?user_id=eq.${userId}&prospect_id=eq.${prospectId}&select=*&order=created_at.desc&limit=20`, { method: "GET" })
  ]);
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ summary: "Résumé démo : consolidez le besoin, vérifiez le budget et planifiez une relance datée." });
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Tu es un consultant commercial. Résume en français : historique, opportunités, risques et prochaine action conseillée. Sois bref et concret." },
      { role: "user", content: JSON.stringify({ prospect, timeline, tasks }).slice(0, 12000) }
    ],
    max_tokens: 500,
    temperature: 0.3
  });
  return NextResponse.json({ summary: completion.choices[0]?.message?.content?.trim() || "Résumé indisponible." });
}

function toDatabasePayload(userId: string, body: Record<string, unknown>) {
  return {
    user_id: userId,
    contact_name: body.contactName || "",
    phone: body.phone || "",
    email: body.email || "",
    company: body.company || "",
    website: body.website || "",
    facebook: body.facebook || "",
    linkedin: body.linkedin || "",
    sector: body.sector || "",
    estimated_revenue: body.estimatedRevenue || null,
    estimated_budget: body.estimatedBudget || null,
    source: body.source || "",
    tags: Array.isArray(body.tags) ? body.tags : [],
    need: body.need || "",
    status: body.status || "Nouveau",
    notes: body.notes || ""
  };
}

async function addTimeline(userId: string, prospectId: string, type: string, title: string, content: string) {
  await supabaseAdmin("/rest/v1/crm_timeline", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, prospect_id: prospectId, type, title, content })
  });
}

async function authenticate(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const user = await getUserFromRequest(request);
  return user || NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}
