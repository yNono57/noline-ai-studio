import { NextResponse } from "next/server";
import { deleteForgeProject, setForgeProjectStatus } from "@/lib/forge/forge-store";
import { authenticateForge, forgeErrorResponse, parseForgeStatusInput } from "../../_shared";

type Context = { params: Promise<{ projectId: string }> };
export async function PATCH(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { projectId } = await params; return NextResponse.json({ project: await setForgeProjectStatus(user.id, projectId, await parseForgeStatusInput(request)) }); } catch (error) { return forgeErrorResponse(error); } }
export async function DELETE(request: Request, { params }: Context) { try { const user = await authenticateForge(request); const { projectId } = await params; await deleteForgeProject(user.id, projectId); return new NextResponse(null, { status: 204 }); } catch (error) { return forgeErrorResponse(error); } }