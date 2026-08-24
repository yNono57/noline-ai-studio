import "server-only";

import { getForgeConversation, getForgeProject } from "./forge-store";
import { listRepositoryBranches } from "./github-provider";
import { requireActiveGitHubConnection } from "./github-store";
import { metadataOnlyWorkspaceProvider } from "./workspace-provider";
import { createForgeWorkspaceService } from "./workspace-foundation";
import { expireOtherConversationWorkspaces, findExactWorkspace, findLatestWorkspaceForSource, insertCreatingWorkspace, updateWorkspaceStatus } from "./workspace-store";

export const forgeWorkspaceService = createForgeWorkspaceService({
  getConversation: getForgeConversation,
  getProject: getForgeProject,
  async getInstallationId(userId) { return (await requireActiveGitHubConnection(userId)).installationId; },
  listBranches: listRepositoryBranches,
  findExact: findExactWorkspace,
  findLatestForSource: findLatestWorkspaceForSource,
  insertCreating: insertCreatingWorkspace,
  updateStatus: updateWorkspaceStatus,
  expireOtherSources: expireOtherConversationWorkspaces,
  provider: metadataOnlyWorkspaceProvider,
});
