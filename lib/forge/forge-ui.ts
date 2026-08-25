import type { ForgeRuntimeGitDiff, ForgeRuntimeStatus } from "./runtime-foundation";
import type { ForgeMessage } from "./forge-store";

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

export function shouldRenderPendingAgentMission(messages: ForgeMessage[], pending: { content: string; createdAt: string } | null) {
  if (!pending) return false;
  const pendingAt = Date.parse(pending.createdAt);
  return !messages.some((message) => message.role === "USER" && message.content === pending.content && message.metadata?.forge_agent_mission === true && Date.parse(message.created_at) >= pendingAt - 5_000);
}
