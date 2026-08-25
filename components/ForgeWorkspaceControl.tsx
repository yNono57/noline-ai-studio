"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Loader2, Play, Trash2 } from "lucide-react";
import type { ForgeProject } from "@/lib/forge/forge-store";
import type { ForgeWorkspaceView } from "@/lib/forge/workspace-foundation";
import type { ForgeRuntimeView } from "@/lib/forge/runtime-foundation";
import { createForgeRuntime, destroyForgeRuntime, getForgeRuntime, getForgeWorkspace, prepareForgeWorkspace } from "@/lib/forge/forge-client";
import { ForgeRuntimeDiagnostics } from "./ForgeRuntimeDiagnostics";
import { ForgeAgentRunnerPanel } from "./ForgeAgentRunnerPanel";

type AgentLaunchRequest = { id: string; objective: string };
export function ForgeWorkspaceControl({ project, conversationId, agentLaunchRequest, onAgentLaunchRequestHandled, onAgentActiveChange, onRuntimeReadyChange, onRuntimeChange, onConversationUpdated, onAgentPayloadChange, onAgentMessagesPersisted }: { project: ForgeProject | undefined; conversationId: string; agentLaunchRequest?: AgentLaunchRequest | null; onAgentLaunchRequestHandled?: (id: string) => void; onAgentActiveChange?: (active: boolean) => void; onRuntimeReadyChange?: (ready: boolean) => void; onRuntimeChange?: (runtime: ForgeRuntimeView | null) => void; onConversationUpdated?: (conversation: import("@/lib/forge/forge-store").ForgeConversation) => void; onAgentPayloadChange?: (payload: import("@/lib/forge/forge-client").ForgeAgentRunPayload | null) => void; onAgentMessagesPersisted?: (messages: import("@/lib/forge/forge-store").ForgeMessage[]) => void }) {
  const [workspace, setWorkspace] = useState<ForgeWorkspaceView | null>(null);
  const [runtime, setRuntime] = useState<ForgeRuntimeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
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

  useEffect(() => {
    let active = true;
    setRuntime(null);
    if (!conversationId || workspace?.status !== "READY") return () => { active = false; };
    getForgeRuntime(conversationId).then(({ runtime }) => { if (active) setRuntime(runtime); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Runtime indisponible."); });
    return () => { active = false; };
  }, [conversationId, workspace?.status, workspace?.workspaceId]);

  useEffect(() => { onRuntimeReadyChange?.(runtime?.status === "READY"); }, [onRuntimeReadyChange, runtime?.status]);
  useEffect(() => { onRuntimeChange?.(runtime); }, [onRuntimeChange, runtime]);

  async function prepare() {
    if (!conversationId || loading) return;
    const requestedSource = sourceKey;
    setLoading(true); setError("");
    try { const result = await prepareForgeWorkspace(conversationId); if (sourceKeyRef.current === requestedSource) setWorkspace(result.workspace); }
    catch (caught) { if (sourceKeyRef.current === requestedSource) setError(caught instanceof Error ? caught.message : "Préparation impossible."); }
    finally { if (sourceKeyRef.current === requestedSource) setLoading(false); }
  }

  async function startRuntime() {
    if (!conversationId || runtimeLoading || workspace?.status !== "READY") return;
    setRuntimeLoading(true); setError("");
    try { setRuntime((await createForgeRuntime(conversationId)).runtime); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Creation du runtime impossible."); }
    finally { setRuntimeLoading(false); }
  }

  async function destroyRuntime() {
    if (!conversationId || runtimeLoading || !runtime) return;
    setRuntimeLoading(true); setError("");
    try { setRuntime((await destroyForgeRuntime(conversationId)).runtime); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Destruction du runtime impossible."); }
    finally { setRuntimeLoading(false); }
  }

  const runtimeLabel = runtime?.status === "CREATING" ? "CRÉATION…" : runtime?.status === "EXPIRED" ? "EXPIRÉ" : runtime?.status === "DESTROYING" ? "DESTRUCTION…" : runtime?.status === "DESTROYED" ? "DÉTRUIT" : runtime?.status || "NON PROVISIONNÉ";
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
    <div className="mt-3 border-t border-white/10 pt-3 text-noline-muted">
      <div className="flex items-center justify-between gap-2"><span className="font-black text-white">Runtime</span><span className="text-[10px] font-black">{runtimeLabel}</span></div>
      <p className="mt-2">Provider : {runtime?.provider || "daytona"}</p>
      <p className="font-mono">Base : {(runtime?.baseCommitSha || workspace?.baseCommitSha || "—").slice(0, 12)}</p>
      {runtime?.expiresAt ? <p>Expiration : {new Date(runtime.expiresAt).toLocaleString("fr-FR")}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={startRuntime} disabled={runtimeLoading || workspace?.status !== "READY" || runtime?.status === "READY" || runtime?.status === "CREATING" || runtime?.status === "DESTROYING"} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-noline-orange px-3 py-2 font-black text-white disabled:opacity-40">
          {runtimeLoading || runtime?.status === "CREATING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{runtime?.status === "READY" ? "Runtime prêt" : "Démarrer le runtime"}
        </button>
        {runtime ? <button type="button" onClick={destroyRuntime} disabled={runtimeLoading || runtime.status === "DESTROYED" || runtime.status === "DESTROYING" || runtime.status === "CREATING"} aria-label="Détruire le runtime" className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 font-black text-white disabled:opacity-40"><Trash2 className="h-4 w-4" />Détruire</button> : null}
      </div>
      <p className="mt-2 text-[10px]">Les commandes et fichiers restent confinés au sandbox Daytona.</p>
      {runtime?.status === "READY" ? <ForgeRuntimeDiagnostics key={runtime.runtimeId} conversationId={conversationId} /> : null}
      {runtime?.status === "READY" ? <ForgeAgentRunnerPanel key={`agent-${runtime.runtimeId}`} conversationId={conversationId} launchRequest={agentLaunchRequest} onLaunchRequestHandled={onAgentLaunchRequestHandled} onActiveChange={onAgentActiveChange} onConversationUpdated={onConversationUpdated} onPayloadChange={onAgentPayloadChange} onMessagesPersisted={onAgentMessagesPersisted} /> : null}
    </div>
  </details>;
}
