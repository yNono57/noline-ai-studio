import { NextResponse } from "next/server";
import { createForgeProject, listForgeProjects } from "@/lib/forge/forge-store";
import { getForgeModel } from "@/lib/forge/forge-openai";
import { authenticateForge, forgeErrorResponse, parseForgeProjectInput } from "../_shared";

export async function GET(request: Request) {
  try {
    const user = await authenticateForge(request);
    return NextResponse.json({ projects: await listForgeProjects(user.id), model: getForgeModel() });
  } catch (error) { return forgeErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateForge(request);
    const project = await createForgeProject(user.id, await parseForgeProjectInput(request));
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) { return forgeErrorResponse(error); }
}
