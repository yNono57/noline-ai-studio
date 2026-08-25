import "server-only";

import { supabaseAdmin } from "../supabase-server";
import { ForgeRuntimeError, type ForgeRuntime, type ForgeRuntimeStatus, type RuntimeUpdate } from "./runtime-foundation";

type Row = { id: string; workspace_id: string; user_id: string; provider: string; provider_runtime_id: string | null; status: ForgeRuntimeStatus; base_commit_sha: string; created_at: string; updated_at: string; ready_at: string | null; expires_at: string | null; last_activity_at: string | null; error_code: string | null };
const fields = "id,workspace_id,user_id,provider,provider_runtime_id,status,base_commit_sha,created_at,updated_at,ready_at,expires_at,last_activity_at,error_code";
function encode(value: string) { return encodeURIComponent(value); }
function map(row: Row): ForgeRuntime { return { runtimeId: row.id, workspaceId: row.workspace_id, userId: row.user_id, provider: row.provider, providerRuntimeId: row.provider_runtime_id, status: row.status, baseCommitSha: row.base_commit_sha, createdAt: row.created_at, updatedAt: row.updated_at, readyAt: row.ready_at, expiresAt: row.expires_at, lastActivityAt: row.last_activity_at, errorCode: row.error_code }; }
async function rows(path: string, init: RequestInit = {}) { try { return await supabaseAdmin(path, init) as Row[]; } catch { throw new ForgeRuntimeError("PERSISTENCE", "La persistence du runtime Forge a échoué."); } }

export async function findRuntimeByWorkspace(userId: string, workspaceId: string, provider: string) {
  const data = await rows(`/rest/v1/forge_workspace_runtimes?user_id=eq.${encode(userId)}&workspace_id=eq.${encode(workspaceId)}&provider=eq.${encode(provider)}&select=${fields}&limit=1`, { method: "GET" });
  return data[0] ? map(data[0]) : null;
}

export async function insertForgeRuntime(input: Omit<ForgeRuntime, "runtimeId" | "createdAt" | "updatedAt">) {
  const body = { workspace_id: input.workspaceId, user_id: input.userId, provider: input.provider, provider_runtime_id: input.providerRuntimeId, status: input.status, base_commit_sha: input.baseCommitSha, ready_at: input.readyAt, expires_at: input.expiresAt, last_activity_at: input.lastActivityAt, error_code: input.errorCode };
  const data = await rows("/rest/v1/forge_workspace_runtimes?on_conflict=workspace_id,provider", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(body) });
  if (data[0]) return { runtime: map(data[0]), created: true };
  const existing = await findRuntimeByWorkspace(input.userId, input.workspaceId, input.provider);
  if (!existing) throw new ForgeRuntimeError("PERSISTENCE", "Le runtime Forge n’a pas pu être créé.");
  return { runtime: existing, created: false };
}

export async function claimForgeRuntimeForReprovision(userId: string, runtimeId: string, lastActivityAt: string) {
  const data = await rows(`/rest/v1/forge_workspace_runtimes?id=eq.${encode(runtimeId)}&user_id=eq.${encode(userId)}&status=in.(ERROR,EXPIRED,DESTROYED)&select=${fields}`, { method: "PATCH", body: JSON.stringify({ status: "CREATING", ready_at: null, expires_at: null, last_activity_at: lastActivityAt, error_code: null }) });
  return data[0] ? map(data[0]) : null;
}
export async function updateForgeRuntime(userId: string, runtimeId: string, input: RuntimeUpdate) {
  const body = { ...(input.providerRuntimeId !== undefined ? { provider_runtime_id: input.providerRuntimeId } : {}), ...(input.status !== undefined ? { status: input.status } : {}), ...(input.readyAt !== undefined ? { ready_at: input.readyAt } : {}), ...(input.expiresAt !== undefined ? { expires_at: input.expiresAt } : {}), ...(input.lastActivityAt !== undefined ? { last_activity_at: input.lastActivityAt } : {}), ...(input.errorCode !== undefined ? { error_code: input.errorCode } : {}) };
  const data = await rows(`/rest/v1/forge_workspace_runtimes?id=eq.${encode(runtimeId)}&user_id=eq.${encode(userId)}&select=${fields}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!data[0]) throw new ForgeRuntimeError("NOT_FOUND", "Runtime Forge introuvable ou inaccessible.");
  return map(data[0]);
}
