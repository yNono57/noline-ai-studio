import "server-only";

import { forgeWorkspaceService } from "./workspace-runtime";
import { createForgeRuntimeService } from "./runtime-foundation";
import { daytonaRuntimeProvider } from "./daytona-runtime-provider";
import { getRepositoryInstallationToken } from "./github-provider";
import { requireActiveGitHubConnection } from "./github-store";
import { findRuntimeByWorkspace, insertForgeRuntime, updateForgeRuntime } from "./runtime-store";

export const forgeRuntimeService = createForgeRuntimeService({
  async getOwnedWorkspace(userId, conversationId) { return forgeWorkspaceService.get(userId, conversationId); },
  findByWorkspace: findRuntimeByWorkspace,
  insert: insertForgeRuntime,
  update: updateForgeRuntime,
  async getSourceCredential(userId, repository) {
    const [owner, name, extra] = repository.split("/");
    if (!owner || !name || extra) throw new Error("INVALID_RUNTIME_REPOSITORY");
    const connection = await requireActiveGitHubConnection(userId);
    const token = await getRepositoryInstallationToken(connection.installationId, owner, name);
    return { username: "x-access-token", password: token };
  },
  provider: daytonaRuntimeProvider,
  now: () => new Date().toISOString(),
});
