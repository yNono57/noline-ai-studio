import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message } from "./conversation-store";
import { getNovaModel } from "./nova-model";
import { buildNovaMessages } from "./nova-safety";

export class NovaGenerationError extends Error {
  constructor(message = "Nova n’a pas pu répondre pour le moment. Réessayez.") { super(message); this.name = "NovaGenerationError"; }
}

export async function generateNovaReply(history: Message[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getNovaModel();
  if (!apiKey || !model) throw new NovaGenerationError("Nova n’est pas configurée.");
  const messages: ChatCompletionMessageParam[] = buildNovaMessages(history);
  debugNovaRequest(model, messages);
  try {
    const completion = await new OpenAI({ apiKey }).chat.completions.create({ model, messages });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new NovaGenerationError("Nova a retourné une réponse vide.");
    return { text, model };
  } catch (error) {
    if (error instanceof NovaGenerationError) throw error;
    logOpenAIError(error, model);
    throw new NovaGenerationError();
  }
}

function debugNovaRequest(model: string, messages: ChatCompletionMessageParam[]) {
  if (process.env.NODE_ENV === "production" || process.env.NOVA_DEBUG_PROMPT !== "1") return;
  console.info("[Nova/Prompt Debug]", { endpoint: "/v1/chat/completions", model, roles: messages.map((message) => message.role), instructions: messages.filter((message) => message.role === "system").map((message) => message.content) });
}

function logOpenAIError(error: unknown, model: string) {
  const apiError = error as { status?: number; code?: string | null; type?: string | null; message?: string };
  const safeMessage = (apiError.message || "Erreur OpenAI inconnue.").replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
  console.error("[Nova/OpenAI]");
  console.error("endpoint: /v1/chat/completions");
  console.error("model:", model);
  console.error("status:", apiError.status ?? "unknown");
  console.error("code:", apiError.code ?? "unknown");
  console.error("type:", apiError.type ?? "unknown");
  console.error("message:", safeMessage);
}