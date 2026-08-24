import "server-only";

import { FORGE_GITHUB_LIMITS, type ForgeGitHubBranch, type ForgeGitHubFile, type ForgeGitHubRepository, type ForgeGitHubSearchResult, type ForgeGitHubTreeEntry } from "./github-foundation";
import { createGitHubAppJwt, GitHubAppError } from "./github-app";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_REPOSITORIES = 100;
const MAX_BRANCHES = 100;
const MAX_TREE_ENTRIES = 1_000;

type InstallationToken = { token: string; expires_at: string };
type GitHubRepositoryResponse = { id: number; name: string; full_name: string; private: boolean; visibility?: string; default_branch: string; description: string | null; updated_at: string; owner: { login: string } };

async function github<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": API_VERSION, "User-Agent": "NOLINE-Forge", ...(init.headers || {}) }, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new GitHubAppError("NOT_FOUND", "Ressource GitHub introuvable ou non autorisée.");
    if (response.status === 401 || response.status === 403) throw new GitHubAppError("AUTHORIZATION", "GitHub a refusé cet accès en lecture seule.");
    throw new GitHubAppError("UPSTREAM", "GitHub est temporairement indisponible.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function getInstallationToken(installationId: string) {
  if (!/^\d+$/.test(installationId)) throw new GitHubAppError("AUTHORIZATION", "Installation GitHub invalide.");
  const result = await github<InstallationToken>(`/app/installations/${installationId}/access_tokens`, createGitHubAppJwt(), { method: "POST" });
  return result.token;
}

export async function getRepositoryInstallationToken(installationId: string, owner: string, repo: string) {
  if (!/^\d+$/.test(installationId) || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new GitHubAppError("AUTHORIZATION", "Repository GitHub invalide.");
  const result = await github<InstallationToken>(`/app/installations/${installationId}/access_tokens`, createGitHubAppJwt(), { method: "POST", body: JSON.stringify({ repositories: [repo], permissions: { contents: "read" } }) });
  const repository = await github<GitHubRepositoryResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, result.token);
  if (repository.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw new GitHubAppError("AUTHORIZATION", "Repository non autorise.");
  return result.token;
}

export async function getInstallationMetadata(installationId: string) {
  const data = await github<{ id: number; account: { id: number; login: string; type: "User" | "Organization" }; suspended_at: string | null }>(`/app/installations/${installationId}`, createGitHubAppJwt());
  return { installationId: String(data.id), accountId: String(data.account.id), accountLogin: data.account.login, accountType: data.account.type, status: data.suspended_at ? "revoked" as const : "active" as const };
}

function mapRepository(repo: GitHubRepositoryResponse): ForgeGitHubRepository & { visibility: string; description: string | null; updatedAt: string } {
  return { id: String(repo.id), owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private, visibility: repo.visibility || (repo.private ? "private" : "public"), description: repo.description, updatedAt: repo.updated_at };
}

export async function listInstallationRepositories(installationId: string) {
  const token = await getInstallationToken(installationId);
  const data = await github<{ repositories: GitHubRepositoryResponse[] }>(`/installation/repositories?per_page=${MAX_REPOSITORIES}`, token);
  return data.repositories.slice(0, MAX_REPOSITORIES).map(mapRepository);
}

async function authorizeRepository(installationId: string, owner: string, repo: string) {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new GitHubAppError("AUTHORIZATION", "Repository invalide.");
  const token = await getInstallationToken(installationId);
  const data = await github<GitHubRepositoryResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
  if (data.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw new GitHubAppError("AUTHORIZATION", "Repository non autorisé.");
  return { token, repository: mapRepository(data) };
}

export async function listRepositoryBranches(installationId: string, owner: string, repo: string): Promise<ForgeGitHubBranch[]> {
  const { token } = await authorizeRepository(installationId, owner, repo);
  const data = await github<Array<{ name: string; commit: { sha: string } }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${MAX_BRANCHES}`, token);
  return data.slice(0, MAX_BRANCHES).map((branch) => ({ name: branch.name, commitSha: branch.commit.sha }));
}

export async function listRepositoryTree(installationId: string, owner: string, repo: string, ref: string, path = ""): Promise<ForgeGitHubTreeEntry[]> {
  const { token } = await authorizeRepository(installationId, owner, repo);
  const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;
  const data = await github<Array<{ path: string; type: "file" | "dir"; sha: string; size: number }>>(endpoint, token);
  if (!Array.isArray(data)) throw new GitHubAppError("NOT_FOUND", "Ce chemin n’est pas un dossier.");
  if (data.length > MAX_TREE_ENTRIES) throw new GitHubAppError("LIMIT", "Ce dossier contient trop d’éléments.");
  return data.map((entry) => ({ path: entry.path, type: entry.type === "dir" ? "directory" : "file", sha: entry.sha, size: entry.type === "file" ? entry.size : null }));
}

export async function readRepositoryFile(installationId: string, owner: string, repo: string, ref: string, path: string): Promise<ForgeGitHubFile> {
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|rar|woff2?|ttf|eot|mp[34]|mov|avi|exe|dll|so|dylib)$/i.test(path)) throw new GitHubAppError("LIMIT", "Ce format binaire ou archive ne peut pas être ouvert.");
  const { token } = await authorizeRepository(installationId, owner, repo);
  const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;
  const data = await github<{ type: string; path: string; sha: string; size: number; encoding?: string; content?: string }>(endpoint, token);
  if (data.type !== "file" || data.encoding !== "base64" || !data.content) throw new GitHubAppError("LIMIT", "Ce contenu n’est pas un fichier texte lisible.");
  if (data.size > FORGE_GITHUB_LIMITS.maxFileBytes) throw new GitHubAppError("LIMIT", "Ce fichier dépasse la limite de 250 KB.");
  const buffer = Buffer.from(data.content.replace(/\s/g, ""), "base64");
  if (buffer.includes(0)) throw new GitHubAppError("LIMIT", "Les fichiers binaires ne peuvent pas être ouverts.");
  const content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return { path: data.path, sha: data.sha, size: data.size, content };
}

export async function searchRepository(installationId: string, owner: string, repo: string, query: string): Promise<ForgeGitHubSearchResult[]> {
  const clean = query.trim();
  if (clean.length < 2 || clean.length > 200) throw new GitHubAppError("LIMIT", "La recherche doit contenir entre 2 et 200 caractères.");
  const { token } = await authorizeRepository(installationId, owner, repo);
  const data = await github<{ items: Array<{ path: string; sha: string; repository: { full_name: string } }> }>(`/search/code?q=${encodeURIComponent(`${clean} repo:${owner}/${repo}`)}&per_page=${FORGE_GITHUB_LIMITS.maxSearchResults}`, token);
  return data.items.slice(0, FORGE_GITHUB_LIMITS.maxSearchResults).map((item) => ({ path: item.path, sha: item.sha, matches: [], repository: item.repository.full_name } as ForgeGitHubSearchResult & { repository: string }));
}
