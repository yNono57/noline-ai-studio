import "server-only";

import { forgeWorkspaceService } from "./workspace-runtime";
import { createForgeRuntimeService } from "./runtime-foundation";
import { unprovisionedRuntimeProvider } from "./runtime-provider";
import { findRuntimeByWorkspace, insertForgeRuntime, updateForgeRuntime } from "./runtime-store";

export const forgeRuntimeService = createForgeRuntimeService({
  async getOwnedWorkspace(userId, conversationId) { return forgeWorkspaceService.get(userId, conversationId); },
  findByWorkspace: findRuntimeByWorkspace,
  insert: insertForgeRuntime,
  update: updateForgeRuntime,
  provider: unprovisionedRuntimeProvider,
  now: () => new Date().toISOString(),
});
