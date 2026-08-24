import { NextResponse } from "next/server";
import { authenticateForge } from "../../../../../_shared";
import type { ForgeRuntimeCommand } from "@/lib/forge/runtime-foundation";
import { forgeRuntimeService } from "@/lib/forge/runtime-runtime";
import { runtimeBody, runtimeErrorResponse } from "../_shared";
type Context = { params: Promise<{ conversationId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request); const { conversationId } = await params; const body = await runtimeBody(request);
    const input: Partial<ForgeRuntimeCommand> = {
      command: typeof body.command === "string" ? body.command : undefined,
      args: Array.isArray(body.args) ? body.args as string[] : undefined,
      cwd: typeof body.cwd === "string" ? body.cwd : undefined,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      maxOutputBytes: typeof body.maxOutputBytes === "number" ? body.maxOutputBytes : undefined,
    };
    return NextResponse.json({ result: await forgeRuntimeService.executeCommand(user.id, conversationId, input) });
  } catch (error) { return runtimeErrorResponse(error); }
}
