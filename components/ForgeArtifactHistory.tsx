"use client";

import { useEffect, useState } from "react";
import { ArchiveRestore, Download, GitBranch, GitCommit, GitPullRequest, Loader2, Upload } from "lucide-react";
import type { ForgeRunArtifact } from "@/lib/forge/agent-foundation";
import { listForgeArtifacts, runForgeArtifactAction } from "@/lib/forge/forge-client";

import { getForgeArtifactPublicationBlocker } from "@/lib/forge/artifact-publication";
export function ForgeArtifactHistory({ conversationId, runtimeReady, runtimeId }: { conversationId: string; runtimeReady: boolean; runtimeId: string | null }) {
  const [artifacts, setArtifacts] = useState<ForgeRunArtifact[]>([]);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setArtifacts([]); setMessage("");
    if (!conversationId) return () => { active = false; };
    listForgeArtifacts(conversationId).then(({ artifacts }) => { if (active) setArtifacts(artifacts); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Artifacts indisponibles."); });
    return () => { active = false; };
  }, [conversationId]);

  function replace(artifact: ForgeRunArtifact) { setArtifacts((current) => current.map((item) => item.artifactId === artifact.artifactId ? artifact : item)); }
  async function action(artifact: ForgeRunArtifact, input: Record<string, unknown>) {
    setWorking(artifact.artifactId); setMessage("");
    try { const result = await runForgeArtifactAction(conversationId, artifact.artifactId, input); replace(result.artifact); return result.artifact; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action Forge impossible."); return null; }
    finally { setWorking(""); }
  }
  function download(artifact: ForgeRunArtifact) {
    const url = URL.createObjectURL(new Blob([artifact.patch], { type: "text/x-diff;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `forge-${artifact.runId}.patch`; link.click(); URL.revokeObjectURL(url);
  }
  async function restore(artifact: ForgeRunArtifact) {
    const result = await action(artifact, { action: "restore" });
    if (result?.restoreStatus === "CONFLICT" && result.conflictFiles.length === 0 && window.confirm("La base Git diffère, mais le patch est applicable. Restaurer sur cette base après vérification ?")) await action(result, { action: "restore", allow_base_mismatch: true });
  }
  async function branch(artifact: ForgeRunArtifact) {
    const proposed = `forge/run-${artifact.runId.slice(0, 8)}`;
    const name = window.prompt("Nom de la branche Forge", proposed);
    if (name) await action(artifact, { action: "branch", branch: name });
  }
  async function commit(artifact: ForgeRunArtifact) {
    const commitMessage = window.prompt("Message du commit", artifact.objective ? artifact.objective.slice(0, 120) : `Forge: restore run ${artifact.runId.slice(0, 8)}`);
    if (commitMessage && window.confirm(`Créer ce commit ?\nBranche : ${artifact.branchName}\nFichiers :\n${artifact.changedFiles.join("\n")}\nRésumé : +${artifact.additions}/-${artifact.deletions}\nMessage : ${commitMessage}`)) await action(artifact, { action: "commit", message: commitMessage, confirmed: true });
  }
  async function push(artifact: ForgeRunArtifact) {
    if (window.confirm(`Push vers GitHub ?\nRepository : ${artifact.repository}\nBranche locale : ${artifact.branchName}\nBranche distante : ${artifact.branchName}\nCommit : ${artifact.commitSha}`)) await action(artifact, { action: "push", confirmed: true });
  }
  async function pullRequest(artifact: ForgeRunArtifact) {
    const title = window.prompt("Titre de la Pull Request", artifact.objective ? artifact.objective.slice(0, 120) : `Forge run ${artifact.runId.slice(0, 8)}`);
    if (!title) return;
    const fallback = `Forge AgentRun ${artifact.runId}\n\n${artifact.changedFiles.length} fichier(s), +${artifact.additions}/-${artifact.deletions}.`;
    const description = window.prompt("Description de la Pull Request", fallback);
    if (description !== null && window.confirm(`Créer la Pull Request ${artifact.remoteBranch} → ${artifact.sourceBranch} ?`)) await action(artifact, { action: "pull_request", title, description, confirmed: true });
  }
  if (!artifacts.length && !message) return null;
  return <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-xs font-black text-white"><ArchiveRestore className="h-4 w-4 text-noline-orange" />Travail précédent disponible<span className="ml-auto text-[10px] text-noline-muted">{artifacts.length}</span></summary>
    {message ? <p role="status" className="mt-2 text-xs text-amber-200">{message}</p> : null}
    <div className="mt-3 space-y-2">{artifacts.map((artifact) => {
      const publicationBlocker = getForgeArtifactPublicationBlocker(artifact);
      const activeWorktree = !publicationBlocker && runtimeReady && artifact.status === "READY" && artifact.restoreStatus === "RESTORED" && artifact.restoredRuntimeId === runtimeId;
      const needsRestore = artifact.status === "READY" && artifact.publicationStatus === "LOCAL" && !activeWorktree;
      const localRuntimeRequired = ["LOCAL", "BRANCHED", "COMMITTED"].includes(artifact.publicationStatus);
      const reason = publicationBlocker || (localRuntimeRequired && !runtimeReady ? "Runtime requis : démarrez ou recréez le runtime pour poursuivre les opérations Git locales." : needsRestore ? "Restaurez le patch vérifié dans le runtime actif avant de créer une branche." : "");
      return <article key={artifact.artifactId} className="min-w-0 rounded-md border border-white/10 bg-black/20 p-2 text-[10px] text-noline-muted">
      <div className="flex items-center gap-2"><strong className="text-white">{new Date(artifact.createdAt).toLocaleString("fr-FR")}</strong><span>{artifact.changedFiles.length} fichier(s)</span><span className="text-green-300">+{artifact.additions}</span><span className="text-red-300">-{artifact.deletions}</span></div>
      <p className="mt-1 break-all font-mono">{artifact.runId.slice(0, 8)} · {artifact.sourceBranch} · {artifact.baseCommitSha.slice(0, 12)}</p>
      <p className="mt-1 font-black text-noline-orange">Publication · {artifact.publicationStatus}</p>
      {reason ? <p className="mt-1 text-amber-200">{reason}</p> : null}
      {artifact.conflictFiles.length ? <p className="mt-1 text-red-200">Conflit de restauration : {artifact.conflictFiles.join(", ")}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <details className="rounded border border-white/10 px-2 py-1"><summary className="cursor-pointer text-white">Voir</summary><pre className="mt-2 max-h-56 max-w-full overflow-auto whitespace-pre-wrap font-mono">{artifact.patch || "Aucun changement Git."}</pre></details>
        <button type="button" onClick={() => download(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-white/10 px-2 text-white"><Download className="h-3 w-3" />Télécharger</button>
        {needsRestore ? <button type="button" disabled={!runtimeReady || working === artifact.artifactId} onClick={() => void restore(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-noline-orange/40 px-2 text-noline-orange disabled:opacity-40">{working === artifact.artifactId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}Restaurer</button> : null}
        {activeWorktree && artifact.publicationStatus === "LOCAL" ? <button type="button" disabled={working === artifact.artifactId} onClick={() => void branch(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-white/10 px-2 text-white disabled:opacity-40"><GitBranch className="h-3 w-3" />Créer une branche</button> : null}
        {artifact.publicationStatus === "BRANCHED" ? <button type="button" disabled={!activeWorktree || working === artifact.artifactId} onClick={() => void commit(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-white/10 px-2 text-white disabled:opacity-40"><GitCommit className="h-3 w-3" />Créer un commit</button> : null}
        {artifact.publicationStatus === "COMMITTED" ? <button type="button" disabled={!activeWorktree || working === artifact.artifactId} onClick={() => void push(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-white/10 px-2 text-white disabled:opacity-40"><Upload className="h-3 w-3" />Push vers GitHub</button> : null}
        {artifact.publicationStatus === "PUSHED" ? <button type="button" disabled={working === artifact.artifactId} onClick={() => void pullRequest(artifact)} className="flex min-h-8 items-center gap-1 rounded border border-white/10 px-2 text-white disabled:opacity-40"><GitPullRequest className="h-3 w-3" />Créer une Pull Request</button> : null}
        {artifact.pullRequestUrl ? <a href={artifact.pullRequestUrl} target="_blank" rel="noreferrer" className="flex min-h-8 items-center rounded border border-white/10 px-2 text-noline-orange">Ouvrir la PR</a> : null}
      </div>
    </article>; })}</div>
  </details>;
}
