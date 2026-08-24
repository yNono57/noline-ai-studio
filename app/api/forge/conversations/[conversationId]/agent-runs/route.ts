import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { forgeAgentRunner, getForgeAgentRunView } from "@/lib/forge/agent-runtime";
import { createForgeMessage, ensureForgeConversationTitle } from "@/lib/forge/forge-store";
import { runForgeAgentConversation } from "@/lib/forge/agent-conversation";
import { ForgeAgentError, normalizeAgentObjective, publicAgentRun } from "@/lib/forge/agent-foundation";
import { agentErrorResponse } from "./_shared";

export const maxDuration = 300;
type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; return NextResponse.json({ agentRun: await getForgeAgentRunView(user.id, conversationId) }); }
  catch (error) { return agentErrorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; let body: { objective?: unknown }; try { body = await request.json() as { objective?: unknown }; } catch { throw new ForgeAgentError("INVALID_INPUT", "Corps JSON invalide."); } const objective = normalizeAgentObjective(body.objective); const conversation = await ensureForgeConversationTitle(user.id, conversationId, objective); const result = await runForgeAgentConversation({ objective }, { createMessage: (message) => createForgeMessage(user.id, conversationId, message), runAgent: () => forgeAgentRunner.run(user.id, conversationId, objective) }); return NextResponse.json({ run: publicAgentRun(result.run), agentRun: await getForgeAgentRunView(user.id, conversationId, result.run.runId), conversation, user_message: result.userMessage, assistant_message: result.assistantMessage }, { status: 201 }); }
  catch (error) { return agentErrorResponse(error); }
}
