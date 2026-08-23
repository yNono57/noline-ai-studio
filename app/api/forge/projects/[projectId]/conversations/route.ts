import { NextResponse } from "next/server";
import { createForgeConversation, listForgeConversations } from "@/lib/forge/forge-store";
import { getForgeModel } from "@/lib/forge/forge-openai";
import { authenticateForge, forgeErrorResponse, parseForgeConversationInput } from "../../../_shared";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { projectId } = await params;
    return NextResponse.json({ conversations: await listForgeConversations(user.id, projectId) });
  } catch (error) { return forgeErrorResponse(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { projectId } = await params;
    const input = await parseForgeConversationInput(request);
    const conversation = await createForgeConversation(user.id, projectId, { ...input, modelKey: getForgeModel() });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) { return forgeErrorResponse(error); }
}
