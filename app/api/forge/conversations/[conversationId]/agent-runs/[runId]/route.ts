import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../_shared";
import { cancelForgeAgentRun, getForgeAgentRunView } from "@/lib/forge/agent-runtime";
import { agentErrorResponse } from "../_shared";

type Context = { params: Promise<{ conversationId: string; runId: string }> };
export async function GET(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId, runId } = await params; const agentRun = await getForgeAgentRunView(user.id, conversationId, runId); return agentRun ? NextResponse.json({ agentRun }) : NextResponse.json({ error: "Run Forge introuvable." }, { status: 404 }); } catch (error) { return agentErrorResponse(error); } }
export async function DELETE(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId, runId } = await params; return NextResponse.json({ run: await cancelForgeAgentRun(user.id, conversationId, runId) }); } catch (error) { return agentErrorResponse(error); } }
