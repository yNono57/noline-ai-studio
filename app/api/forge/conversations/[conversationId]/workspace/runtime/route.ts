import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../_shared";
import { githubErrorResponse } from "../../../../github/_shared";
import { ForgeRuntimeError, publicRuntime } from "@/lib/forge/runtime-foundation";
import { forgeRuntimeService } from "@/lib/forge/runtime-runtime";

type Context = { params: Promise<{ conversationId: string }> };
function runtimeErrorResponse(error: unknown) {
  if (error instanceof ForgeRuntimeError) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "INVALID_INPUT" ? 422 : error.code === "NOT_FOUND" ? 404 : error.code === "AUTHORIZATION" ? 403 : error.code === "CONFLICT" || error.code === "UNAVAILABLE" ? 409 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return githubErrorResponse(error);
}

export async function GET(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; const runtime = await forgeRuntimeService.get(user.id, conversationId); return NextResponse.json({ runtime: runtime ? publicRuntime(runtime) : null }); }
  catch (error) { return runtimeErrorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; const runtime = await forgeRuntimeService.create(user.id, conversationId); return NextResponse.json({ runtime: publicRuntime(runtime) }, { status: 201 }); }
  catch (error) { return runtimeErrorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await authenticateForge(request); const { conversationId } = await params; const runtime = await forgeRuntimeService.destroy(user.id, conversationId); return runtime ? NextResponse.json({ runtime: publicRuntime(runtime) }) : new NextResponse(null, { status: 204 }); }
  catch (error) { return runtimeErrorResponse(error); }
}
