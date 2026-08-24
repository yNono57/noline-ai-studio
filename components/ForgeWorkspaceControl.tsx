"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Loader2 } from "lucide-react";
import type { ForgeProject } from "@/lib/forge/forge-store";
import type { ForgeWorkspaceView } from "@/lib/forge/workspace-foundation";
import { getForgeWorkspace, prepareForgeWorkspace } from "@/lib/forge/forge-client";

export function ForgeWorkspaceControl({ project, conversationId }: { project: ForgeProject | undefined; conversationId: string }) {
  const [workspace, setWorkspace] = useState<ForgeWorkspaceView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sourceKey = `${conversationId}:${project?.repository_identifier || ""}:${project?.default_branch || ""}`;
  const sourceKeyRef = useRef(sourceKey);
  sourceKeyRef.current = sourceKey;

  useEffect(() => {
    let active = true;
    setWorkspace(null); setError("");
    if (!conversationId || project?.repository_provider !== "github" || !project.repository_identifier || !project.default_branch) return () => { active = false; };
    setLoading(true);
    getForgeWorkspace(conversationId).then(({ workspace }) => { if (active) setWorkspace(workspace); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Workspace indisponible."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [conversationId, project?.default_branch, project?.repository_identifier, project?.repository_provider]);

  async function prepare() {
    if (!conversationId || loading) return;
    const requestedSource = sourceKey;
    setLoading(true); setError("");
    try { const result = await prepareForgeWorkspace(conversationId); if (sourceKeyRef.current === requestedSource) setWorkspace(result.workspace); }
    catch (caught) { if (sourceKeyRef.current === requestedSource) setError(caught instanceof Error ? caught.message : "Préparation impossible."); }
    finally { if (sourceKeyRef.current === requestedSource) setLoading(false); }
  }

  const configured = Boolean(conversationId && project?.repository_provider === "github" && project.repository_identifier && project.default_branch);
  return <details className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
    <summary className="flex cursor-pointer list-none items-center gap-2 font-black text-white"><Box className="h-4 w-4 text-noline-orange" />Workspace<span className="ml-auto text-[10px] text-noline-muted">{workspace?.status || "NON PRÉPARÉ"}</span></summary>
    <div className="mt-3 space-y-1 text-noline-muted">
      <p className="truncate">Repository : {workspace?.repository || project?.repository_identifier || "Non connecté"}</p>
      <p className="truncate">Branche : {workspace?.branch || project?.default_branch || "Non connectée"}</p>
      {workspace ? <p className="font-mono">Base : {workspace.baseCommitSha.slice(0, 12)}</p> : null}
      <p>Provider : {workspace?.provider || "metadata-only"}</p>
    </div>
    <button type="button" onClick={prepare} disabled={!configured || loading || workspace?.status === "READY"} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 font-black text-white disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{workspace?.status === "READY" ? "Workspace prêt" : "Préparer le workspace"}</button>
    {error ? <p role="alert" className="mt-2 text-red-300">{error}</p> : null}
  </details>;
}
