export const FORGE_SESSION_RESTORE_KEY = "noline.forge.active-session.v1";
export type ForgeSessionRestore = { projectId: string; conversationId: string };
type RestoreStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readForgeSessionRestore(storage: RestoreStorage | null): ForgeSessionRestore | null {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(FORGE_SESSION_RESTORE_KEY) || "null") as Record<string, unknown> | null;
    if (!value || typeof value.projectId !== "string" || typeof value.conversationId !== "string" || !value.projectId.trim() || !value.conversationId.trim()) return null;
    return { projectId: value.projectId, conversationId: value.conversationId };
  } catch { return null; }
}

export function saveForgeSessionRestore(storage: RestoreStorage | null, selection: ForgeSessionRestore) {
  if (!storage || !selection.projectId.trim() || !selection.conversationId.trim()) return;
  try { storage.setItem(FORGE_SESSION_RESTORE_KEY, JSON.stringify(selection)); } catch { /* Storage can be unavailable in private browsing. */ }
}

export function clearForgeSessionRestore(storage: RestoreStorage | null) {
  try { storage?.removeItem(FORGE_SESSION_RESTORE_KEY); } catch { /* Storage can be unavailable in private browsing. */ }
}

export function resolveForgeSessionRestore<TProject extends { id: string; status: string }, TConversation extends { id: string; forge_project_id: string; status: string }>(selection: ForgeSessionRestore | null, projects: TProject[], conversations?: TConversation[]) {
  if (!selection) return { projectId: "", conversationId: "", valid: false };
  const project = projects.find((item) => item.id === selection.projectId && item.status === "active");
  if (!project) return { projectId: "", conversationId: "", valid: false };
  if (!conversations) return { projectId: project.id, conversationId: selection.conversationId, valid: true };
  const conversation = conversations.find((item) => item.id === selection.conversationId && item.forge_project_id === project.id && item.status === "active");
  return conversation ? { projectId: project.id, conversationId: conversation.id, valid: true } : { projectId: "", conversationId: "", valid: false };
}
