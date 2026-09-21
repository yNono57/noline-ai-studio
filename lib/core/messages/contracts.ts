import type { ConversationId, MessageId } from "../shared/ids";
import type { Provenance } from "../shared/provenance";
import type { Instant } from "../shared/time";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly role: MessageRole;
  readonly content: string;
  readonly provenance: Provenance;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: Instant;
}
