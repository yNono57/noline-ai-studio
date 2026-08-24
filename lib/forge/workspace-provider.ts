import "server-only";

import type { ForgeWorkspaceProvider, ForgeWorkspaceStatus } from "./workspace-foundation";

export const metadataOnlyWorkspaceProvider: ForgeWorkspaceProvider = {
  name: "metadata-only",
  async createWorkspace() { return "READY"; },
  async getWorkspace(workspace) { return workspace; },
  async destroyWorkspace() {},
  async getStatus(workspace): Promise<ForgeWorkspaceStatus> { return workspace.status; },
};
