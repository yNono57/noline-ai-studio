import { NextResponse } from "next/server";
import { normalizeGenerationRecord } from "@/lib/history";
import {
  deleteGenerations,
  getUserFromRequest,
  isSupabaseServerConfigured,
  listGenerations
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        { mode: "local", records: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Connecte-toi pour consulter ton historique." },
        { status: 401 }
      );
    }

    const rows = await listGenerations(user.id);
    const records = Array.isArray(rows)
      ? rows.map((row) =>
          normalizeGenerationRecord(row as Record<string, unknown>)
        )
      : [];

    return NextResponse.json(
      { records },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[history] Unable to list Supabase generations", error);
    return NextResponse.json(
      { error: "Impossible de charger l’historique." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        { error: "Supabase n’est pas configuré." },
        { status: 503 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    }

    const deleted = await deleteGenerations(user.id);
    return NextResponse.json({
      success: true,
      deletedCount: Array.isArray(deleted) ? deleted.length : 0
    });
  } catch (error) {
    console.error("[history] Unable to delete Supabase generations", error);
    return NextResponse.json(
      { error: "Impossible de supprimer l’historique." },
      { status: 500 }
    );
  }
}
