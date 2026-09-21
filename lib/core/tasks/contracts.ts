import type { OwnershipContext } from "../identity/contracts";
import type { AgentId, ProjectId, RunId, TaskId } from "../shared/ids";
import type { ExecutionState } from "../runs/contracts";
import type { Instant } from "../shared/time";

export interface Task {
  readonly id: TaskId;
  readonly projectId: ProjectId;
  readonly ownership: OwnershipContext;
  readonly agentId: AgentId;
  readonly runId: RunId | null;
  readonly state: ExecutionState;
  readonly intent: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly availableAt: Instant;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export function assertTaskAttempts(task: Pick<Task, "attempt" | "maxAttempts">): void {
  if (!Number.isInteger(task.attempt) || task.attempt < 0) throw new TypeError("Task attempt must be a non-negative integer.");
  if (!Number.isInteger(task.maxAttempts) || task.maxAttempts < 1 || task.attempt > task.maxAttempts) {
    throw new TypeError("Task maxAttempts must be positive and not lower than attempt.");
  }
}
