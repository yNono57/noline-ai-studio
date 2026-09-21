import { instant } from "@/lib/core/shared/time";
import { usageEventId } from "@/lib/core/shared/ids";
import type { UsageEvent } from "@/lib/core/usage/contracts";
import { calculateModelCost, type ModelPricing } from "../usage/cost";
import { noOpUsageEventSink, type UsageEventSink } from "../usage/sink";
import { GatewayError, normalizeProviderError } from "../errors/gateway-error";
import { ModelRegistry } from "../models/registry";
import type { GatewayObservation, GenerationRequest, GenerationResult, ModelProviderAdapter } from "./contracts";

type Options = {
  readonly registry?: ModelRegistry;
  readonly providers: readonly ModelProviderAdapter[];
  readonly pricing?: readonly ModelPricing[];
  readonly usageSink?: UsageEventSink;
  readonly now?: () => Date;
  readonly id?: () => string;
  readonly observe?: (observation: GatewayObservation) => void;
};

export class ModelGateway {
  private readonly registry: ModelRegistry;
  private readonly providers = new Map<string, ModelProviderAdapter>();
  private readonly pricing: readonly ModelPricing[];
  private readonly usageSink: UsageEventSink;
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly observe?: (observation: GatewayObservation) => void;
  constructor(options: Options) {
    this.registry = options.registry || new ModelRegistry();
    for (const provider of options.providers) this.providers.set(provider.provider, provider);
    this.pricing = options.pricing || [];
    this.usageSink = options.usageSink || noOpUsageEventSink;
    this.now = options.now || (() => new Date());
    this.id = options.id || (() => crypto.randomUUID());
    this.observe = options.observe;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const started = this.now();
    let providerName = "unknown";
    try {
      const descriptor = this.registry.requireEnabled(request.model);
      providerName = descriptor.provider;
      const provider = this.providers.get(descriptor.provider);
      if (!provider) throw new GatewayError("MODEL_UNAVAILABLE", "No provider adapter is registered.", descriptor.provider);
      const result = await provider.generate(request);
      const cost = calculateModelCost(descriptor.id, result.usage, this.pricing);
      const observation: GatewayObservation = {
        provider: descriptor.provider, model: result.model, ...request.attribution,
        startedAt: instant(started), durationMs: Math.max(0, this.now().getTime() - started.getTime()),
        status: "SUCCESS", usage: result.usage, cost,
      };
      const usageEvent = request.attribution?.ownership ? this.makeUsageEvent(request, result.model, descriptor.provider, result.usage, cost.status === "KNOWN" ? cost.amount : null) : undefined;
      if (usageEvent) await this.usageSink.record(usageEvent);
      this.observe?.(observation);
      return { ...result, provider: descriptor.provider, model: result.model, toolCalls: result.toolCalls || [], cost, observation, usageEvent };
    } catch (error) {
      const normalized = normalizeProviderError(error, providerName);
      this.observe?.({ provider: providerName, model: request.model, ...request.attribution, startedAt: instant(started), durationMs: Math.max(0, this.now().getTime() - started.getTime()), status: "FAILURE", cost: { status: "UNKNOWN", reason: "USAGE_UNAVAILABLE" }, errorCategory: normalized.category });
      throw normalized;
    }
  }

  private makeUsageEvent(request: GenerationRequest, model: GenerationResult["model"], provider: string, units: GenerationResult["usage"], estimatedCost: UsageEvent["estimatedCost"]): UsageEvent {
    return {
      id: usageEventId(this.id()), ownership: request.attribution!.ownership!, projectId: request.attribution?.projectId || null,
      runId: request.attribution?.runId || null, provider, model, units: { input: units?.inputUnits, output: units?.outputUnits, total: units?.totalUnits, unit: units?.unit || "provider_units" },
      estimatedCost, actualCost: null, occurredAt: instant(this.now()),
    };
  }
}
