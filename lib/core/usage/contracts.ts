import type { OwnershipContext } from "../identity/contracts";
import type { ProjectId, RunId, UsageEventId } from "../shared/ids";
import type { Instant } from "../shared/time";

export interface Money {
  readonly currency: string;
  readonly minorUnits: bigint;
}

export function money(currency: string, minorUnits: bigint): Money {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new TypeError("Money currency must be a three-letter code.");
  if (minorUnits < BigInt(0)) throw new TypeError("Money cannot be negative.");
  return Object.freeze({ currency: normalized, minorUnits });
}

export interface UsageUnits {
  readonly input?: number;
  readonly output?: number;
  readonly total?: number;
  readonly unit: "tokens" | "seconds" | "images" | "bytes" | "provider_units";
}

export interface UsageEvent {
  readonly id: UsageEventId;
  readonly ownership: OwnershipContext;
  readonly projectId: ProjectId | null;
  readonly runId: RunId | null;
  readonly provider: string;
  readonly model: string | null;
  readonly units: UsageUnits;
  readonly estimatedCost: Money | null;
  readonly actualCost: Money | null;
  readonly occurredAt: Instant;
}

export function assertUsageUnits(units: UsageUnits): void {
  for (const value of [units.input, units.output, units.total]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new TypeError("Usage units must be non-negative safe integers.");
    }
  }
}
