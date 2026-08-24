import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";
import type { ForgeGitHubConnection } from "./github-foundation";

type Row = { id: string; user_id: string; installation_id: number | string; account_id: number | string; account_login: string; account_type: "User" | "Organization"; status: "active" | "revoked" };

function map(row: Row): ForgeGitHubConnection {
  return { id: row.id, installationId: String(row.installation_id), accountId: String(row.account_id), accountLogin: row.account_login, accountType: row.account_type, status: row.status };
}

export async function getGitHubConnection(userId: string) {
  const data = await supabaseAdmin(`/rest/v1/github_connections?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc&limit=1`, { method: "GET" }) as Row[];
  return data[0] ? map(data[0]) : null;
}

export async function requireActiveGitHubConnection(userId: string) {
  const connection = await getGitHubConnection(userId);
  if (!connection || connection.status !== "active") throw new Error("GITHUB_CONNECTION_REQUIRED");
  return connection;
}

export async function upsertGitHubConnection(userId: string, input: Omit<ForgeGitHubConnection, "id">) {
  const existing = await supabaseAdmin(`/rest/v1/github_connections?installation_id=eq.${encodeURIComponent(input.installationId)}&select=user_id&limit=1`, { method: "GET" }) as Array<{ user_id: string }>;
  if (existing[0] && existing[0].user_id !== userId) throw new Error("GITHUB_INSTALLATION_OWNERSHIP_CONFLICT");
  const data = await supabaseAdmin("/rest/v1/github_connections?on_conflict=installation_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, installation_id: input.installationId, account_id: input.accountId, account_login: input.accountLogin, account_type: input.accountType, status: input.status }) }) as Row[];
  if (!data[0]) throw new Error("GITHUB_CONNECTION_SAVE_FAILED");
  return map(data[0]);
}

export async function revokeGitHubConnection(userId: string) {
  await supabaseAdmin(`/rest/v1/github_connections?user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ status: "revoked" }) });
}
