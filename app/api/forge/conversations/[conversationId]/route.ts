import { NextResponse } from "next/server";
import { deleteForgeConversation, setForgeConversationStatus } from "@/lib/forge/forge-store";
import { authenticateForge, forgeErrorResponse, parseForgeStatusInput } from "../../_shared";

type Context = { params: Promise<{ conversationId: string }> };
export async function PATCH(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; return NextResponse.json({ conversation: await setForgeConversationStatus(user.id, conversationId, await parseForgeStatusInput(request)) }); } catch (error) { return forgeErrorResponse(error); } }
export async function DELETE(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; await deleteForgeConversation(user.id, conversationId); return new NextResponse(null, { status: 204 }); } catch (error) { return forgeErrorResponse(error); } }