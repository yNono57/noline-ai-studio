import { NextResponse } from "next/server";
import { ForgeStoreError } from "@/lib/forge/forge-store";
import { getUserFromRequest } from "@/lib/supabase-server";

class ForgeApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ForgeApiError";
  }
}

export async function authenticateForge(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) throw new ForgeApiError(401, "Authentification requise.");
  return user;
}

export async function parseForgeProjectInput(request: Request) {
  const body = await parseObject(request);
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw invalid("description doit être une chaîne ou null.");
  }
  return { name: requiredString(body.name, "name"), description: body.description as string | null | undefined };
}

export async function parseForgeConversationInput(request: Request) {
  const body = await parseObject(request);
  return { title: requiredString(body.title, "title") };
}

export async function parseForgeMessageInput(request: Request) {
  const body = await parseObject(request);
  if (body.user_message_id !== undefined && typeof body.user_message_id !== "string") {
    throw invalid("user_message_id doit être une chaîne.");
  }
  return { content: requiredString(body.content, "content"), userMessageId: body.user_message_id?.trim() || null };
}

export async function parseForgeStatusInput(request: Request) {
  const body = await parseObject(request);
  if (body.status !== "active" && body.status !== "archived") throw invalid("status doit être active ou archived.");
  return body.status;
}

export function forgeErrorResponse(error: unknown) {
  if (error instanceof ForgeApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ForgeStoreError) {
    if (error.code === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (error.code === "INVALID_INPUT") return NextResponse.json({ error: error.message }, { status: 400 });
    if (error.code === "NOT_FOUND") return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error("[forge-api] Request failed", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
}

async function parseObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("Le corps JSON doit être un objet.");
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ForgeApiError) throw error;
    throw invalid("Corps JSON invalide.");
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${field} ne peut pas être vide.`);
  return value.trim();
}

function invalid(message: string) { return new ForgeApiError(400, message); }
