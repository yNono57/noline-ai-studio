import OpenAI from "openai";
import type { GenerationChunk, GenerationRequest, ModelProviderAdapter, ProviderGenerationResult, ToolCall } from "../gateway/contracts";
import { modelId } from "../gateway/contracts";
import { normalizeProviderError } from "../errors/gateway-error";

type OpenAITransport = {
  createChat(input: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  createResponse(input: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  streamChat?(input: Record<string, unknown>, signal?: AbortSignal): AsyncIterable<unknown>;
};
type UnknownRecord = Record<string, unknown>;

export function createOpenAITransport(apiKey: string): OpenAITransport {
  const client = new OpenAI({ apiKey });
  return {
    createChat: (input, signal) => client.chat.completions.create(input as never, signal ? { signal } : undefined),
    createResponse: (input, signal) => client.responses.create(input as never, signal ? { signal } : undefined),
    async *streamChat(input, signal) {
      const stream = await client.chat.completions.create({ ...input, stream: true } as never, signal ? { signal } : undefined);
      for await (const chunk of stream as unknown as AsyncIterable<unknown>) yield chunk;
    },
  };
}

export class OpenAIProvider implements ModelProviderAdapter {
  readonly provider = "openai" as const;
  constructor(private readonly transport: OpenAITransport) {}

  async generate(request: GenerationRequest): Promise<ProviderGenerationResult> {
    try {
      return request.nativeTools?.length
        ? normalizeResponse(await this.transport.createResponse(toResponsesRequest(request), request.signal), request)
        : normalizeChat(await this.transport.createChat(toChatRequest(request), request.signal), request);
    } catch (error) { throw normalizeProviderError(error, this.provider); }
  }

  async *stream(request: GenerationRequest): AsyncIterable<GenerationChunk> {
    if (!this.transport.streamChat) throw normalizeProviderError({ status: 400, code: "streaming_not_supported" }, this.provider);
    try {
      for await (const raw of this.transport.streamChat(toChatRequest(request), request.signal)) {
        const chunk = asRecord(raw), choice = asRecord(asArray(chunk.choices)[0]), delta = asRecord(choice.delta);
        const usage = readChatUsage(chunk.usage);
        yield { textDelta: typeof delta.content === "string" ? delta.content : "", finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : undefined, usage };
      }
    } catch (error) { throw normalizeProviderError(error, this.provider); }
  }
}

function toChatRequest(request: GenerationRequest): Record<string, unknown> {
  return {
    model: request.model,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content, ...(message.name ? { name: message.name } : {}), ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}) })),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxOutputUnits !== undefined ? { max_tokens: request.maxOutputUnits } : {}),
    ...(request.tools?.length ? { tools: request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } })) } : {}),
    ...(request.structuredOutput ? { response_format: { type: "json_schema", json_schema: { name: request.structuredOutput.name, strict: request.structuredOutput.strict ?? true, schema: request.structuredOutput.schema } } } : {}),
  };
}

function toResponsesRequest(request: GenerationRequest): Record<string, unknown> {
  const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  return {
    model: request.model,
    ...(system ? { instructions: system } : {}),
    input: request.messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role, content: message.content })),
    tools: request.nativeTools?.map((tool) => ({ type: tool.type })),
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    max_tool_calls: Math.max(...(request.nativeTools || []).map((tool) => tool.maxToolCalls || 1)),
    store: false,
    ...(request.maxOutputUnits !== undefined ? { max_output_tokens: request.maxOutputUnits } : {}),
  };
}

function normalizeChat(raw: unknown, request: GenerationRequest): ProviderGenerationResult {
  const value = asRecord(raw), choice = asRecord(asArray(value.choices)[0]), message = asRecord(choice.message);
  return {
    text: typeof message.content === "string" ? message.content.trim() : "",
    model: modelId(typeof value.model === "string" ? value.model : request.model),
    responseId: typeof value.id === "string" ? value.id : undefined,
    finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : undefined,
    toolCalls: readToolCalls(message.tool_calls),
    usage: readChatUsage(value.usage),
  };
}

function normalizeResponse(raw: unknown, request: GenerationRequest): ProviderGenerationResult {
  const value = asRecord(raw), output = asArray(value.output).map(asRecord);
  const text = typeof value.output_text === "string" ? value.output_text.trim() : output.flatMap((item) => asArray(item.content).map(asRecord)).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text).join("\n").trim();
  const usage = asRecord(value.usage);
  return {
    text,
    model: modelId(typeof value.model === "string" ? value.model : request.model),
    responseId: typeof value.id === "string" ? value.id : undefined,
    toolCalls: [],
    usage: Object.keys(usage).length ? { inputUnits: integer(usage.input_tokens), outputUnits: integer(usage.output_tokens), totalUnits: integer(usage.total_tokens), unit: "tokens" } : undefined,
  };
}

function readChatUsage(raw: unknown) {
  const usage = asRecord(raw);
  return Object.keys(usage).length ? { inputUnits: integer(usage.prompt_tokens), outputUnits: integer(usage.completion_tokens), totalUnits: integer(usage.total_tokens), unit: "tokens" as const } : undefined;
}
function readToolCalls(raw: unknown): ToolCall[] { return asArray(raw).map(asRecord).flatMap((call) => { const fn = asRecord(call.function); return typeof call.id === "string" && typeof fn.name === "string" ? [{ id: call.id, name: fn.name, arguments: typeof fn.arguments === "string" ? fn.arguments : "" }] : []; }); }
function integer(value: unknown): number | undefined { return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined; }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function asRecord(value: unknown): UnknownRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}; }

export type { OpenAITransport };
