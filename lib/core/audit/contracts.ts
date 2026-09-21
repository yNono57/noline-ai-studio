import type { OwnershipContext } from "../identity/contracts";
import type { Money } from "../usage/contracts";
import type { AgentId, AuditEventId, RunId, UserId } from "../shared/ids";
import type { Instant } from "../shared/time";

export interface AuditActor { readonly userId: UserId; readonly ownership: OwnershipContext }
export interface AuditResource { readonly type: string; readonly id: string }
export interface AuditResult { readonly status: "succeeded" | "failed" | "denied"; readonly code?: string }

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly actor: AuditActor;
  readonly action: string;
  readonly agentId: AgentId | null;
  readonly runId: RunId | null;
  readonly tool: string | null;
  readonly resource: AuditResource;
  readonly occurredAt: Instant;
  readonly result: AuditResult;
  readonly cost: Money | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}
