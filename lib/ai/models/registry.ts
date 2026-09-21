import { modelId, type ModelCapability, type ModelDescriptor, type ModelId } from "../gateway/contracts";

const caps = (...supported: ModelCapability[]) => ({ supported: new Set(supported) as ReadonlySet<ModelCapability> });
export const DEFAULT_MODEL_REGISTRY: readonly ModelDescriptor[] = Object.freeze([
  { provider: "openai", id: modelId("gpt-4.1-mini"), capabilities: caps("text", "streaming", "tools", "structured_output"), enabled: true, usageUnit: "tokens" },
  { provider: "openai", id: modelId("gpt-5.4-mini"), capabilities: caps("text", "streaming", "tools", "vision", "structured_output"), enabled: true, usageUnit: "tokens" },
]);

export class ModelRegistry {
  private readonly byId = new Map<string, ModelDescriptor>();
  private readonly aliases = new Map<string, ModelDescriptor>();
  constructor(models: readonly ModelDescriptor[] = DEFAULT_MODEL_REGISTRY) {
    for (const model of models) {
      if (this.byId.has(model.id)) throw new TypeError(`Duplicate model: ${model.id}`);
      this.byId.set(model.id, model);
      for (const alias of model.aliases || []) {
        if (this.byId.has(alias) || this.aliases.has(alias)) throw new TypeError(`Duplicate model alias: ${alias}`);
        this.aliases.set(alias, model);
      }
    }
  }
  get(id: ModelId): ModelDescriptor | undefined { return this.byId.get(id) || this.aliases.get(id); }
  requireEnabled(id: ModelId): ModelDescriptor {
    const model = this.get(id);
    if (!model || !model.enabled) throw new TypeError(`Model is unavailable: ${id}`);
    return model;
  }
  supports(id: ModelId, capability: ModelCapability): boolean { return Boolean(this.get(id)?.capabilities.supported.has(capability)); }
}
