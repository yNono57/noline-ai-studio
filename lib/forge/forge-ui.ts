import type { ForgeRuntimeGitDiff, ForgeRuntimeStatus } from "./runtime-foundation";
import type { ForgeMessage } from "./forge-store";
import type { ForgeAgentRunPayload } from "./forge-client";

export function summarizeForgeDiff(diff: ForgeRuntimeGitDiff) {
  const additions = diff.patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const deletions = diff.patch.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  return { files: new Set([...diff.added, ...diff.modified, ...diff.deleted]).size, additions, deletions };
}

export function getForgeRuntimeBadge(status: ForgeRuntimeStatus | null | undefined) {
  return { label: status || "NON PROVISIONNÉ", ready: status === "READY" };
}

export function getForgeAgentActivityState(status: string) {
  const active = ["QUEUED", "PLANNING", "RUNNING", "VALIDATING"].includes(status);
  if (active) return { active: true, label: "Forge travaille…" };
  if (status === "COMPLETED") return { active: false, label: "Mission terminée" };
  return { active: false, label: "Forge n’a pas pu terminer la mission" };
}

export function shouldRenderPendingAgentMission(messages: ForgeMessage[], pending: { id: string } | null) {
  if (!pending) return false;
  return !messages.some((message) => message.role === "USER" && message.metadata?.forge_agent_submission_id === pending.id);
}
export type ForgeConversationTimelineItem =
  | { key: string; at: string; kind: "message"; message: ForgeMessage }
  | { key: string; at: string; kind: "agent"; payload: ForgeAgentRunPayload };

export function buildForgeConversationTimeline(messages: ForgeMessage[], agentRuns: ForgeAgentRunPayload[], pending: { id: string; content: string; createdAt: string } | null, conversationId: string) {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const runById = new Map(agentRuns.map((payload) => [payload.run.runId, payload]));
  const timeline: ForgeConversationTimelineItem[] = [...messageById.values()].map((message) => ({ key: `message-${message.id}`, at: message.created_at, kind: "message", message }));
  if (pending && shouldRenderPendingAgentMission([...messageById.values()], pending)) timeline.push({ key: `pending-${pending.id}`, at: pending.createdAt, kind: "message", message: { id: pending.id, conversation_id: conversationId, role: "USER", content: pending.content, metadata: { pending: true, forge_agent_mission: true, forge_agent_submission_id: pending.id }, created_at: pending.createdAt } });
  for (const payload of runById.values()) timeline.push({ key: `agent-${payload.run.runId}`, at: payload.run.createdAt, kind: "agent", payload });
  return timeline.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
}
