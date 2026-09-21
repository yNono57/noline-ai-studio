import { ModelGateway } from "./model-gateway";
import { modelId, type ModelDescriptor, type ModelId } from "./contracts";
import { DEFAULT_MODEL_REGISTRY, ModelRegistry } from "../models/registry";
import { OpenAIProvider, createOpenAITransport } from "../providers/openai";

export function createOpenAIModelGateway(apiKey: string, requestedModel?: ModelId): ModelGateway {
  const known = requestedModel && DEFAULT_MODEL_REGISTRY.some((entry) => entry.id === requestedModel);
  const additional: readonly ModelDescriptor[] = requestedModel && !known ? [{
    provider: "openai",
    id: modelId(requestedModel),
    capabilities: { supported: new Set(["text", "streaming", "tools", "structured_output"]) },
    enabled: true,
    usageUnit: "tokens",
  }] : [];
  return new ModelGateway({
    registry: new ModelRegistry([...DEFAULT_MODEL_REGISTRY, ...additional]),
    providers: [new OpenAIProvider(createOpenAITransport(apiKey))],
  });
}