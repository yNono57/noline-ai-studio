import type { OwnershipContext } from "@/lib/core/identity/contracts";
import type { AgentId, ProjectId, RunId } from "@/lib/core/shared/ids";
import type { Instant } from "@/lib/core/shared/time";
import type { Money, UsageEvent } from "@/lib/core/usage/contracts";

export type ModelProvider = "openai" | (string & {});
export type ModelId = string & { readonly __modelId: unique symbol };
export const modelId = (value: string): ModelId => {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("ModelId cannot be empty.");
  return normalized as ModelId;
};

export type ModelCapability = "text" | "streaming" | "tools" | "vision" | "image" | "audio" | "video" | "embeddings" | "structured_output";
export interface ModelCapabilities { readonly supported: ReadonlySet<ModelCapability> }
export type UsageUnitSemantics = "tokens" | "seconds" | "images" | "bytes" | "provider_units";
export interface ModelDescriptor {
  readonly provider: ModelProvider;
  readonly id: ModelId;
  readonly aliases?: readonly ModelId[];
  readonly capabilities: ModelCapabilities;
  readonly enabled: boolean;
  readonly usageUnit: UsageUnitSemantics;
}

export type GatewayMessageRole = "system" | "user" | "assistant" | "tool";
export interface GatewayMessage { readonly role: GatewayMessageRole; readonly content: string; readonly name?: string; readonly toolCallId?: string }
export interface GatewayTool { readonly name: string; readonly description?: string; readonly inputSchema: Readonly<Record<string, unknown>> }
export interface StructuredOutput { readonly name: string; readonly schema: Readonly<Record<string, unknown>>; readonly strict?: boolean }
export interface NativeWebSearch { readonly type: "web_search"; readonly maxToolCalls?: number }

export interface GenerationAttribution {
  readonly ownership?: OwnershipContext;
  readonly agentId?: AgentId;
  readonly projectId?: ProjectId;
  readonly runId?: RunId;
}
export interface GenerationRequest {
  readonly model: ModelId;
  readonly messages: readonly GatewayMessage[];
  readonly temperature?: number;
  readonly maxOutputUnits?: number;
  readonly tools?: readonly GatewayTool[];
  readonly structuredOutput?: StructuredOutput;
  readonly nativeTools?: readonly NativeWebSearch[];
  readonly attribution?: GenerationAttribution;
  readonly signal?: AbortSignal;
}
export interface ModelUsage { readonly inputUnits?: number; readonly outputUnits?: number; readonly totalUnits?: number; readonly unit: UsageUnitSemantics }
export type ModelCost = { readonly status: "KNOWN"; readonly amount: Money } | { readonly status: "UNKNOWN"; readonly reason: "MODEL_NOT_PRICED" | "USAGE_UNAVAILABLE" };
export interface ToolCall { readonly id: string; readonly name: string; readonly arguments: string }
export interface GenerationResult {
  readonly text: string;
  readonly provider: ModelProvider;
  readonly model: ModelId;
  readonly responseId?: string;
  readonly finishReason?: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage?: ModelUsage;
  readonly cost: ModelCost;
  readonly observation: GatewayObservation;
  readonly usageEvent?: UsageEvent;
}
export interface GenerationChunk { readonly textDelta: string; readonly finishReason?: string; readonly usage?: ModelUsage }
export interface GatewayObservation {
  readonly provider: ModelProvider;
  readonly model: ModelId;
  readonly ownership?: OwnershipContext;
  readonly agentId?: AgentId;
  readonly projectId?: ProjectId;
  readonly runId?: RunId;
  readonly startedAt: Instant;
  readonly durationMs: number;
  readonly status: "SUCCESS" | "FAILURE";
  readonly usage?: ModelUsage;
  readonly cost: ModelCost;
  readonly errorCategory?: string;
}
export interface ProviderGenerationResult { readonly text: string; readonly model: ModelId; readonly responseId?: string; readonly finishReason?: string; readonly toolCalls?: readonly ToolCall[]; readonly usage?: ModelUsage }
export interface ModelProviderAdapter {
  readonly provider: ModelProvider;
  generate(request: GenerationRequest): Promise<ProviderGenerationResult>;
  stream?(request: GenerationRequest): AsyncIterable<GenerationChunk>;
}
