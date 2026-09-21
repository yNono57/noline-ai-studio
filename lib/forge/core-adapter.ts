import {
  agentId, artifactId, artifactType, conversationId, instant, messageId, projectId, provenance, runId, userId, userOwnership,
  type AgentRun, type Artifact, type Conversation, type ExecutionState, type Message, type MessageRole, type Project,
} from "../core";
import type { ForgeAgentRun, ForgeRunArtifact } from "./agent-foundation";
import type { ForgeConversation, ForgeMessage, ForgeProject } from "./forge-store";

const FORGE_AGENT_ID = agentId("forge");
const roles: Record<ForgeMessage["role"], MessageRole> = {
  USER: "user", ASSISTANT: "assistant", SYSTEM: "system", TOOL: "tool",
};
const runStates: Record<ForgeAgentRun["status"], ExecutionState> = {
  QUEUED: "QUEUED", PLANNING: "RUNNING", RUNNING: "RUNNING", VALIDATING: "RUNNING",
  COMPLETED: "COMPLETED", FAILED: "FAILED", CANCELLED: "CANCELLED",
};

export function toCoreForgeProject(value: ForgeProject): Project {
  return {
    id: projectId(value.id), ownership: userOwnership(userId(value.user_id)), name: value.name,
    description: value.description, status: value.status, createdAt: instant(value.created_at), updatedAt: instant(value.updated_at),
  };
}

export function toCoreForgeConversation(value: ForgeConversation, ownerId: string): Conversation {
  const owner = userId(ownerId);
  return {
    id: conversationId(value.id), projectId: projectId(value.forge_project_id), ownership: userOwnership(owner),
    title: value.title, status: value.status,
    participants: [{ kind: "user", userId: owner }, { kind: "agent", agentId: FORGE_AGENT_ID }],
    primaryAgentId: FORGE_AGENT_ID, createdAt: instant(value.created_at), updatedAt: instant(value.updated_at),
  };
}

export function toCoreForgeMessage(value: ForgeMessage): Message {
  const role = roles[value.role];
  const source = role === "user"
    ? provenance({ source: "user" })
    : role === "assistant"
      ? provenance({ source: "agent", agentId: FORGE_AGENT_ID })
      : role === "tool"
        ? provenance({ source: "tool", tool: "forge" })
        : provenance({ source: "system" });
  return {
    id: messageId(value.id), conversationId: conversationId(value.conversation_id), role, content: value.content,
    provenance: source,
    metadata: value.metadata, createdAt: instant(value.created_at),
  };
}

export function toCoreForgeRun(value: ForgeAgentRun): AgentRun {
  return {
    id: runId(value.runId), projectId: projectId(value.projectId), ownership: userOwnership(userId(value.userId)),
    agentId: FORGE_AGENT_ID, state: runStates[value.status], objective: value.objective,
    createdAt: instant(value.createdAt), startedAt: value.startedAt ? instant(value.startedAt) : null,
    completedAt: value.completedAt ? instant(value.completedAt) : null,
    updatedAt: instant(value.lastActivityAt ?? value.completedAt ?? value.startedAt ?? value.createdAt),
    failureReason: value.error ?? undefined,
  };
}

export function toCoreForgeArtifact(value: ForgeRunArtifact, project: string, owner: string): Artifact {
  const mappedRunId = runId(value.runId);
  return {
    id: artifactId(value.artifactId), projectId: projectId(project), runId: mappedRunId,
    ownership: userOwnership(userId(owner)), type: artifactType("code.patch"), name: value.repository + ":" + value.sourceBranch,
    provenance: provenance({ source: "agent", agentId: FORGE_AGENT_ID, runId: mappedRunId }),
    metadata: { repository: value.repository, baseCommitSha: value.baseCommitSha, changedFiles: value.changedFiles, additions: value.additions, deletions: value.deletions, status: value.status },
    createdAt: instant(value.createdAt),
  };
}
