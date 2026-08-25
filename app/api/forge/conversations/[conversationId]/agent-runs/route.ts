import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { forgeAgentRunner, getForgeAgentRunView, listForgeAgentRunViews } from "@/lib/forge/agent-runtime";
import { createForgeMessage, ensureForgeConversationTitle, updateForgeMessageMetadata } from "@/lib/forge/forge-store";
import { runForgeAgentConversation } from "@/lib/forge/agent-conversation";
import { ForgeAgentError, normalizeAgentObjective, publicAgentRun } from "@/lib/forge/agent-foundation";
import { agentErrorResponse } from "./_shared";

export const maxDuration = 300;
type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; const agentRuns = await listForgeAgentRunViews(user.id, conversationId); return NextResponse.json({ agentRun: agentRuns.at(-1) || null, agentRuns }); }
  catch (error) { return agentErrorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; let body: { objective?: unknown; submission_id?: unknown }; try { body = await request.json() as { objective?: unknown; submission_id?: unknown }; } catch { throw new ForgeAgentError("INVALID_INPUT", "Corps JSON invalide."); } const objective = normalizeAgentObjective(body.objective); if (typeof body.submission_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submission_id)) throw new ForgeAgentError("INVALID_INPUT", "Identifiant de soumission invalide."); const submissionId = body.submission_id; const conversation = await ensureForgeConversationTitle(user.id, conversationId, objective); const result = await runForgeAgentConversation({ objective, submissionId }, { createMessage: (message) => createForgeMessage(user.id, conversationId, message), updateMessageMetadata: (messageId, metadata) => updateForgeMessageMetadata(user.id, conversationId, messageId, metadata), runAgent: () => forgeAgentRunner.run(user.id, conversationId, objective) }); return NextResponse.json({ run: publicAgentRun(result.run), agentRun: await getForgeAgentRunView(user.id, conversationId, result.run.runId), conversation, user_message: result.userMessage, assistant_message: result.assistantMessage }, { status: 201 }); }
  catch (error) { return agentErrorResponse(error); }
}
