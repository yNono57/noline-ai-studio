/* eslint-disable @typescript-eslint/no-require-imports */
const workspaceAssert = require("node:assert/strict");
const workspaceTest = require("node:test");
const { createForgeWorkspaceService, ForgeWorkspaceError, publicWorkspace } = require("../lib/forge/workspace-foundation.ts");

function harness() {
  let project = { id: "project-a", repository_provider: "github", repository_identifier: "owner/repo", default_branch: "main" };
  let branches = [{ name: "main", commitSha: "a".repeat(40) }, { name: "feature", commitSha: "b".repeat(40) }];
  const workspaces: Array<Record<string, unknown>> = [];
  const provider = {
    name: "metadata-only",
    async createWorkspace() { return "READY"; },
    async getWorkspace(workspace: unknown) { return workspace; },
    async destroyWorkspace() {},
    async getStatus(workspace: { status: string }) { return workspace.status; },
  };
  const deps = {
    async getConversation(userId: string, conversationId: string) {
      if (userId !== "user-a" || conversationId !== "conversation-a") throw new ForgeWorkspaceError("NOT_FOUND", "Conversation inaccessible.");
      return { id: conversationId, forge_project_id: project.id };
    },
    async getProject(userId: string, projectId: string) {
      if (userId !== "user-a" || projectId !== project.id) throw new ForgeWorkspaceError("NOT_FOUND", "Projet inaccessible.");
      return project;
    },
    async getInstallationId() { return "123"; },
    async listBranches(_installationId: string, owner: string, repository: string) {
      if (`${owner}/${repository}` === "owner/forbidden") throw new ForgeWorkspaceError("AUTHORIZATION", "Repository non autorisé.");
      return branches;
    },
    async findExact(userId: string, conversationId: string, repository: string, branch: string, sha: string, providerName: string) {
      return workspaces.find((item) => item.userId === userId && item.conversationId === conversationId && item.repository === repository && item.branch === branch && item.baseCommitSha === sha && item.provider === providerName) || null;
    },
    async findLatestForSource(userId: string, conversationId: string, repository: string, branch: string) {
      return [...workspaces].reverse().find((item) => item.userId === userId && item.conversationId === conversationId && item.repository === repository && item.branch === branch) || null;
    },
    async insertCreating(input: Record<string, unknown>) {
      const workspace = { ...input, workspaceId: `workspace-${workspaces.length + 1}`, createdAt: "2026-08-24T00:00:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z" };
      workspaces.push(workspace); return workspace;
    },
    async updateStatus(_userId: string, workspaceId: string, status: string) {
      const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
      if (!workspace) throw new Error("missing workspace");
      workspace.status = status; return workspace;
    },
    async expireOtherSources(_userId: string, _conversationId: string, workspaceId: string) {
      for (const workspace of workspaces) if (workspace.workspaceId !== workspaceId && ["CREATING", "READY"].includes(String(workspace.status))) workspace.status = "EXPIRED";
    },
    provider,
  };
  return { service: createForgeWorkspaceService(deps), workspaces, setProject(next: typeof project) { project = next; }, setBranches(next: typeof branches) { branches = next; } };
}

workspaceTest("un utilisateur non authentifié est refusé", async () => {
  await workspaceAssert.rejects(() => harness().service.prepare("", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "UNAUTHENTICATED");
});

workspaceTest("la conversation d’un autre utilisateur est refusée", async () => {
  await workspaceAssert.rejects(() => harness().service.prepare("user-b", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "NOT_FOUND");
});

workspaceTest("un repository non autorisé est refusé", async () => {
  const target = harness(); target.setProject({ id: "project-a", repository_provider: "github", repository_identifier: "owner/forbidden", default_branch: "main" });
  await workspaceAssert.rejects(() => target.service.prepare("user-a", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "AUTHORIZATION");
});

workspaceTest("une branche inexistante est refusée", async () => {
  const target = harness(); target.setProject({ id: "project-a", repository_provider: "github", repository_identifier: "owner/repo", default_branch: "missing" });
  await workspaceAssert.rejects(() => target.service.prepare("user-a", "conversation-a"), (error: unknown) => (error as { code?: string }).code === "AUTHORIZATION");
});

workspaceTest("le workspace fige le SHA exact et la deuxième création est idempotente", async () => {
  const target = harness();
  const first = await target.service.prepare("user-a", "conversation-a");
  const second = await target.service.prepare("user-a", "conversation-a");
  workspaceAssert.equal(first.baseCommitSha, "a".repeat(40));
  workspaceAssert.equal(second.workspaceId, first.workspaceId);
  workspaceAssert.equal(target.workspaces.length, 1);
});

workspaceTest("un changement de branche crée un workspace distinct", async () => {
  const target = harness(); const first = await target.service.prepare("user-a", "conversation-a");
  target.setProject({ id: "project-a", repository_provider: "github", repository_identifier: "owner/repo", default_branch: "feature" });
  const second = await target.service.prepare("user-a", "conversation-a");
  workspaceAssert.notEqual(second.workspaceId, first.workspaceId); workspaceAssert.equal(second.baseCommitSha, "b".repeat(40)); workspaceAssert.equal(first.status, "EXPIRED");
});

workspaceTest("un changement de repository crée un workspace distinct", async () => {
  const target = harness(); const first = await target.service.prepare("user-a", "conversation-a");
  target.setProject({ id: "project-a", repository_provider: "github", repository_identifier: "other/repo", default_branch: "main" });
  target.setBranches([{ name: "main", commitSha: "c".repeat(40) }]);
  const second = await target.service.prepare("user-a", "conversation-a");
  workspaceAssert.notEqual(second.workspaceId, first.workspaceId); workspaceAssert.equal(second.repository, "other/repo"); workspaceAssert.equal(first.status, "EXPIRED");
});

workspaceTest("un déplacement du HEAD ne modifie pas silencieusement la base existante", async () => {
  const target = harness(); const first = await target.service.prepare("user-a", "conversation-a");
  target.setBranches([{ name: "main", commitSha: "d".repeat(40) }]);
  const second = await target.service.prepare("user-a", "conversation-a");
  workspaceAssert.equal(first.baseCommitSha, "a".repeat(40)); workspaceAssert.equal(second.baseCommitSha, "d".repeat(40)); workspaceAssert.notEqual(second.workspaceId, first.workspaceId);
});

workspaceTest("la réponse client ne contient aucun user id, token ou secret", async () => {
  const workspace = await harness().service.prepare("user-a", "conversation-a");
  const serialized = JSON.stringify(publicWorkspace({ ...workspace, userId: "user-a" }));
  workspaceAssert.doesNotMatch(serialized, /user-a|token|secret|private.?key/i);
});
