import type { OwnershipContext } from "../identity/contracts";
import type { ProjectId } from "../shared/ids";
import type { Instant } from "../shared/time";

export type ProjectStatus = "active" | "archived";

export interface Project {
  readonly id: ProjectId;
  readonly ownership: OwnershipContext;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}
