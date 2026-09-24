"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, File, Folder, Github, Loader2, Plus, Search, Unplug, X } from "lucide-react";
import type { ForgeGitHubFile, ForgeGitHubRepository, ForgeGitHubTreeEntry } from "@/lib/forge/github-foundation";
import type { ForgeProject } from "@/lib/forge/forge-store";
import { associateGitHubRepository, beginGitHubInstall, completeGitHubInstall, disconnectGitHub, getGitHubConnectionClient, listGitHubBranches, listGitHubRepositories, listGitHubTree, readGitHubFile, searchGitHubRepository } from "@/lib/forge/github-client";

type Props = { project: ForgeProject | undefined; conversationId: string; contextFiles: ForgeGitHubFile[]; onProject: (project: ForgeProject) => void; onContext: (files: ForgeGitHubFile[]) => void };

export function ForgeGitHubPanel({ project, conversationId, contextFiles, onProject, onContext }: Props) {
  const [connection, setConnection] = useState<{ accountLogin: string; status: string } | null>(null);
  const [repositories, setRepositories] = useState<Array<ForgeGitHubRepository & { visibility: string }>>([]);
  const [repository, setRepository] = useState(project?.repository_identifier || "");
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState(project?.default_branch || "");
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<ForgeGitHubTreeEntry[]>([]);
  const [preview, setPreview] = useState<ForgeGitHubFile | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ path: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("github");
    const completion = params.get("github_completion");
    const clearCallback = () => {
      params.delete("github");
      params.delete("github_completion");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    };
    if (status === "complete" && completion) {
      setBusy(true);
      setError("Autorisation GitHub reçue. Finalisation sécurisée en cours…");
      completeGitHubInstall(completion)
        .then(({ connection }) => { setConnection(connection); setError(""); })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "La connexion GitHub n’a pas pu être finalisée. Réessayez."))
        .finally(() => { setBusy(false); clearCallback(); });
      return;
    }
    if (status === "cancelled") setError("Autorisation GitHub annulée. Vous pouvez réessayer quand vous le souhaitez.");
    else if (status === "failed") setError("Le callback GitHub a échoué ou a expiré. Relancez la connexion depuis Forge.");
    getGitHubConnectionClient()
      .then(({ connection }) => setConnection(connection?.status === "active" ? connection : null))
      .catch(() => setError("Impossible de vérifier la connexion GitHub. Vérifiez votre session puis réessayez."));
    if (status) clearCallback();
  }, []);
  useEffect(() => { setRepository(project?.repository_identifier || ""); setBranch(project?.default_branch || ""); }, [project?.id, project?.repository_identifier, project?.default_branch]);
  useEffect(() => { if (!connection) return; listGitHubRepositories().then(({ repositories }) => setRepositories(repositories)).catch((caught) => setError(caught.message)); }, [connection]);
  useEffect(() => { if (!repository) { setBranches([]); setEntries([]); return; } listGitHubBranches(repository).then(({ branches }) => { const names = branches.map((item) => item.name); setBranches(names); setBranch((current) => names.includes(current) ? current : ""); }).catch((caught) => { setBranches([]); setBranch(""); setEntries([]); setError(caught.message); }); }, [repository]);
  useEffect(() => { if (!repository || !branch) { setEntries([]); return; } setBusy(true); setError(""); setEntries([]); listGitHubTree(repository, branch, path).then(({ entries }) => setEntries(entries)).catch((caught) => { setEntries([]); setError(caught.message); }).finally(() => setBusy(false)); }, [repository, branch, path]);

  async function connect() { setBusy(true); setError("Ouverture de l’autorisation GitHub…"); try { const { url } = await beginGitHubInstall(); window.location.assign(url); } catch (caught) { setBusy(false); setError(caught instanceof Error ? caught.message : "Connexion GitHub impossible. Réessayez."); } }
  function resetBrowserToProject() { setRepository(project?.repository_identifier || ""); setBranch(project?.default_branch || ""); setPath(""); setEntries([]); setPreview(null); setResults([]); setSearched(false); }
  async function chooseRepository(value: string) {
    if (value !== repository) onContext([]); setRepository(value); setPath(""); setEntries([]); setPreview(null); setResults([]); setSearched(false); setError("");
    const item = repositories.find((repo) => repo.fullName === value);
    const nextBranch = item?.defaultBranch || "";
    setBranch(nextBranch);
    if (project && value && nextBranch) {
      try { const { project: updated } = await associateGitHubRepository(project.id, value, nextBranch); onProject(updated); }
      catch (caught) { resetBrowserToProject(); setError(caught instanceof Error ? caught.message : "Association impossible."); }
    }
  }
  async function saveSelection(nextBranch = branch) { if (!project || !repository || !nextBranch) return; try { const { project: updated } = await associateGitHubRepository(project.id, repository, nextBranch); onProject(updated); } catch (caught) { resetBrowserToProject(); setError(caught instanceof Error ? caught.message : "Association impossible."); } }
  async function openFile(filePath: string) { setBusy(true); setError(""); setPreview(null); try { const { file } = await readGitHubFile(repository, branch, filePath); setPreview(file); } catch (caught) { setPreview(null); setError(caught instanceof Error ? caught.message : "Lecture impossible."); } finally { setBusy(false); } }
  function addContext() { if (!preview || contextFiles.some((file) => file.path === preview.path)) return; if (!conversationId) { setError("Créez ou sélectionnez une session Forge avant d’ajouter un fichier au contexte."); return; } const total = contextFiles.reduce((sum, file) => sum + file.content.length, 0) + preview.content.length; if (contextFiles.length >= 12 || total > 120000) { setError("Limite du contexte atteinte : 12 fichiers et 120 000 caractères maximum."); return; } setError(""); onContext([...contextFiles, preview]); }
  async function runSearch(event: React.FormEvent) { event.preventDefault(); if (!search.trim()) return; setBusy(true); setError(""); setResults([]); setSearched(false); try { const { results } = await searchGitHubRepository(repository, search.trim()); setResults(results); setSearched(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "Recherche indisponible."); } finally { setBusy(false); } }

  if (!connection) return <section aria-label="Intégration GitHub" className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center gap-2 text-sm font-black text-white"><Github className="h-4 w-4 text-noline-orange" />{busy ? "Autorisation GitHub en cours" : "GitHub non connecté"}</div><button type="button" onClick={connect} disabled={busy} className="mt-3 w-full rounded-md bg-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-60">{busy ? "Connexion en cours…" : "Connecter GitHub"}</button>{error ? <p role="status" className="mt-2 text-xs text-amber-200">{error}</p> : null}</section>;
  return <section aria-label="Intégration GitHub" className="mt-5 border-t border-white/10 pt-4 text-xs"><div className="flex items-center justify-between"><span className="font-black text-white">@{connection.accountLogin}</span><button type="button" aria-label="Déconnecter GitHub localement" onClick={() => disconnectGitHub().then(() => setConnection(null))} className="text-noline-muted"><Unplug className="h-4 w-4" /></button></div>{error ? <p role="alert" className="mt-2 text-red-300">{error}</p> : null}
    <label className="mt-3 block text-noline-muted">Repository<select className="field mt-1" value={repository} onChange={(event) => chooseRepository(event.target.value)}><option value="">Sélectionner…</option>{repositories.map((item) => <option key={item.id} value={item.fullName}>{item.fullName} · {item.visibility}</option>)}</select></label>
    <label className="mt-2 block text-noline-muted">Branche<select className="field mt-1" value={branch} onChange={(event) => { if (event.target.value !== branch) onContext([]); setBranch(event.target.value); setPath(""); setEntries([]); setPreview(null); setResults([]); setSearched(false); setError(""); saveSelection(event.target.value); }}><option value="">Sélectionner…</option>{branches.map((name) => <option key={name}>{name}</option>)}</select></label>
    {repository && branch ? <><div className="mt-3 flex items-center gap-2"><button type="button" aria-label="Dossier parent" disabled={!path} onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}><ChevronLeft className="h-4 w-4" /></button><span className="min-w-0 truncate text-noline-muted">/{path}</span>{busy ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}</div><div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-white/10">{entries.map((entry) => <button type="button" key={entry.sha + entry.path} onClick={() => entry.type === "directory" ? setPath(entry.path) : openFile(entry.path)} className="flex w-full items-center gap-2 border-b border-white/5 px-2 py-2 text-left text-white last:border-0">{entry.type === "directory" ? <Folder className="h-3.5 w-3.5 text-noline-orange" /> : <File className="h-3.5 w-3.5" />}<span className="truncate">{entry.path.split("/").pop()}</span></button>)}{!busy && entries.length === 0 ? <p className="px-2 py-3 text-noline-muted">Aucun fichier dans ce dossier.</p> : null}</div>
      <form onSubmit={runSearch} className="mt-3 flex gap-2"><input className="field min-w-0" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher du code" aria-label="Recherche GitHub" /><button aria-label="Rechercher" className="rounded bg-white/10 p-2"><Search className="h-4 w-4" /></button></form>{results.length ? <div className="mt-2 max-h-28 overflow-y-auto">{results.map((item) => <button type="button" key={item.path} onClick={() => openFile(item.path)} className="block w-full truncate py-1 text-left text-noline-muted">{item.path}</button>)}</div> : searched ? <p className="mt-2 text-noline-muted">Aucun résultat.</p> : null}
      {preview ? <div className="mt-3 rounded-md border border-white/10 p-2"><div className="flex items-center justify-between gap-2"><span className="truncate font-black text-white">{preview.path}</span><button type="button" onClick={addContext} disabled={contextFiles.some((file) => file.path === preview.path)} aria-label="Ajouter au contexte"><Plus className="h-4 w-4 text-noline-orange" /></button></div><pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-[10px] text-noline-muted">{preview.content}</pre></div> : null}</> : null}
    <div className="mt-3"><p className="font-black text-white">Contexte · {contextFiles.length}/12</p><p className="text-noline-muted">{contextFiles.reduce((sum, file) => sum + file.content.length, 0).toLocaleString("fr-FR")} / 120 000 caractères</p>{contextFiles.map((file) => <div key={file.path} className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-noline-muted">{file.path}</span><button type="button" aria-label={`Retirer ${file.path}`} onClick={() => onContext(contextFiles.filter((item) => item.path !== file.path))}><X className="h-3.5 w-3.5" /></button></div>)}</div>
  </section>;
}
