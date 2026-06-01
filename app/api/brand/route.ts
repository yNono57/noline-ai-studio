import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, selectFirst, supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ brand: null, mode: "local" });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const brand = await selectFirst(
    `/rest/v1/client_brands?user_id=eq.${user.id}&select=*&limit=1`
  );
  return NextResponse.json({ brand });
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ mode: "local" });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const body = await request.json();
  const data = await supabaseAdmin("/rest/v1/client_brands?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      structure_name: body.structureName,
      logo: body.logo,
      primary_color: body.primaryColor,
      secondary_color: body.secondaryColor,
      typography: body.typography,
      socials: body.socials,
      email: body.email,
      website: body.website,
      updated_at: new Date().toISOString()
    })
  });

  return NextResponse.json({ brand: Array.isArray(data) ? data[0] : data });
}
