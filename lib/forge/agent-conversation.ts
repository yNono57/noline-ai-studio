import type { ForgeAgentRun } from "./agent-foundation";
import type { ForgeMessage } from "./forge-store";

type CreateMessage = (input: { role: "USER" | "ASSISTANT"; content: string; metadata: Record<string, unknown> }) => Promise<ForgeMessage>;
export async function runForgeAgentConversation(input: { objective: string }, dependencies: { createMessage: CreateMessage; runAgent(): Promise<ForgeAgentRun> }) {
  const userMessage = await dependencies.createMessage({ role: "USER", content: input.objective, metadata: { forge_agent_mission: true } });
  const run = await dependencies.runAgent();
  const assistantMessage = run.status === "COMPLETED" && run.finalReport
    ? await dependencies.createMessage({ role: "ASSISTANT", content: run.finalReport, metadata: { forge_agent_result: true, forge_agent_run_id: run.runId, reply_to_message_id: userMessage.id } })
    : null;
  return { run, userMessage, assistantMessage };
}