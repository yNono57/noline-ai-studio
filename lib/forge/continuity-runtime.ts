import "server-only";

import { createForgeContinuityService } from "./continuity-foundation";
import { getAgentRun, getAgentRunArtifactById, listProjectAgentRunArtifacts, updateAgentRunArtifact } from "./agent-store";
import { forgeWorkspaceService } from "./workspace-runtime";
import { forgeRuntimeService } from "./runtime-runtime";

export const forgeContinuityService = createForgeContinuityService({
  getWorkspace: (userId, conversationId) => forgeWorkspaceService.get(userId, conversationId),
  getRuntime: (userId, conversationId) => forgeRuntimeService.get(userId, conversationId),
  getArtifact: getAgentRunArtifactById,
  getRun: getAgentRun,
  updateArtifact: updateAgentRunArtifact,
  runtime: (userId, conversationId) => ({
    writeFile: (path, content) => forgeRuntimeService.writeFile(userId, conversationId, path, content),
    deleteFile: (path) => forgeRuntimeService.deleteFile(userId, conversationId, path),
    execute: (command) => forgeRuntimeService.executeCommand(userId, conversationId, command),
    getGitStatus: () => forgeRuntimeService.getGitStatus(userId, conversationId),
    getGitDiff: () => forgeRuntimeService.getGitDiff(userId, conversationId),
  }),
  now: () => new Date().toISOString(),
});

export async function listForgeContinuityArtifacts(userId: string, conversationId: string) {
  const workspace = await forgeWorkspaceService.get(userId, conversationId);
  if (!workspace) return [];
  return listProjectAgentRunArtifacts(userId, workspace.projectId);
}
