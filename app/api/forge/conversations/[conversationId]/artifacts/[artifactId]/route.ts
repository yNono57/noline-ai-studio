import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../_shared";
import { ForgeAgentError } from "@/lib/forge/agent-foundation";
import { forgeContinuityService } from "@/lib/forge/continuity-runtime";
import { agentErrorResponse } from "../../agent-runs/_shared";

type Context = { params: Promise<{ conversationId: string; artifactId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId, artifactId } = await params;
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { throw new ForgeAgentError("INVALID_INPUT", "Corps JSON invalide."); }
    const action = body.action;
    const artifact = action === "restore" ? await forgeContinuityService.restore(user.id, conversationId, artifactId, body.allow_base_mismatch === true)
      : action === "branch" ? await forgeContinuityService.createBranch(user.id, conversationId, artifactId, body.branch)
      : action === "commit" ? await forgeContinuityService.commit(user.id, conversationId, artifactId, body.message, body.confirmed)
      : action === "push" ? await forgeContinuityService.push(user.id, conversationId, artifactId, body.confirmed)
      : action === "pull_request" ? await forgeContinuityService.createPullRequest(user.id, conversationId, artifactId, body.title, body.confirmed)
      : (() => { throw new ForgeAgentError("INVALID_INPUT", "Action de continuité inconnue."); })();
    return NextResponse.json({ artifact });
  } catch (error) { return agentErrorResponse(error); }
}
