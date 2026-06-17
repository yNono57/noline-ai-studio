import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ mode: "local", texts: [], visuals: [] });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const texts = await supabaseAdmin(
    `/rest/v1/generations?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=30`,
    { method: "GET" }
  );
  const visuals = await supabaseAdmin(
    `/rest/v1/generated_visuals?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=30`,
    { method: "GET" }
  );

  return NextResponse.json({ texts, visuals });
}
