export type ForgeWorkspaceStatus = "CREATING" | "READY" | "ERROR" | "EXPIRED";
export type ForgeWorkspaceProviderName = string;

export type ForgeWorkspace = {
  workspaceId: string;
  userId: string;
  projectId: string;
  conversationId: string;
  repository: string;
  repositoryOwner: string;
  branch: string;
  baseCommitSha: string;
  status: ForgeWorkspaceStatus;
  provider: ForgeWorkspaceProviderName;
  createdAt: string;
  updatedAt: string;
};

export type ForgeWorkspaceView = Omit<ForgeWorkspace, "userId">;

export interface ForgeWorkspaceProvider {
  readonly name: ForgeWorkspaceProviderName;
  createWorkspace(workspace: ForgeWorkspace): Promise<ForgeWorkspaceStatus>;
  getWorkspace(workspace: ForgeWorkspace): Promise<ForgeWorkspace | null>;
  destroyWorkspace(workspace: ForgeWorkspace): Promise<void>;
  getStatus(workspace: ForgeWorkspace): Promise<ForgeWorkspaceStatus>;
}

export class ForgeWorkspaceError extends Error {
  readonly code: "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "AUTHORIZATION" | "PERSISTENCE";

  constructor(code: "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "AUTHORIZATION" | "PERSISTENCE", message: string) {
    super(message);
    this.name = "ForgeWorkspaceError";
    this.code = code;
  }
}

export function publicWorkspace(workspace: ForgeWorkspace): ForgeWorkspaceView {
  return {
    workspaceId: workspace.workspaceId, projectId: workspace.projectId, conversationId: workspace.conversationId,
    repository: workspace.repository, repositoryOwner: workspace.repositoryOwner, branch: workspace.branch,
    baseCommitSha: workspace.baseCommitSha, status: workspace.status, provider: workspace.provider,
    createdAt: workspace.createdAt, updatedAt: workspace.updatedAt,
  };
}

export function parseWorkspaceRepository(repository: string) {
  const [owner, name, extra] = repository.split("/");
  if (!owner || !name || extra || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new ForgeWorkspaceError("INVALID_INPUT", "Repository Forge invalide.");
  }
  return { owner, name };
}

type ForgeGitHubBranch = { name: string; commitSha: string };

type Conversation = { id: string; forge_project_id: string };
type Project = { id: string; repository_provider: string | null; repository_identifier: string | null; default_branch: string | null };

export type ForgeWorkspaceServiceDependencies = {
  getConversation(userId: string, conversationId: string): Promise<Conversation>;
  getProject(userId: string, projectId: string): Promise<Project>;
  getInstallationId(userId: string): Promise<string>;
  listBranches(installationId: string, owner: string, repository: string): Promise<ForgeGitHubBranch[]>;
  findExact(userId: string, conversationId: string, repository: string, branch: string, sha: string, provider: string): Promise<ForgeWorkspace | null>;
  findLatestForSource(userId: string, conversationId: string, repository: string, branch: string): Promise<ForgeWorkspace | null>;
  insertCreating(input: Omit<ForgeWorkspace, "workspaceId" | "createdAt" | "updatedAt">): Promise<ForgeWorkspace>;
  updateStatus(userId: string, workspaceId: string, status: ForgeWorkspace["status"]): Promise<ForgeWorkspace>;
  expireOtherSources(userId: string, conversationId: string, workspaceId: string): Promise<void>;
  provider: ForgeWorkspaceProvider;
};

export function createForgeWorkspaceService(deps: ForgeWorkspaceServiceDependencies) {
  async function source(userId: string, conversationId: string) {
    if (!userId.trim()) throw new ForgeWorkspaceError("UNAUTHENTICATED", "Authentification requise.");
    if (!conversationId.trim()) throw new ForgeWorkspaceError("INVALID_INPUT", "conversationId est requis.");
    const conversation = await deps.getConversation(userId, conversationId);
    const project = await deps.getProject(userId, conversation.forge_project_id);
    if (project.repository_provider !== "github" || !project.repository_identifier || !project.default_branch) {
      throw new ForgeWorkspaceError("INVALID_INPUT", "Associez un repository GitHub et une branche à ce projet.");
    }
    const repository = parseWorkspaceRepository(project.repository_identifier);
    const installationId = await deps.getInstallationId(userId);
    const branches = await deps.listBranches(installationId, repository.owner, repository.name);
    const branch = branches.find((item) => item.name === project.default_branch);
    if (!branch) throw new ForgeWorkspaceError("AUTHORIZATION", "Branche GitHub introuvable ou non autorisée.");
    return { conversation, project, repository, branch };
  }

  async function prepare(userId: string, conversationId: string) {
    const current = await source(userId, conversationId);
    const repository = `${current.repository.owner}/${current.repository.name}`;
    // Idempotence: reuse the same conversation/repository/branch/SHA/provider tuple.
    let workspace = await deps.findExact(userId, conversationId, repository, current.branch.name, current.branch.commitSha, deps.provider.name);
    if (workspace?.status === "READY") return workspace;
    if (workspace) workspace = await deps.updateStatus(userId, workspace.workspaceId, "CREATING");
    else workspace = await deps.insertCreating({
      userId,
      projectId: current.project.id,
      conversationId,
      repository,
      repositoryOwner: current.repository.owner,
      branch: current.branch.name,
      baseCommitSha: current.branch.commitSha,
      status: "CREATING",
      provider: deps.provider.name,
    });
    try {
      const status = await deps.provider.createWorkspace(workspace);
      const ready = await deps.updateStatus(userId, workspace.workspaceId, status);
      await deps.expireOtherSources(userId, conversationId, ready.workspaceId);
      return ready;
    } catch (error) {
      await deps.updateStatus(userId, workspace.workspaceId, "ERROR");
      throw error;
    }
  }

  async function get(userId: string, conversationId: string) {
    const current = await source(userId, conversationId);
    const repository = `${current.repository.owner}/${current.repository.name}`;
    const workspace = await deps.findLatestForSource(userId, conversationId, repository, current.branch.name);
    if (!workspace) return null;
    const providerWorkspace = await deps.provider.getWorkspace(workspace);
    if (!providerWorkspace) return null;
    const status = await deps.provider.getStatus(providerWorkspace);
    return status === workspace.status ? workspace : deps.updateStatus(userId, workspace.workspaceId, status);
  }

  async function destroy(userId: string, conversationId: string) {
    const workspace = await get(userId, conversationId);
    if (!workspace) return null;
    await deps.provider.destroyWorkspace(workspace);
    return deps.updateStatus(userId, workspace.workspaceId, "EXPIRED");
  }

  return { prepare, get, destroy };
}
