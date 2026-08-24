import "server-only";

import { createForgeAgentRunner, ForgeAgentError, publicAgentRun } from "./agent-foundation";
import { openAIForgeAgentModelProvider } from "./agent-model";
import { cancelAgentRun, createAgentRun, getAgentRun, getLatestAgentRun, insertAgentStep, isAgentRunCancelled, listAgentSteps, updateAgentRun, updateAgentStep } from "./agent-store";
import { forgeRuntimeService } from "./runtime-runtime";
import { findRuntimeByWorkspace } from "./runtime-store";
import { forgeWorkspaceService } from "./workspace-runtime";

async function ownedWorkspace(userId: string, conversationId: string) {
  const workspace = await forgeWorkspaceService.get(userId, conversationId);
  if (!workspace) throw new ForgeAgentError("NOT_FOUND", "Workspace Forge introuvable ou inaccessible.");
  return workspace;
}
async function readyContext(userId: string, conversationId: string) {
  const workspace = await ownedWorkspace(userId, conversationId);
  if (workspace.status !== "READY") throw new ForgeAgentError("CONFLICT", "Un workspace READY est requis.");
  const runtime = await findRuntimeByWorkspace(userId, workspace.workspaceId, "daytona");
  if (!runtime || runtime.status !== "READY" || (runtime.expiresAt && Date.parse(runtime.expiresAt) <= Date.now()) || runtime.baseCommitSha !== workspace.baseCommitSha) throw new ForgeAgentError("CONFLICT", "Un runtime READY lié au workspace est requis.");
  return { projectId: workspace.projectId, workspaceId: workspace.workspaceId, runtimeId: runtime.runtimeId, repository: workspace.repository, branch: workspace.branch, baseCommitSha: workspace.baseCommitSha };
}

export const forgeAgentRunner = createForgeAgentRunner({
  resolveContext: readyContext, createRun: createAgentRun, updateRun: updateAgentRun, appendStep: insertAgentStep, updateStep: updateAgentStep, isCancelled: isAgentRunCancelled,
  runtime: (userId, conversationId) => ({ listFiles: (path) => forgeRuntimeService.listFiles(userId, conversationId, path), readFile: (path) => forgeRuntimeService.readFile(userId, conversationId, path), writeFile: (path, content) => forgeRuntimeService.writeFile(userId, conversationId, path, content), deleteFile: (path) => forgeRuntimeService.deleteFile(userId, conversationId, path), executeCommand: (command) => forgeRuntimeService.executeCommand(userId, conversationId, command), getGitStatus: () => forgeRuntimeService.getGitStatus(userId, conversationId), getGitDiff: () => forgeRuntimeService.getGitDiff(userId, conversationId) }),
  model: openAIForgeAgentModelProvider, now: () => new Date().toISOString(),
});

export async function getForgeAgentRunView(userId: string, conversationId: string, runId?: string) { const workspace = await ownedWorkspace(userId, conversationId); const run = runId ? await getAgentRun(userId, runId) : await getLatestAgentRun(userId, conversationId); if (!run || run.conversationId !== conversationId || run.workspaceId !== workspace.workspaceId) return null; return { run: publicAgentRun(run), steps: await listAgentSteps(userId, run.runId) }; }
export async function cancelForgeAgentRun(userId: string, conversationId: string, runId: string) { const workspace = await ownedWorkspace(userId, conversationId); const run = await getAgentRun(userId, runId); if (!run || run.conversationId !== conversationId || run.workspaceId !== workspace.workspaceId) throw new ForgeAgentError("NOT_FOUND", "Run Forge introuvable ou inaccessible."); return publicAgentRun(await cancelAgentRun(userId, runId)); }
