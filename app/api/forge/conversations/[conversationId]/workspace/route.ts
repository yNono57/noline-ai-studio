import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { githubErrorResponse } from "../../../github/_shared";
import { ForgeWorkspaceError, publicWorkspace } from "@/lib/forge/workspace-foundation";
import { forgeWorkspaceService } from "@/lib/forge/workspace-runtime";

type Context = { params: Promise<{ conversationId: string }> };

function workspaceErrorResponse(error: unknown) {
  if (error instanceof ForgeWorkspaceError) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "INVALID_INPUT" ? 400 : error.code === "NOT_FOUND" ? 404 : error.code === "AUTHORIZATION" ? 403 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return githubErrorResponse(error);
}

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    const workspace = await forgeWorkspaceService.get(user.id, conversationId);
    return NextResponse.json({ workspace: workspace ? publicWorkspace(workspace) : null });
  } catch (error) { return workspaceErrorResponse(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    const workspace = await forgeWorkspaceService.prepare(user.id, conversationId);
    return NextResponse.json({ workspace: publicWorkspace(workspace) }, { status: 201 });
  } catch (error) { return workspaceErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { conversationId } = await params;
    const workspace = await forgeWorkspaceService.destroy(user.id, conversationId);
    return workspace ? NextResponse.json({ workspace: publicWorkspace(workspace) }) : new NextResponse(null, { status: 204 });
  } catch (error) { return workspaceErrorResponse(error); }
}
