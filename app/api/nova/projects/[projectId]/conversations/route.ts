import { NextResponse } from "next/server";
import {
  createConversation,
  listConversations
} from "@/lib/chat/conversation-store";
import {
  authenticate,
  parseConversationInput,
  routeErrorResponse
} from "../../../_shared";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { projectId } = await params;
    const conversations = await listConversations(user.id, projectId);
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { projectId } = await params;
    const input = await parseConversationInput(request);
    const conversation = await createConversation(user.id, projectId, input);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
