import "server-only";

import { supabaseAdmin } from "../supabase-server";
import { ForgeWorkspaceError, type ForgeWorkspace, type ForgeWorkspaceStatus } from "./workspace-foundation";

type Row = { id: string; user_id: string; forge_project_id: string; conversation_id: string; repository: string; repository_owner: string; branch: string; base_commit_sha: string; status: ForgeWorkspaceStatus; provider: string; created_at: string; updated_at: string };
const fields = "id,user_id,forge_project_id,conversation_id,repository,repository_owner,branch,base_commit_sha,status,provider,created_at,updated_at";

function map(row: Row): ForgeWorkspace {
  return { workspaceId: row.id, userId: row.user_id, projectId: row.forge_project_id, conversationId: row.conversation_id, repository: row.repository, repositoryOwner: row.repository_owner, branch: row.branch, baseCommitSha: row.base_commit_sha, status: row.status, provider: row.provider, createdAt: row.created_at, updatedAt: row.updated_at };
}
function encode(value: string) { return encodeURIComponent(value); }
async function rows(path: string, init: RequestInit = {}) {
  try { return await supabaseAdmin(path, init) as Row[]; }
  catch { throw new ForgeWorkspaceError("PERSISTENCE", "La persistence du workspace Forge a échoué."); }
}

export async function findExactWorkspace(userId: string, conversationId: string, repository: string, branch: string, sha: string, provider: string) {
  const data = await rows(`/rest/v1/forge_workspaces?user_id=eq.${encode(userId)}&conversation_id=eq.${encode(conversationId)}&repository=eq.${encode(repository)}&branch=eq.${encode(branch)}&base_commit_sha=eq.${encode(sha)}&provider=eq.${encode(provider)}&select=${fields}&limit=1`, { method: "GET" });
  return data[0] ? map(data[0]) : null;
}

export async function findLatestWorkspaceForSource(userId: string, conversationId: string, repository: string, branch: string) {
  const data = await rows(`/rest/v1/forge_workspaces?user_id=eq.${encode(userId)}&conversation_id=eq.${encode(conversationId)}&repository=eq.${encode(repository)}&branch=eq.${encode(branch)}&select=${fields}&order=updated_at.desc&limit=1`, { method: "GET" });
  return data[0] ? map(data[0]) : null;
}

export async function insertCreatingWorkspace(input: Omit<ForgeWorkspace, "workspaceId" | "createdAt" | "updatedAt">) {
  const body = { user_id: input.userId, forge_project_id: input.projectId, conversation_id: input.conversationId, repository: input.repository, repository_owner: input.repositoryOwner, branch: input.branch, base_commit_sha: input.baseCommitSha, status: input.status, provider: input.provider };
  const data = await rows("/rest/v1/forge_workspaces?on_conflict=user_id,conversation_id,repository,branch,base_commit_sha,provider", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(body) });
  if (data[0]) return map(data[0]);
  const existing = await findExactWorkspace(input.userId, input.conversationId, input.repository, input.branch, input.baseCommitSha, input.provider);
  if (!existing) throw new ForgeWorkspaceError("PERSISTENCE", "Le workspace Forge n’a pas pu être créé.");
  return existing;
}

export async function updateWorkspaceStatus(userId: string, workspaceId: string, status: ForgeWorkspaceStatus) {
  const data = await rows(`/rest/v1/forge_workspaces?id=eq.${encode(workspaceId)}&user_id=eq.${encode(userId)}&select=${fields}`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!data[0]) throw new ForgeWorkspaceError("NOT_FOUND", "Workspace Forge introuvable ou inaccessible.");
  return map(data[0]);
}

export async function expireOtherConversationWorkspaces(userId: string, conversationId: string, workspaceId: string) {
  await rows(`/rest/v1/forge_workspaces?user_id=eq.${encode(userId)}&conversation_id=eq.${encode(conversationId)}&id=neq.${encode(workspaceId)}&status=in.(CREATING,READY)&select=${fields}`, { method: "PATCH", body: JSON.stringify({ status: "EXPIRED" }) });
}
