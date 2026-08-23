export type AIMessageRole = "user" | "assistant" | "system" | "tool";

export interface AIMessage {
  readonly role: AIMessageRole;
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
}

export type AIModality = "text" | "image" | "audio" | "video";

export interface ModelCapabilities {
  readonly input: readonly AIModality[];
  readonly output: readonly AIModality[];
  readonly streaming: boolean;
  readonly tools: boolean;
}

export interface Model {
  readonly key: string;
  readonly provider: string;
  readonly name: string;
  readonly capabilities: ModelCapabilities;
}

export interface GenerationRequest {
  readonly model: string;
  readonly messages: readonly AIMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly signal?: AbortSignal;
}

export interface GenerationResult {
  readonly message: AIMessage;
  readonly model: string;
  readonly finishReason?: string;
}

export interface GenerationChunk {
  readonly delta: string;
  readonly finishReason?: string;
}

export interface AIProvider {
  readonly key: string;
  readonly models: readonly Model[];
  generate(request: GenerationRequest): Promise<GenerationResult>;
  stream(request: GenerationRequest): AsyncIterable<GenerationChunk>;
}
