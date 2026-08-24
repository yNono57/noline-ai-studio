import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { forgeAgentRunner, getForgeAgentRunView } from "@/lib/forge/agent-runtime";
import { ForgeAgentError, normalizeAgentObjective, publicAgentRun } from "@/lib/forge/agent-foundation";
import { agentErrorResponse } from "./_shared";

export const maxDuration = 300;
type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; return NextResponse.json({ agentRun: await getForgeAgentRunView(user.id, conversationId) }); }
  catch (error) { return agentErrorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; let body: { objective?: unknown }; try { body = await request.json() as { objective?: unknown }; } catch { throw new ForgeAgentError("INVALID_INPUT", "Corps JSON invalide."); } const run = await forgeAgentRunner.run(user.id, conversationId, normalizeAgentObjective(body.objective)); return NextResponse.json({ run: publicAgentRun(run), agentRun: await getForgeAgentRunView(user.id, conversationId, run.runId) }, { status: 201 }); }
  catch (error) { return agentErrorResponse(error); }
}
