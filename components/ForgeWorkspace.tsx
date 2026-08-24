"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowDown, Check, Code2, Copy, GitBranch, Github, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Send, TerminalSquare, Trash2, X } from "lucide-react";
import type { ForgeConversation, ForgeMessage, ForgeProject } from "@/lib/forge/forge-store";
import type { ForgeGitHubFile } from "@/lib/forge/github-foundation";
import { ForgeGitHubPanel } from "@/components/ForgeGitHubPanel";
import { ForgeWorkspaceControl } from "@/components/ForgeWorkspaceControl";
import { submitForgeComposer, type ForgeComposerMode } from "@/lib/forge/forge-submit";
import {
  createForgeConversation,
  createForgeProject,
  deleteForgeProject,
  ForgeClientError,
  getLatestForgeAgentRun,
  listForgeConversations,
  listForgeMessages,
  listForgeProjects,
  renameForgeConversation,
  sendForgeMessage,
  setForgeProjectStatus,
  type ForgeAgentRunPayload
} from "@/lib/forge/forge-client";

export function ForgeWorkspace() {
  const [projects, setProjects] = useState<ForgeProject[]>([]);
  const [conversations, setConversations] = useState<ForgeConversation[]>([]);
  const [messages, setMessages] = useState<ForgeMessage[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectView, setProjectView] = useState<"active" | "archived">("active");
  const [conversationId, setConversationId] = useState("");
  const [model, setModel] = useState("Chargement…");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState("");
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contextByConversation, setContextByConversation] = useState<Record<string, ForgeGitHubFile[]>>({});
  const [composerMode, setComposerMode] = useState<ForgeComposerMode>("chat");
  const [agentLaunchRequest, setAgentLaunchRequest] = useState<{ id: string; objective: string } | null>(null);
  const [agentAvailable, setAgentAvailable] = useState(false);
  const [agentActive, setAgentActive] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState("");
  const [editingConversationTitle, setEditingConversationTitle] = useState("");
  const [agentPayload, setAgentPayload] = useState<ForgeAgentRunPayload | null>(null);
  const [pendingAgentMission, setPendingAgentMission] = useState<{ id: string; content: string; createdAt: string } | null>(null);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const messagesViewport = useRef<HTMLDivElement | null>(null);
  const followMessages = useRef(true);
  const syncedAgentRun = useRef("");
  const syncedAgentTerminal = useRef("");

  const handleError = useCallback((caught: unknown) => {
    if (caught instanceof ForgeClientError && caught.status === 401) {
      setAuthBlocked(true);
      setError("Votre session a expiré. Reconnectez-vous.");
      return;
    }
    setError(caught instanceof Error ? caught.message : "Une erreur inattendue est survenue.");
  }, []);

  useEffect(() => {
    let active = true;
    listForgeProjects()
      .then((data) => {
        if (!active) return;
        setProjects(data.projects);
        setModel(data.model);
        setProjectId(data.projects.find((item) => item.status === "active")?.id || "");
      })
      .catch((error) => active && handleError(error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [handleError]);

  useEffect(() => {
    let active = true;
    setConversations([]);
    setConversationId("");
    setMessages([]);
    if (!projectId || authBlocked) return () => { active = false; };
    setLoading(true);
    listForgeConversations(projectId)
      .then((items) => { if (active) { setConversations(items); setConversationId(items[0]?.id || ""); } })
      .catch((error) => active && handleError(error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, handleError, projectId]);

  useEffect(() => {
    let active = true;
    setMessages([]); setAgentPayload(null); setPendingAgentMission(null);
    setRetryMessageId(null);
    setComposerMode("chat"); setAgentLaunchRequest(null); setAgentAvailable(false); setAgentActive(false);
    followMessages.current = true; setShowLatestButton(false); syncedAgentRun.current = ""; syncedAgentTerminal.current = "";
    if (!conversationId || authBlocked) return () => { active = false; };
    setLoading(true);
    Promise.all([listForgeMessages(conversationId), getLatestForgeAgentRun(conversationId)])
      .then(([items, agent]) => { if (active) { setMessages(items); setAgentPayload(agent.agentRun); } })
      .catch((error) => active && handleError(error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, conversationId, handleError]);

  useEffect(() => {
    if (!followMessages.current || !messagesViewport.current) return;
    const frame = window.requestAnimationFrame(() => messagesViewport.current?.scrollTo({ top: messagesViewport.current.scrollHeight, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [agentPayload?.run.status, agentPayload?.steps.length, conversationId, messages.length, pendingAgentMission]);

  const scrollToLatest = useCallback(() => { followMessages.current = true; setShowLatestButton(false); messagesViewport.current?.scrollTo({ top: messagesViewport.current.scrollHeight, behavior: "smooth" }); }, []);
  const selectConversation = useCallback((id: string) => { followMessages.current = true; setShowLatestButton(false); setConversationId(id); }, []);
  const handleAgentPayload = useCallback((payload: ForgeAgentRunPayload | null) => {
    setAgentPayload(payload);
    if (!payload || !conversationId) return;
    const terminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(payload.run.status);
    const shouldSync = syncedAgentRun.current !== payload.run.runId || (terminal && syncedAgentTerminal.current !== `${payload.run.runId}:${payload.run.status}`);
    if (!shouldSync) return;
    syncedAgentRun.current = payload.run.runId; if (terminal) syncedAgentTerminal.current = `${payload.run.runId}:${payload.run.status}`;
    listForgeMessages(conversationId).then((items) => { setMessages(items); setPendingAgentMission(null); }).catch(() => undefined);
  }, [conversationId]);
  async function addProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || working) return;
    setWorking(true); setError("");
    try {
      const project = await createForgeProject({ name: name.trim(), description: description.trim() || null });
      setProjects((current) => [project, ...current]);
      setName(""); setDescription(""); setProjectId(project.id);
    } catch (error) { handleError(error); } finally { setWorking(false); }
  }

  async function addConversation() {
    if (!projectId || working) return;
    setWorking(true); setError("");
    try {
      const conversation = await createForgeConversation(projectId);
      setConversations((current) => [conversation, ...current]);
      setConversationId(conversation.id);
    } catch (error) { handleError(error); } finally { setWorking(false); }
  }

  async function saveConversationTitle(conversation: ForgeConversation) {
    const title = editingConversationTitle.trim();
    if (!title || working) return;
    setWorking(true); setError("");
    try { const updated = await renameForgeConversation(conversation.id, title); setConversations((current) => current.map((item) => item.id === updated.id ? updated : item)); setEditingConversationId(""); }
    catch (caught) { handleError(caught); }
    finally { setWorking(false); }
  }
  async function changeProjectStatus(project: ForgeProject) {
    if (working) return;
    setWorking(true); setError("");
    try {
      const status = project.status === "active" ? "archived" : "active";
      const updated = await setForgeProjectStatus(project.id, status);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (project.id === projectId && status !== projectView) setProjectId(projects.find((item) => item.id !== project.id && item.status === projectView)?.id || "");
    } catch (error) { handleError(error); } finally { setWorking(false); }
  }

  async function removeProject(project: ForgeProject) {
    if (!window.confirm("Supprimer ce projet Forge ?\nToutes les sessions et tous les messages associés seront également supprimés. Cette action est définitive.")) return;
    setWorking(true); setError("");
    try {
      await deleteForgeProject(project.id);
      const remaining = projects.filter((item) => item.id !== project.id);
      setProjects(remaining);
      if (project.id === projectId) setProjectId(remaining.find((item) => item.status === projectView)?.id || "");
    } catch (error) { handleError(error); } finally { setWorking(false); }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !draft.trim() || working || agentActive) return;
    followMessages.current = true; messagesViewport.current?.scrollTo({ top: messagesViewport.current.scrollHeight, behavior: "smooth" });
    if (composerMode === "agent") {
      if (!agentAvailable) { setError("Un runtime Daytona READY est requis pour exécuter cette mission."); return; }
      const objective = draft.trim(); setError(""); setNotice("Mission transmise à l’Agent Forge…");
      submitForgeComposer(composerMode, objective, { chat: () => undefined, agent: (value) => { const id = crypto.randomUUID(); setPendingAgentMission({ id, content: value, createdAt: new Date().toISOString() }); setAgentLaunchRequest({ id, objective: value }); } });
      setDraft(""); return;
    }
    setWorking(true); setError(""); setNotice("Forge analyse votre demande…");
    try {
      const result = await sendForgeMessage(conversationId, draft.trim(), retryMessageId, (contextByConversation[conversationId] || []).map((file) => file.path));
      setMessages((current) => mergeMessages(current, [result.user_message, result.assistant_message]));
      setConversations((current) => current.map((item) => item.id === result.conversation.id ? result.conversation : item));
      setDraft(""); setRetryMessageId(null); setNotice("");
    } catch (caught) {
      if (caught instanceof ForgeClientError && caught.userMessage) {
        setMessages((current) => mergeMessages(current, [caught.userMessage as ForgeMessage]));
        setRetryMessageId(caught.userMessage.id);
        setNotice("Message enregistré. Vous pouvez relancer Forge sans le dupliquer.");
      } else setNotice("");
      handleError(caught);
    } finally { setWorking(false); }
  }

  const visibleProjects = projects.filter((item) => item.status === projectView);
  const project = projects.find((item) => item.id === projectId);
  const conversation = conversations.find((item) => item.id === conversationId);
  const timeline: Array<{ key: string; at: string; kind: "message"; message: ForgeMessage } | { key: string; at: string; kind: "agent"; payload: ForgeAgentRunPayload }> = messages.map((message) => ({ key: message.id, at: message.created_at, kind: "message", message }));
  if (pendingAgentMission) timeline.push({ key: pendingAgentMission.id, at: pendingAgentMission.createdAt, kind: "message", message: { id: pendingAgentMission.id, conversation_id: conversationId, role: "USER", content: pendingAgentMission.content, metadata: { pending: true, forge_agent_mission: true }, created_at: pendingAgentMission.createdAt } });
  if (agentPayload) timeline.push({ key: `agent-${agentPayload.run.runId}`, at: agentPayload.run.createdAt, kind: "agent", payload: agentPayload });
  timeline.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.24em] text-noline-orange">NØLINE Forge</p><h1 className="mt-2 text-3xl font-black text-white">Development workspace</h1><p className="mt-2 text-sm text-noline-muted">Concevez, analysez et préparez vos implémentations avec un ingénieur logiciel IA.</p></div>
      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-noline-muted">Modèle · {model}</div>
    </header>
    {error ? <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
    <div className="grid min-h-[68vh] gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_17rem]">
      <aside className="surface premium-border rounded-xl p-4 shadow-premium">
        <div className="flex items-center justify-between"><h2 className="text-sm font-black text-white">Projets Forge</h2>{loading ? <Loader2 className="h-4 w-4 animate-spin text-noline-orange" /> : null}</div>
        <div className="mt-2 flex gap-1"><ForgeFilter active={projectView === "active"} onClick={() => { setProjectView("active"); setProjectId(projects.find((item) => item.status === "active")?.id || ""); }}>Actifs</ForgeFilter><ForgeFilter active={projectView === "archived"} onClick={() => { setProjectView("archived"); setProjectId(projects.find((item) => item.status === "archived")?.id || ""); }}>Archivés</ForgeFilter></div><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{visibleProjects.map((item) => <ForgeProjectRow key={item.id} project={item} selected={item.id === projectId} working={working} onSelect={() => setProjectId(item.id)} onStatus={() => changeProjectStatus(item)} onDelete={() => removeProject(item)} />)}{!loading && visibleProjects.length === 0 ? <p className="text-xs leading-5 text-noline-muted">Aucun projet {projectView === "archived" ? "archivé" : "actif"}.</p> : null}</div>
        {projectView === "active" ? <form onSubmit={addProject} className="mt-4 space-y-2 border-t border-white/10 pt-4"><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom du projet" aria-label="Nom du projet Forge" /><input className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optionnelle)" aria-label="Description du projet Forge" /><button disabled={authBlocked || working || !name.trim()} className="flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" />Créer</button></form> : null}
        <div className="mt-6 border-t border-white/10 pt-4"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-white">Sessions</h2><button type="button" onClick={addConversation} disabled={authBlocked || project?.status === "archived" || !projectId || working} aria-label="Créer une session Forge" className="rounded-md p-2 text-noline-orange disabled:opacity-30"><Plus className="h-4 w-4" /></button></div><div className="mt-2 space-y-2">{conversations.map((item) => editingConversationId === item.id ? <form key={item.id} onSubmit={(event) => { event.preventDefault(); void saveConversationTitle(item); }} className="flex gap-1"><input autoFocus maxLength={60} value={editingConversationTitle} onChange={(event) => setEditingConversationTitle(event.target.value)} className="field min-w-0 flex-1 px-2 py-1 text-xs" aria-label={`Renommer ${item.title}`} /><button disabled={!editingConversationTitle.trim() || working} aria-label="Enregistrer le titre" className="rounded p-2 text-green-300 disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setEditingConversationId("")} aria-label="Annuler le renommage" className="rounded p-2 text-noline-muted"><X className="h-3.5 w-3.5" /></button></form> : <div key={item.id} className={`flex items-center rounded-md ${item.id === conversationId ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}`}><button type="button" onClick={() => selectConversation(item.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-bold">{item.title}</button><button type="button" onClick={() => { setEditingConversationId(item.id); setEditingConversationTitle(item.title); }} aria-label={`Renommer ${item.title}`} className="rounded p-2 opacity-70"><Pencil className="h-3.5 w-3.5" /></button></div>)}</div></div>
      </aside>
      <main className="surface premium-border relative flex min-h-[38rem] min-w-0 flex-col overflow-hidden rounded-xl shadow-premium">
        <header className="border-b border-white/10 px-5 py-4"><p className="text-xs text-noline-muted">{project?.name || "Aucun projet"}</p><h2 className="mt-1 truncate font-black text-white">{conversation?.title || "Sélectionnez une session"}</h2></header>
        <div ref={messagesViewport} onScroll={(event) => { const node = event.currentTarget; const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100; followMessages.current = nearBottom; setShowLatestButton(!nearBottom); }} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{timeline.map((item) => item.kind === "message" ? <ForgeBubble key={item.key} message={item.message} /> : <ForgeAgentActivity key={item.key} payload={item.payload} />)}{!conversationId ? <EmptyChat /> : null}{conversationId && !loading && timeline.length === 0 ? <EmptyChat ready /> : null}</div>{showLatestButton ? <button type="button" onClick={scrollToLatest} aria-label="Revenir aux messages récents" className="absolute bottom-36 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-noline-black/95 px-3 py-2 text-xs font-black text-white shadow-lg"><ArrowDown className="h-4 w-4" />Récent</button> : null}
        <div className="border-t border-white/10 p-4"><div className="mb-2 flex gap-1" role="group" aria-label="Mode Forge"><button type="button" onClick={() => setComposerMode("chat")} className={`rounded px-2 py-1 text-[10px] font-black uppercase ${composerMode === "chat" ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted"}`}>Conversation</button><button type="button" onClick={() => setComposerMode("agent")} disabled={!agentAvailable} className={`rounded px-2 py-1 text-[10px] font-black uppercase disabled:opacity-40 ${composerMode === "agent" ? "bg-noline-orange text-noline-black" : "bg-white/5 text-noline-muted"}`}>Exécuter avec Forge</button>{composerMode === "agent" ? <span className="ml-auto self-center text-[10px] font-black text-noline-muted">{agentActive ? "AGENT EN COURS" : "RUNTIME READY"}</span> : null}</div><form onSubmit={send} className="flex items-end gap-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={authBlocked || project?.status === "archived" || !conversationId || working || agentActive} rows={3} className="field flex-1 resize-none font-mono" placeholder={composerMode === "agent" ? "Décrivez la mission à exécuter dans le sandbox…" : "Décrivez le problème, collez du code ou demandez un plan…"} aria-label={composerMode === "agent" ? "Mission pour l’Agent Forge" : "Message pour Forge"} /><button disabled={authBlocked || project?.status === "archived" || !conversationId || !draft.trim() || working || agentActive || (composerMode === "agent" && !agentAvailable)} className="flex h-12 w-12 items-center justify-center rounded-md bg-noline-orange text-noline-black disabled:opacity-40" aria-label={composerMode === "agent" ? "Exécuter avec Forge" : "Envoyer à Forge"}>{working || agentActive ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button></form>{notice ? <p role="status" className="mt-2 text-xs text-noline-muted">{notice}</p> : null}</div>
      </main>
      <aside className="surface premium-border rounded-xl p-4 shadow-premium"><h2 className="text-sm font-black text-white">Contexte projet</h2><div className="mt-4 space-y-3"><ContextRow icon={Github} label="Repository" value={project?.repository_identifier || "Non connecté"} /><ContextRow icon={GitBranch} label="Branche" value={project?.default_branch || "Non connectée"} /><ContextRow icon={Code2} label="Fichiers actifs" value={`${(contextByConversation[conversationId] || []).length} fichier(s)`} /><ContextRow icon={TerminalSquare} label="Accès" value="GitHub lecture seule" /></div><ForgeWorkspaceControl project={project} conversationId={conversationId} agentLaunchRequest={agentLaunchRequest} onAgentLaunchRequestHandled={(id) => setAgentLaunchRequest((current) => current?.id === id ? null : current)} onAgentActiveChange={(active) => { setAgentActive(active); if (!active) setNotice(""); }} onRuntimeReadyChange={(ready) => { setAgentAvailable(ready); if (!ready) setComposerMode("chat"); }} onConversationUpdated={(updated) => setConversations((current) => current.map((item) => item.id === updated.id ? updated : item))} onAgentPayloadChange={handleAgentPayload} onAgentMessagesPersisted={(persisted) => { setMessages((current) => mergeMessages(current, persisted)); setPendingAgentMission(null); }} /><ForgeGitHubPanel project={project} conversationId={conversationId} contextFiles={contextByConversation[conversationId] || []} onProject={(updated) => setProjects((current) => current.map((item) => item.id === updated.id ? updated : item))} onContext={(files) => setContextByConversation((current) => ({ ...current, [conversationId]: files }))} /></aside>
    </div>
  </div>;
}

function ForgeFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded px-2 py-1 text-[10px] font-black uppercase ${active ? "bg-noline-orange text-noline-black" : "bg-white/5 text-noline-muted"}`}>{children}</button>; }
function ForgeProjectRow({ project, selected, working, onSelect, onStatus, onDelete }: { project: ForgeProject; selected: boolean; working: boolean; onSelect: () => void; onStatus: () => void; onDelete: () => void }) { return <div className={`flex items-center rounded-md border ${selected ? "border-noline-orange bg-noline-orange/15" : "border-white/10 bg-white/5"}`}><button type="button" onClick={onSelect} className="min-w-0 flex-1 px-3 py-2 text-left"><span className="block truncate text-sm font-black text-white">{project.name}</span><span className="mt-1 block truncate text-[10px] text-noline-muted">{project.repository_identifier || "Projet non connecté"}</span></button><details className="relative"><summary aria-label={`Actions pour ${project.name}`} className="list-none cursor-pointer p-2 text-noline-muted"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-white/10 bg-noline-black p-1"><button type="button" disabled={working} onClick={onStatus} className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-white hover:bg-white/10">{project.status === "archived" ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{project.status === "archived" ? "Restaurer" : "Archiver"}</button><button type="button" disabled={working} onClick={onDelete} className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Supprimer</button></div></details></div>; }
function ForgeBubble({ message }: { message: ForgeMessage }) { const [copied, setCopied] = useState(false); const user = message.role === "USER"; async function copy() { try { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } } return <article className={`group flex ${user ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-xl px-4 py-3 ${user ? "bg-noline-orange text-noline-black" : "border border-white/10 bg-black/30 text-white"}`}><div className="mb-1 flex items-center justify-between gap-4"><p className="font-mono text-[10px] font-black uppercase opacity-60">{message.role}</p><button type="button" onClick={copy} aria-label={`Copier le message ${message.role}`} className="flex items-center gap-1 rounded p-1 text-[10px] opacity-70 sm:opacity-0 sm:group-hover:opacity-100"><span>{copied ? "Copié" : "Copier"}</span>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p></div></article>; }
function ForgeAgentActivity({ payload }: { payload: ForgeAgentRunPayload }) {
  const active = ["QUEUED", "PLANNING", "RUNNING", "VALIDATING"].includes(payload.run.status);
  const plan = payload.steps.find((step) => step.type === "PLAN");
  const operations = payload.steps.filter((step) => step.type === "TOOL_CALL" || step.type === "FAIL").slice(-8);
  const visible = plan ? [plan, ...operations] : operations;
  return <article className="max-w-[96%] rounded-xl border border-noline-orange/25 bg-noline-orange/5 px-4 py-3 text-white sm:max-w-[88%]">
    <div className="flex items-center gap-2"><span className="font-black">{active ? "Forge travaille…" : payload.run.status === "COMPLETED" ? "Mission terminée" : "Forge n’a pas pu terminer la mission"}</span>{active ? <Loader2 className="h-4 w-4 animate-spin text-noline-orange" /> : null}<span className="ml-auto text-[10px] font-black text-noline-muted">{payload.run.status}</span></div>
    {visible.length ? <div className="mt-3 space-y-1.5">{visible.map((step) => <div key={step.stepId} className="flex items-start gap-2 text-xs leading-5"><span className={step.status === "FAILED" ? "text-red-300" : step.status === "COMPLETED" ? "text-green-300" : "text-noline-orange"}>{step.status === "FAILED" ? "✕" : step.status === "COMPLETED" ? "✓" : "•"}</span><span className="min-w-0 break-words">{agentStepLabel(step)}</span></div>)}</div> : <p className="mt-2 text-xs text-noline-muted">Préparation du run…</p>}
    {payload.run.status !== "COMPLETED" && !active ? <p className="mt-3 rounded-md bg-black/20 p-2 text-xs text-red-200"><span className="font-black">Cause :</span> {payload.run.error || "Le run a été interrompu avant son terme."}</p> : null}
  </article>;
}
function agentStepLabel(step: ForgeAgentRunPayload["steps"][number]) {
  if (step.type === "PLAN") return "Plan créé";
  if (step.type === "FAIL") return step.summary || "Validation en échec";
  if (step.tool === "list_files") return "Inspection du repository";
  if (step.tool === "read_file") return `Lecture de ${String(step.input.path || "fichier")}`;
  if (step.tool === "write_file") return `Modification de ${String(step.input.path || "fichier")}`;
  if (step.tool === "delete_file") return `Suppression de ${String(step.input.path || "fichier")}`;
  if (step.tool === "run_command") return `Exécution de ${String(step.input.command || "commande")}`;
  if (step.tool === "git_status") return "Vérification Git status";
  if (step.tool === "git_diff") return "Génération du Git diff";
  return step.summary || "Étape Forge";
}
function EmptyChat({ ready = false }: { ready?: boolean }) { return <div className="flex min-h-72 items-center justify-center text-center"><div><Code2 className="mx-auto h-8 w-8 text-noline-orange" /><p className="mt-3 text-sm font-black text-white">{ready ? "Forge est prêt" : "Créez ou sélectionnez une session"}</p><p className="mt-1 text-xs text-noline-muted">{ready ? "Décrivez votre objectif technique pour commencer." : "Les conversations restent attachées à ce projet Forge."}</p></div></div>; }
function ContextRow({ icon: Icon, label, value }: { icon: typeof Github; label: string; value: string }) { return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-xs font-black text-white"><Icon className="h-4 w-4 text-noline-orange" />{label}</div><p className="mt-2 truncate text-xs text-noline-muted">{value}</p></div>; }
function mergeMessages(current: ForgeMessage[], incoming: ForgeMessage[]) { const map = new Map(current.map((message) => [message.id, message])); for (const message of incoming) map.set(message.id, message); return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)); }
