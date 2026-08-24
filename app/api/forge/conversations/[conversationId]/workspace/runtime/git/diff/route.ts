import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../../../_shared";
import { forgeRuntimeService } from "@/lib/forge/runtime-runtime";
import { runtimeErrorResponse } from "../../_shared";
type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; const raw = new URL(request.url).searchParams.get("limit"); const limit = raw ? Number(raw) : undefined; return NextResponse.json({ diff: await forgeRuntimeService.getGitDiff(user.id, conversationId, limit) }); } catch (error) { return runtimeErrorResponse(error); } }
