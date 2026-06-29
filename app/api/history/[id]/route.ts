import { NextResponse } from "next/server";
import {
  deleteGeneration,
  getUserFromRequest,
  isSupabaseServerConfigured
} from "@/lib/supabase-server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const deleted = await deleteGeneration(user.id, id);
    const deletedCount = Array.isArray(deleted) ? deleted.length : 0;

    if (deletedCount === 0) {
      return NextResponse.json(
        { error: "Génération introuvable ou non autorisée." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id, deletedCount });
  } catch (error) {
    console.error("[history/:id] Unable to delete Supabase generation", error);
    return NextResponse.json(
      { error: "Impossible de supprimer cette génération." },
      { status: 500 }
    );
  }
}
