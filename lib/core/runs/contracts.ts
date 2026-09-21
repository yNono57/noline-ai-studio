import type { OwnershipContext } from "../identity/contracts";
import type { AgentId, ProjectId, RunId } from "../shared/ids";
import type { Instant } from "../shared/time";

export const EXECUTION_STATES = [
  "QUEUED",
  "RUNNING",
  "WAITING",
  "NEEDS_APPROVAL",
  "FAILED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];
export type TerminalExecutionState = Extract<ExecutionState, "FAILED" | "COMPLETED" | "CANCELLED">;

export const isTerminalExecutionState = (state: ExecutionState): state is TerminalExecutionState =>
  state === "FAILED" || state === "COMPLETED" || state === "CANCELLED";

export interface AgentRun {
  readonly id: RunId;
  readonly projectId: ProjectId;
  readonly ownership: OwnershipContext;
  readonly agentId: AgentId;
  readonly state: ExecutionState;
  readonly objective: string;
  readonly createdAt: Instant;
  readonly startedAt: Instant | null;
  readonly completedAt: Instant | null;
  readonly updatedAt: Instant;
  readonly failureReason?: string;
}
