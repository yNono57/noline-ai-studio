import OpenAI from "openai";
import type { Message } from "./conversation-store";
import { getNovaModel } from "./nova-model";
import { buildNovaResponsesRequest, buildWebSearchFailureReply, needsCurrentWebInformation, parseNovaResponse, type NovaResponsesRequest } from "./nova-web-search";

export class NovaGenerationError extends Error {
  constructor(message = "Nova n’a pas pu répondre pour le moment. Réessayez.") { super(message); this.name = "NovaGenerationError"; }
}

type CreateResponse = (request: NovaResponsesRequest) => Promise<unknown>;

export async function generateNovaReply(history: Message[], createResponse?: CreateResponse) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getNovaModel();
  if (!apiKey || !model) throw new NovaGenerationError("Nova n’est pas configurée.");
  const request = buildNovaResponsesRequest(history, model);
  debugNovaRequest(request);
  try {
    const run = createResponse || createOpenAIResponse(apiKey);
    return parseNovaResponse(await run(request), model);
  } catch (error) {
    if (error instanceof NovaGenerationError) throw error;
    if (needsCurrentWebInformation(lastUserPrompt(history))) {
      logOpenAIError(error, model);
      return buildWebSearchFailureReply(model);
    }
    logOpenAIError(error, model);
    throw new NovaGenerationError();
  }
}

function createOpenAIResponse(apiKey: string): CreateResponse {
  const client = new OpenAI({ apiKey });
  return (request) => client.responses.create(request as never);
}

function lastUserPrompt(history: Message[]) {
  return [...history].reverse().find((message) => message.role === "USER")?.content || "";
}

function debugNovaRequest(request: NovaResponsesRequest) {
  if (process.env.NODE_ENV === "production" || process.env.NOVA_DEBUG_PROMPT !== "1") return;
  console.info("[Nova/Prompt Debug]", {
    endpoint: "/v1/responses",
    model: request.model,
    roles: request.input.map((message) => message.role),
    tools: request.tools.map((tool) => tool.type),
    toolChoice: request.tool_choice,
  });
}

function logOpenAIError(error: unknown, model: string) {
  const apiError = error as { status?: number; code?: string | null; type?: string | null; message?: string };
  const safeMessage = (apiError.message || "Erreur OpenAI inconnue.").replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
  console.error("[Nova/OpenAI]");
  console.error("endpoint: /v1/responses");
  console.error("model:", model);
  console.error("status:", apiError.status ?? "unknown");
  console.error("code:", apiError.code ?? "unknown");
  console.error("type:", apiError.type ?? "unknown");
  console.error("message:", safeMessage);
}