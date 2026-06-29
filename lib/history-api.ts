import { getAuthenticatedHeaders } from "./supabase-client";

export async function deleteRemoteHistoryRecord(id: string) {
  return authenticatedDelete(`/api/history/${encodeURIComponent(id)}`);
}

export async function deleteAllRemoteHistory() {
  return authenticatedDelete("/api/history");
}

async function authenticatedDelete(url: string) {
  let headers = await getAuthenticatedHeaders();
  let response = await fetch(url, { method: "DELETE", headers });

  if (response.status === 401) {
    headers = await getAuthenticatedHeaders(true);
    response = await fetch(url, { method: "DELETE", headers });
  }

  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Suppression impossible.");
  }
}
