import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { listForgeContinuityArtifacts } from "@/lib/forge/continuity-runtime";
import { agentErrorResponse } from "../agent-runs/_shared";

type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    return NextResponse.json({ artifacts: await listForgeContinuityArtifacts(user.id, conversationId) });
  } catch (error) { return agentErrorResponse(error); }
}
