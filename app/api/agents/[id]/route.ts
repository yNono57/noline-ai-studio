import { NextResponse } from "next/server";
import {
  getAgent,
  getUserFromRequest,
  isSupabaseServerConfigured
} from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ agent: null, localOnly: true });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Connectez-vous pour voir cet agent." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const agent = await getAgent(user.id, id);

    if (!agent) {
      return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[agents/:id] Unable to load agent", error);
    return NextResponse.json(
      { error: "Impossible de charger cet agent." },
      { status: 500 }
    );
  }
}
