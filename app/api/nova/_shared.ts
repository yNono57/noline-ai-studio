import { NextResponse } from "next/server";
import {
  ConversationStoreError,
  type ConversationMode,
  type CreateConversationInput,
  type CreateProjectInput
} from "@/lib/chat/conversation-store";
import { getUserFromRequest } from "@/lib/supabase-server";
import { withNovaModel } from "@/lib/chat/nova-model";

class NovaApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "NovaApiError";
  }
}

export async function authenticate(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) throw new NovaApiError(401, "Authentification requise.");
  return user;
}

export async function parseProjectInput(request: Request): Promise<CreateProjectInput> {
  const body = await parseObject(request);
  const name = requiredString(body.name, "name");

  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw invalid("description doit être une chaîne ou null.");
  }

  return { name, description: body.description as string | null | undefined };
}

export async function parseConversationInput(
  request: Request
): Promise<CreateConversationInput> {
  const body = await parseObject(request);
  const mode = body.mode;

  if (mode !== "CHAT" && mode !== "CODE") {
    throw invalid("mode doit être CHAT ou CODE.");
  }

  return withNovaModel({
    title: requiredString(body.title, "title"),
    mode: mode as ConversationMode,
    agent: requiredString(body.agent, "agent")
  });
}

export async function parseNovaMessageInput(request: Request) {
  const body = await parseObject(request);
  if (body.user_message_id !== undefined && typeof body.user_message_id !== "string") {
    throw invalid("user_message_id doit être une chaîne.");
  }
  return {
    content: requiredString(body.content, "content"),
    userMessageId: body.user_message_id?.trim() || null
  };
}

export async function parseStatusInput(request: Request) {
  const body = await parseObject(request);
  if (body.status !== "active" && body.status !== "archived") {
    throw invalid("status doit être active ou archived.");
  }
  return body.status;
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof NovaApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ConversationStoreError) {
    if (error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (error.code === "INVALID_INPUT") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
  }

  console.error("[nova-api] Request failed", error);
  return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
}

async function parseObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw invalid("Le corps JSON doit être un objet.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NovaApiError) throw error;
    throw invalid("Corps JSON invalide.");
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw invalid(`${field} ne peut pas être vide.`);
  }
  return value.trim();
}

function invalid(message: string) {
  return new NovaApiError(400, message);
}
