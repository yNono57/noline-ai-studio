import { NextResponse } from "next/server";
import { deleteForgeConversation, setForgeConversationStatus, setForgeConversationTitle } from "@/lib/forge/forge-store";
import { authenticateForge, forgeErrorResponse } from "../../_shared";

type Context = { params: Promise<{ conversationId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    let body: { title?: unknown; status?: unknown };
    try { body = await request.json() as { title?: unknown; status?: unknown }; }
    catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
    if (body.title !== undefined) return NextResponse.json({ conversation: await setForgeConversationTitle(user.id, conversationId, body.title) });
    if (body.status === "active" || body.status === "archived") return NextResponse.json({ conversation: await setForgeConversationStatus(user.id, conversationId, body.status) });
    return NextResponse.json({ error: "Modification de session invalide." }, { status: 422 });
  } catch (error) { return forgeErrorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; await deleteForgeConversation(user.id, conversationId); return new NextResponse(null, { status: 204 }); } catch (error) { return forgeErrorResponse(error); } }