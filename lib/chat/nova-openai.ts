import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message } from "./conversation-store";

export const NOVA_SYSTEM_PROMPT =
  "Tu es NØLINE Nova, l'assistant conversationnel généraliste de NØLINE AI. Tu aides l'utilisateur de manière claire, précise et utile. Tu tiens compte du contexte de la conversation et réponds dans la langue utilisée par l'utilisateur.";

export class NovaGenerationError extends Error {
  constructor(message = "Nova n’a pas pu répondre pour le moment. Réessayez.") {
    super(message);
    this.name = "NovaGenerationError";
  }
}

export async function generateNovaReply(history: Message[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new NovaGenerationError("Nova n’est pas configurée.");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: NOVA_SYSTEM_PROMPT },
    ...history
      .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .slice(-40)
      .map((message): ChatCompletionMessageParam => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.content
      }))
  ];

  try {
    const completion = await new OpenAI({ apiKey }).chat.completions.create({
      model,
      messages
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new NovaGenerationError("Nova a retourné une réponse vide.");
    return { text, model };
  } catch (error) {
    if (error instanceof NovaGenerationError) throw error;
    logOpenAIError(error, model);
    throw new NovaGenerationError();
  }
}

function logOpenAIError(error: unknown, model: string) {
  const apiError = error as {
    status?: number;
    code?: string | null;
    type?: string | null;
    message?: string;
  };
  const safeMessage = (apiError.message || "Erreur OpenAI inconnue.").replace(
    /sk-[A-Za-z0-9_-]+/g,
    "[REDACTED]"
  );

  console.error("[Nova/OpenAI]");
  console.error("endpoint: /v1/chat/completions");
  console.error("model:", model);
  console.error("status:", apiError.status ?? "unknown");
  console.error("code:", apiError.code ?? "unknown");
  console.error("type:", apiError.type ?? "unknown");
  console.error("message:", safeMessage);
}
