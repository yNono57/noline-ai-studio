import type { ForgeConversation, ForgeMessage, ForgeProject } from "./forge-store";
import type { ForgeWorkspaceView } from "./workspace-foundation";
import type { ForgeRuntimeCommand, ForgeRuntimeCommandResult, ForgeRuntimeFile, ForgeRuntimeFileEntry, ForgeRuntimeGitDiff, ForgeRuntimeGitStatus, ForgeRuntimeView } from "./runtime-foundation";
import { getAuthenticatedHeaders } from "../supabase-client";

export class ForgeClientError extends Error {
  constructor(readonly status: number, message: string, readonly userMessage?: ForgeMessage) {
    super(message);
    this.name = "ForgeClientError";
  }
}

export async function listForgeProjects() {
  return request<{ projects: ForgeProject[]; model: string }>("/api/forge/projects");
}

export async function createForgeProject(input: { name: string; description?: string | null }) {
  return (await request<{ project: ForgeProject }>("/api/forge/projects", { method: "POST", body: JSON.stringify(input) })).project;
}

export async function setForgeProjectStatus(projectId: string, status: "active" | "archived") {
  return (await request<{ project: ForgeProject }>(`/api/forge/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify({ status }) })).project;
}
export async function deleteForgeProject(projectId: string) { await request<void>(`/api/forge/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" }); }

export async function listForgeConversations(projectId: string) {
  return (await request<{ conversations: ForgeConversation[] }>(`/api/forge/projects/${encodeURIComponent(projectId)}/conversations`)).conversations;
}

export async function createForgeConversation(projectId: string) {
  return (await request<{ conversation: ForgeConversation }>(`/api/forge/projects/${encodeURIComponent(projectId)}/conversations`, {
    method: "POST", body: JSON.stringify({ title: "Nouvelle session" })
  })).conversation;
}

export async function setForgeConversationStatus(conversationId: string, status: "active" | "archived") {
  return (await request<{ conversation: ForgeConversation }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify({ status }) })).conversation;
}
export async function deleteForgeConversation(conversationId: string) { await request<void>(`/api/forge/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" }); }

export async function listForgeMessages(conversationId: string) {
  return (await request<{ messages: ForgeMessage[] }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/messages`)).messages;
}

export function sendForgeMessage(conversationId: string, content: string, userMessageId?: string | null, contextPaths: string[] = []) {
  return request<{ user_message: ForgeMessage; assistant_message: ForgeMessage }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST", body: JSON.stringify({ content, context_paths: contextPaths, ...(userMessageId ? { user_message_id: userMessageId } : {}) })
  });
}

export function getForgeWorkspace(conversationId: string) {
  return request<{ workspace: ForgeWorkspaceView | null }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace`);
}

export function prepareForgeWorkspace(conversationId: string) {
  return request<{ workspace: ForgeWorkspaceView }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace`, { method: "POST" });
}

export function expireForgeWorkspace(conversationId: string) {
  return request<{ workspace: ForgeWorkspaceView }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace`, { method: "DELETE" });
}

export function getForgeRuntime(conversationId: string) {
  return request<{ runtime: ForgeRuntimeView | null }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime`);
}

export function createForgeRuntime(conversationId: string) {
  return request<{ runtime: ForgeRuntimeView }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime`, { method: "POST" });
}

export function destroyForgeRuntime(conversationId: string) {
  return request<{ runtime: ForgeRuntimeView }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime`, { method: "DELETE" });
}
export function readForgeRuntimeFile(conversationId: string, path: string) {
  return request<{ file: ForgeRuntimeFile }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/file?path=${encodeURIComponent(path)}`);
}
export function writeForgeRuntimeFile(conversationId: string, path: string, content: string) {
  return request<{ file: ForgeRuntimeFile }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/file`, { method: "PUT", body: JSON.stringify({ path, content }) });
}
export function listForgeRuntimeFiles(conversationId: string, path = ".") {
  return request<{ files: ForgeRuntimeFileEntry[] }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/files?path=${encodeURIComponent(path)}`);
}
export function executeForgeRuntimeCommand(conversationId: string, command: ForgeRuntimeCommand) {
  return request<{ result: ForgeRuntimeCommandResult }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/command`, { method: "POST", body: JSON.stringify(command) });
}
export function getForgeRuntimeGitStatus(conversationId: string) {
  return request<{ status: ForgeRuntimeGitStatus }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/git/status`);
}
export function getForgeRuntimeGitDiff(conversationId: string, limit?: number) {
  const query = limit === undefined ? "" : `?limit=${encodeURIComponent(String(limit))}`;
  return request<{ diff: ForgeRuntimeGitDiff }>(`/api/forge/conversations/${encodeURIComponent(conversationId)}/workspace/runtime/git/diff${query}`);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let auth = await getAuthenticatedHeaders();
  if (!auth.Authorization) throw sessionError();
  const run = (headers: Record<string, string>) => fetch(path, {
    ...init, cache: "no-store", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}), ...headers }
  });
  let response = await run(auth);
  if (response.status === 401) {
    auth = await getAuthenticatedHeaders(true);
    if (!auth.Authorization) throw sessionError();
    response = await run(auth);
  }
  const data: (T & { error?: string; user_message?: ForgeMessage }) | null = response.status === 204
    ? ({} as T & { error?: string; user_message?: ForgeMessage })
    : await response.json().catch(() => null) as (T & { error?: string; user_message?: ForgeMessage }) | null;
  if (!response.ok || !data) {
    if (response.status === 401) throw sessionError();
    throw new ForgeClientError(response.status, data?.error || "Impossible de contacter Forge.", data?.user_message);
  }
  return data;
}

function sessionError() { return new ForgeClientError(401, "Votre session a expiré. Reconnectez-vous."); }
