"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, File, Folder, Github, Loader2, Plus, Search, Unplug, X } from "lucide-react";
import type { ForgeGitHubFile, ForgeGitHubRepository, ForgeGitHubTreeEntry } from "@/lib/forge/github-foundation";
import type { ForgeProject } from "@/lib/forge/forge-store";
import { associateGitHubRepository, beginGitHubInstall, disconnectGitHub, getGitHubConnectionClient, listGitHubBranches, listGitHubRepositories, listGitHubTree, readGitHubFile, searchGitHubRepository } from "@/lib/forge/github-client";

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
  const [error, setError] = useState("");

  useEffect(() => { getGitHubConnectionClient().then(({ connection }) => setConnection(connection?.status === "active" ? connection : null)).catch((caught) => setError(caught.message)); }, []);
  useEffect(() => { setRepository(project?.repository_identifier || ""); setBranch(project?.default_branch || ""); }, [project?.id, project?.repository_identifier, project?.default_branch]);
  useEffect(() => { if (!connection) return; listGitHubRepositories().then(({ repositories }) => setRepositories(repositories)).catch((caught) => setError(caught.message)); }, [connection]);
  useEffect(() => { if (!repository) { setBranches([]); return; } listGitHubBranches(repository).then(({ branches }) => { setBranches(branches.map((item) => item.name)); setBranch((current) => current || branches[0]?.name || ""); }).catch((caught) => setError(caught.message)); }, [repository]);
  useEffect(() => { if (!repository || !branch) return; setBusy(true); listGitHubTree(repository, branch, path).then(({ entries }) => setEntries(entries)).catch((caught) => setError(caught.message)).finally(() => setBusy(false)); }, [repository, branch, path]);

  async function connect() { setError(""); try { const { url } = await beginGitHubInstall(); window.location.assign(url); } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); } }
  async function chooseRepository(value: string) {
    setRepository(value); setPath(""); setPreview(null);
    const item = repositories.find((repo) => repo.fullName === value);
    const nextBranch = item?.defaultBranch || "";
    setBranch(nextBranch);
    if (project && value && nextBranch) {
      try { const { project: updated } = await associateGitHubRepository(project.id, value, nextBranch); onProject(updated); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Association impossible."); }
    }
  }
  async function saveSelection(nextBranch = branch) { if (!project || !repository || !nextBranch) return; try { const { project: updated } = await associateGitHubRepository(project.id, repository, nextBranch); onProject(updated); } catch (caught) { setError(caught instanceof Error ? caught.message : "Association impossible."); } }
  async function openFile(filePath: string) { setBusy(true); setError(""); try { const { file } = await readGitHubFile(repository, branch, filePath); setPreview(file); } catch (caught) { setError(caught instanceof Error ? caught.message : "Lecture impossible."); } finally { setBusy(false); } }
  function addContext() { if (!preview || !conversationId || contextFiles.some((file) => file.path === preview.path)) return; const total = contextFiles.reduce((sum, file) => sum + file.content.length, 0) + preview.content.length; if (contextFiles.length >= 12 || total > 120000) { setError("Limite du contexte atteinte : 12 fichiers et 120 000 caractères maximum."); return; } onContext([...contextFiles, preview]); }
  async function runSearch(event: React.FormEvent) { event.preventDefault(); if (!search.trim()) return; setBusy(true); try { const { results } = await searchGitHubRepository(repository, search.trim()); setResults(results); } catch (caught) { setError(caught instanceof Error ? caught.message : "Recherche indisponible."); } finally { setBusy(false); } }

  if (!connection) return <section aria-label="Intégration GitHub" className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center gap-2 text-sm font-black text-white"><Github className="h-4 w-4 text-noline-orange" />GitHub non connecté</div><button type="button" onClick={connect} className="mt-3 w-full rounded-md bg-white/10 px-3 py-2 text-xs font-black text-white">Connecter GitHub</button>{error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}</section>;
  return <section aria-label="Intégration GitHub" className="mt-5 border-t border-white/10 pt-4 text-xs"><div className="flex items-center justify-between"><span className="font-black text-white">@{connection.accountLogin}</span><button type="button" aria-label="Déconnecter GitHub localement" onClick={() => disconnectGitHub().then(() => setConnection(null))} className="text-noline-muted"><Unplug className="h-4 w-4" /></button></div>{error ? <p role="alert" className="mt-2 text-red-300">{error}</p> : null}
    <label className="mt-3 block text-noline-muted">Repository<select className="field mt-1" value={repository} onChange={(event) => chooseRepository(event.target.value)}><option value="">Sélectionner…</option>{repositories.map((item) => <option key={item.id} value={item.fullName}>{item.fullName} · {item.visibility}</option>)}</select></label>
    <label className="mt-2 block text-noline-muted">Branche<select className="field mt-1" value={branch} onChange={(event) => { setBranch(event.target.value); setPath(""); saveSelection(event.target.value); }}><option value="">Sélectionner…</option>{branches.map((name) => <option key={name}>{name}</option>)}</select></label>
    {repository && branch ? <><div className="mt-3 flex items-center gap-2"><button type="button" aria-label="Dossier parent" disabled={!path} onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}><ChevronLeft className="h-4 w-4" /></button><span className="min-w-0 truncate text-noline-muted">/{path}</span>{busy ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}</div><div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-white/10">{entries.map((entry) => <button type="button" key={entry.sha + entry.path} onClick={() => entry.type === "directory" ? setPath(entry.path) : openFile(entry.path)} className="flex w-full items-center gap-2 border-b border-white/5 px-2 py-2 text-left text-white last:border-0">{entry.type === "directory" ? <Folder className="h-3.5 w-3.5 text-noline-orange" /> : <File className="h-3.5 w-3.5" />}<span className="truncate">{entry.path.split("/").pop()}</span></button>)}</div>
      <form onSubmit={runSearch} className="mt-3 flex gap-2"><input className="field min-w-0" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher du code" aria-label="Recherche GitHub" /><button aria-label="Rechercher" className="rounded bg-white/10 p-2"><Search className="h-4 w-4" /></button></form>{results.length ? <div className="mt-2 max-h-28 overflow-y-auto">{results.map((item) => <button type="button" key={item.path} onClick={() => openFile(item.path)} className="block w-full truncate py-1 text-left text-noline-muted">{item.path}</button>)}</div> : null}
      {preview ? <div className="mt-3 rounded-md border border-white/10 p-2"><div className="flex items-center justify-between gap-2"><span className="truncate font-black text-white">{preview.path}</span><button type="button" onClick={addContext} disabled={!conversationId || contextFiles.some((file) => file.path === preview.path)} aria-label="Ajouter au contexte"><Plus className="h-4 w-4 text-noline-orange" /></button></div><pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-[10px] text-noline-muted">{preview.content}</pre></div> : null}</> : null}
    <div className="mt-3"><p className="font-black text-white">Contexte · {contextFiles.length}/12</p><p className="text-noline-muted">{contextFiles.reduce((sum, file) => sum + file.content.length, 0).toLocaleString("fr-FR")} / 120 000 caractères</p>{contextFiles.map((file) => <div key={file.path} className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-noline-muted">{file.path}</span><button type="button" aria-label={`Retirer ${file.path}`} onClick={() => onContext(contextFiles.filter((item) => item.path !== file.path))}><X className="h-3.5 w-3.5" /></button></div>)}</div>
  </section>;
}
