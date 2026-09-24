import type { ForgeGitHubBranch, ForgeGitHubConnection, ForgeGitHubFile, ForgeGitHubRepository, ForgeGitHubSearchResult, ForgeGitHubTreeEntry } from "./github-foundation";
import type { ForgeProject } from "./forge-store";
import { getAuthenticatedHeaders } from "../supabase-client";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await getAuthenticatedHeaders();
  if (!auth.Authorization) throw new Error("Votre session a expiré.");
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...auth } });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "GitHub est indisponible.");
  return data as T;
}

const query = (values: Record<string, string>) => new URLSearchParams(values).toString();
export const getGitHubConnectionClient = () => request<{ connection: ForgeGitHubConnection | null }>("/api/forge/github/connection");
export const beginGitHubInstall = () => request<{ url: string }>("/api/forge/github/install");
export const completeGitHubInstall = (completion: string) => request<{ connection: ForgeGitHubConnection }>("/api/forge/github/complete", { method: "POST", body: JSON.stringify({ completion }) });
export const disconnectGitHub = () => request<void>("/api/forge/github/connection", { method: "DELETE" });
export const listGitHubRepositories = () => request<{ repositories: Array<ForgeGitHubRepository & { visibility: string; description: string | null; updatedAt: string }> }>("/api/forge/github/repositories");
export const listGitHubBranches = (repository: string) => request<{ branches: ForgeGitHubBranch[] }>(`/api/forge/github/repository/branches?${query({ repository })}`);
export const listGitHubTree = (repository: string, ref: string, path = "") => request<{ entries: ForgeGitHubTreeEntry[] }>(`/api/forge/github/repository/tree?${query({ repository, ref, path })}`);
export const readGitHubFile = (repository: string, ref: string, path: string) => request<{ file: ForgeGitHubFile }>(`/api/forge/github/repository/file?${query({ repository, ref, path })}`);
export const searchGitHubRepository = (repository: string, q: string) => request<{ results: ForgeGitHubSearchResult[] }>(`/api/forge/github/repository/search?${query({ repository, q })}`);
export const associateGitHubRepository = (projectId: string, repository: string, branch: string) => request<{ project: ForgeProject }>(`/api/forge/projects/${encodeURIComponent(projectId)}/repository`, { method: "PATCH", body: JSON.stringify({ repository, branch }) });
