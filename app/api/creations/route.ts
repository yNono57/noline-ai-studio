import { NextResponse } from "next/server";
import {
  getUserFromRequest,
  isSupabaseServerConfigured,
  listGenerations,
  supabaseAdmin
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ mode: "local", texts: [], visuals: [] });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const texts = await listGenerations(user.id, 30);
  let visuals: unknown = [];

  try {
    visuals = await supabaseAdmin(
      `/rest/v1/generated_visuals?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=30`,
      { method: "GET" }
    );
  } catch (error) {
    if (!isMissingGeneratedVisualsTable(error)) {
      console.error("[api/creations] Unable to load generated visuals", error);
    }
  }

  return NextResponse.json(
    { texts, visuals },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function isMissingGeneratedVisualsTable(error: unknown) {
  return (
    error instanceof Error &&
    /PGRST205|generated_visuals.*(not find|not found|schema cache)/i.test(
      error.message
    )
  );
}
