import type { OwnershipContext } from "../identity/contracts";
import type { AgentId, ConversationId, ProjectId, UserId } from "../shared/ids";
import type { Instant } from "../shared/time";

export interface ConversationParticipant {
  readonly kind: "user" | "agent" | "system";
  readonly userId?: UserId;
  readonly agentId?: AgentId;
}

export interface Conversation {
  readonly id: ConversationId;
  readonly projectId: ProjectId;
  readonly ownership: OwnershipContext;
  readonly title: string;
  readonly status: "active" | "archived";
  readonly participants: readonly ConversationParticipant[];
  readonly primaryAgentId?: AgentId;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}
