import {
  agentId, conversationId, instant, messageId, projectId, provenance, userId, userOwnership,
  type Conversation, type Message, type MessageRole, type Project,
} from "../core";
import type { Conversation as NovaConversation, Message as NovaMessage, Project as NovaProject } from "./conversation-store";

const NOVA_AGENT_ID = agentId("nova");
const messageRoles: Record<NovaMessage["role"], MessageRole> = {
  USER: "user", ASSISTANT: "assistant", SYSTEM: "system", TOOL: "tool",
};

export function toCoreProject(value: NovaProject): Project {
  return {
    id: projectId(value.id), ownership: userOwnership(userId(value.user_id)), name: value.name,
    description: value.description, status: value.status, createdAt: instant(value.created_at), updatedAt: instant(value.updated_at),
  };
}

export function toCoreConversation(value: NovaConversation, ownerId: string): Conversation {
  const owner = userId(ownerId);
  return {
    id: conversationId(value.id), projectId: projectId(value.project_id), ownership: userOwnership(owner),
    title: value.title, status: value.status,
    participants: [{ kind: "user", userId: owner }, { kind: "agent", agentId: NOVA_AGENT_ID }],
    primaryAgentId: NOVA_AGENT_ID, createdAt: instant(value.created_at), updatedAt: instant(value.updated_at),
  };
}

export function toCoreMessage(value: NovaMessage): Message {
  const role = messageRoles[value.role];
  const source = role === "user"
    ? provenance({ source: "user" })
    : role === "assistant"
      ? provenance({ source: "agent", agentId: NOVA_AGENT_ID })
      : role === "tool"
        ? provenance({ source: "tool", tool: "nova" })
        : provenance({ source: "system" });
  return {
    id: messageId(value.id), conversationId: conversationId(value.conversation_id), role, content: value.content,
    provenance: source,
    metadata: value.metadata, createdAt: instant(value.created_at),
  };
}
