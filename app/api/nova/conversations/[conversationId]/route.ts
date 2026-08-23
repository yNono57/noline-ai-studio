import { NextResponse } from "next/server";
import { deleteConversation, setConversationStatus } from "@/lib/chat/conversation-store";
import { authenticate, parseStatusInput, routeErrorResponse } from "../../_shared";

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { conversationId } = await params;
    const conversation = await setConversationStatus(user.id, conversationId, await parseStatusInput(request));
    return NextResponse.json({ conversation });
  } catch (error) { return routeErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { conversationId } = await params;
    await deleteConversation(user.id, conversationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return routeErrorResponse(error); }
}