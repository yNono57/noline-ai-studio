import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../../_shared";
import { ForgeRuntimeError } from "@/lib/forge/runtime-foundation";
import { forgeRuntimeService } from "@/lib/forge/runtime-runtime";
import { runtimeBody, runtimeErrorResponse } from "../_shared";
type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; const path = new URL(request.url).searchParams.get("path") || ""; return NextResponse.json({ file: await forgeRuntimeService.readFile(user.id, conversationId, path) }); } catch (error) { return runtimeErrorResponse(error); } }
export async function PUT(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; const body = await runtimeBody(request); if (typeof body.path !== "string" || typeof body.content !== "string") throw new ForgeRuntimeError("INVALID_INPUT", "Fichier runtime invalide."); return NextResponse.json({ file: await forgeRuntimeService.writeFile(user.id, conversationId, body.path, body.content) }); } catch (error) { return runtimeErrorResponse(error); } }
export async function DELETE(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { conversationId } = await params; const path = new URL(request.url).searchParams.get("path") || ""; await forgeRuntimeService.deleteFile(user.id, conversationId, path); return new NextResponse(null, { status: 204 }); } catch (error) { return runtimeErrorResponse(error); } }
