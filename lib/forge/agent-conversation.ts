import type { ForgeAgentRun } from "./agent-foundation";
import type { ForgeMessage } from "./forge-store";

type CreateMessage = (input: { role: "USER" | "ASSISTANT"; content: string; metadata: Record<string, unknown> }) => Promise<ForgeMessage>;
type UpdateMessageMetadata = (messageId: string, metadata: Record<string, unknown>) => Promise<ForgeMessage>;
export async function runForgeAgentConversation(input: { objective: string; submissionId?: string }, dependencies: { createMessage: CreateMessage; updateMessageMetadata?: UpdateMessageMetadata; runAgent(): Promise<ForgeAgentRun> }) {
  const missionMetadata = { forge_agent_mission: true, ...(input.submissionId ? { forge_agent_submission_id: input.submissionId } : {}) };
  let userMessage = await dependencies.createMessage({ role: "USER", content: input.objective, metadata: missionMetadata });
  const run = await dependencies.runAgent();
  if (dependencies.updateMessageMetadata) userMessage = await dependencies.updateMessageMetadata(userMessage.id, { ...missionMetadata, forge_agent_run_id: run.runId });
  const assistantMessage = run.status === "COMPLETED" && run.finalReport
    ? await dependencies.createMessage({ role: "ASSISTANT", content: run.finalReport, metadata: { forge_agent_result: true, forge_agent_run_id: run.runId, reply_to_message_id: userMessage.id } })
    : null;
  return { run, userMessage, assistantMessage };
}