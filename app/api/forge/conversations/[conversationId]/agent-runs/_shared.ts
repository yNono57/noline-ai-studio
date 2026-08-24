import { NextResponse } from "next/server";
import { ForgeAgentError } from "@/lib/forge/agent-foundation";
import { forgeErrorResponse } from "../../../_shared";

export function agentErrorResponse(error: unknown) {
  if (error instanceof ForgeAgentError) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "INVALID_INPUT" ? 422 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" || error.code === "CANCELLED" || error.code === "LIMIT" ? 409 : error.code === "MODEL" ? 502 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return forgeErrorResponse(error);
}
