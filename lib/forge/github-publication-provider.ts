import "server-only";

import { createGitHubAppJwt, GitHubAppError } from "./github-app";
import { requireActiveGitHubConnection } from "./github-store";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";

type InstallationToken = { token: string };
type Repository = { full_name: string; owner: { login: string } };
type PullRequest = { number: number; html_url: string; head: { ref: string }; base: { ref: string }; created_at: string };

function repositoryParts(repository: string) {
  const [owner, repo, extra] = repository.split("/");
  if (!owner || !repo || extra || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new GitHubAppError("AUTHORIZATION", "Repository GitHub invalide.");
  return { owner, repo };
}
function branchPath(branch: string) { return branch.split("/").map(encodeURIComponent).join("/"); }
async function request<T>(path: string, token: string, init: RequestInit = {}, allowNotFound = false): Promise<T | null> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": API_VERSION, "User-Agent": "NOLINE-Forge-Publication", ...(init.headers || {}) }, cache: "no-store" });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new GitHubAppError("AUTHORIZATION", "L’autorisation GitHub d’écriture est requise.");
    if (response.status === 404) throw new GitHubAppError("NOT_FOUND", "Repository ou ressource GitHub introuvable.");
    throw new GitHubAppError("UPSTREAM", `GitHub a refusé l’opération (HTTP ${response.status}).`);
  }
  return response.status === 204 ? null : response.json() as Promise<T>;
}
async function tokenFor(userId: string, repository: string, permissions: Record<string, "read" | "write">) {
  const { owner, repo } = repositoryParts(repository);
  const connection = await requireActiveGitHubConnection(userId);
  const result = await request<InstallationToken>(`/app/installations/${connection.installationId}/access_tokens`, createGitHubAppJwt(), { method: "POST", body: JSON.stringify({ repositories: [repo], permissions }) });
  if (!result?.token) throw new GitHubAppError("AUTHORIZATION", "Jeton GitHub d’installation indisponible.");
  const authorized = await request<Repository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, result.token);
  if (!authorized || authorized.full_name.toLowerCase() !== repository.toLowerCase()) throw new GitHubAppError("AUTHORIZATION", "Repository GitHub non autorisé.");
  return { token: result.token, owner, repo, ownerLogin: authorized.owner.login };
}

export type GitHubPublicationProvider = {
  preparePush(userId: string, repository: string, branch: string): Promise<{ username: string; password: string; remoteSha: string | null }>;
  createPullRequest(userId: string, input: { repository: string; head: string; base: string; title: string; body: string }): Promise<{ number: number; url: string; createdAt: string }>;
};

async function findPullRequest(token: string, owner: string, repo: string, ownerLogin: string, head: string, base: string) {
  const query = `state=open&head=${encodeURIComponent(`${ownerLogin}:${head}`)}&base=${encodeURIComponent(base)}&per_page=1`;
  const found = await request<PullRequest[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${query}`, token);
  return found?.[0] || null;
}

export const githubPublicationProvider: GitHubPublicationProvider = {
  async preparePush(userId, repository, branch) {
    const { token, owner, repo } = await tokenFor(userId, repository, { contents: "write" });
    const ref = await request<{ object: { sha: string } }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${branchPath(branch)}`, token, {}, true);
    return { username: "x-access-token", password: token, remoteSha: ref?.object.sha || null };
  },
  async createPullRequest(userId, input) {
    const { token, owner, repo, ownerLogin } = await tokenFor(userId, input.repository, { contents: "read", pull_requests: "write" });
    const existing = await findPullRequest(token, owner, repo, ownerLogin, input.head, input.base);
    if (existing) return { number: existing.number, url: existing.html_url, createdAt: existing.created_at };
    try {
      const created = await request<PullRequest>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, token, { method: "POST", body: JSON.stringify({ head: input.head, base: input.base, title: input.title, body: input.body }) });
      if (!created) throw new GitHubAppError("UPSTREAM", "GitHub n’a retourné aucune Pull Request.");
      return { number: created.number, url: created.html_url, createdAt: created.created_at };
    } catch (error) {
      const raced = await findPullRequest(token, owner, repo, ownerLogin, input.head, input.base).catch(() => null);
      if (raced) return { number: raced.number, url: raced.html_url, createdAt: raced.created_at };
      throw error;
    }
  },
};