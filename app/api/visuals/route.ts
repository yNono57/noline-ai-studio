import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ mode: "local" });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const body = await request.json();
  await supabaseAdmin("/rest/v1/generated_visuals", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      title: body.title,
      format: body.format,
      width: body.width,
      height: body.height,
      svg: body.svg
    })
  });

  return NextResponse.json({ ok: true });
}
