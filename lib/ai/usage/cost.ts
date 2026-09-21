import { money } from "@/lib/core/usage/contracts";
import type { ModelCost, ModelId, ModelUsage } from "../gateway/contracts";

export interface ModelPricing { readonly model: ModelId; readonly currency: string; readonly inputMinorUnitsPerMillion: bigint; readonly outputMinorUnitsPerMillion: bigint }
export const MODEL_PRICING: readonly ModelPricing[] = Object.freeze([]);

export function calculateModelCost(model: ModelId, usage: ModelUsage | undefined, pricing: readonly ModelPricing[] = MODEL_PRICING): ModelCost {
  if (!usage || (usage.inputUnits === undefined && usage.outputUnits === undefined)) return { status: "UNKNOWN", reason: "USAGE_UNAVAILABLE" };
  const rate = pricing.find((entry) => entry.model === model);
  if (!rate) return { status: "UNKNOWN", reason: "MODEL_NOT_PRICED" };
  const input = BigInt(usage.inputUnits || 0) * rate.inputMinorUnitsPerMillion;
  const output = BigInt(usage.outputUnits || 0) * rate.outputMinorUnitsPerMillion;
  const rounded = (input + output + BigInt(999_999)) / BigInt(1_000_000);
  return { status: "KNOWN", amount: money(rate.currency, rounded) };
}
