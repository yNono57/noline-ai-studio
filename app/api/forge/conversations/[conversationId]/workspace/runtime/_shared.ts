import { NextResponse } from "next/server";
import { githubErrorResponse } from "../../../../github/_shared";
import { ForgeRuntimeError } from "@/lib/forge/runtime-foundation";
export function runtimeErrorResponse(error: unknown) {
  if (error instanceof ForgeRuntimeError) { const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "INVALID_INPUT" ? 422 : error.code === "NOT_FOUND" ? 404 : error.code === "AUTHORIZATION" ? 403 : error.code === "CONFLICT" || error.code === "UNAVAILABLE" ? 409 : 503; return NextResponse.json({ error: error.message }, { status }); }
  return githubErrorResponse(error);
}
export async function runtimeBody(request: Request) {
  try { const body = await request.json() as unknown; if (!body || typeof body !== "object" || Array.isArray(body)) throw new ForgeRuntimeError("INVALID_INPUT", "Corps runtime invalide."); return body as Record<string, unknown>; }
  catch (error) { if (error instanceof ForgeRuntimeError) throw error; throw new ForgeRuntimeError("INVALID_INPUT", "Corps runtime invalide."); }
}
