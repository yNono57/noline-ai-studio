import type { UsageEvent } from "@/lib/core/usage/contracts";
export interface UsageEventSink { record(event: UsageEvent): Promise<void> }
export const noOpUsageEventSink: UsageEventSink = { async record() {} };
