import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/chat/conversation-store";
import {
  authenticate,
  parseProjectInput,
  routeErrorResponse
} from "../_shared";

export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    const projects = await listProjects(user);
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(request);
    const input = await parseProjectInput(request);
    const project = await createProject(user, input);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
