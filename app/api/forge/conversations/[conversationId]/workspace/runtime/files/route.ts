import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../../_shared";
import { forgeRuntimeService } from "@/lib/forge/runtime-runtime";
import { runtimeErrorResponse } from "../_shared";
type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; const path = new URL(request.url).searchParams.get("path") || "."; return NextResponse.json({ files: await forgeRuntimeService.listFiles(user.id, conversationId, path) }); } catch (error) { return runtimeErrorResponse(error); } }
