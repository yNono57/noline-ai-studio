import { NextResponse } from "next/server";
import { deleteProject, setProjectStatus } from "@/lib/chat/conversation-store";
import { authenticate, parseStatusInput, routeErrorResponse } from "../../_shared";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { projectId } = await params;
    const project = await setProjectStatus(user.id, projectId, await parseStatusInput(request));
    return NextResponse.json({ project });
  } catch (error) { return routeErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await authenticate(request);
    const { projectId } = await params;
    await deleteProject(user.id, projectId);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return routeErrorResponse(error); }
}