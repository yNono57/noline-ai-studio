"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Check, Copy, FolderPlus, Loader2, MessageSquarePlus, MoreHorizontal, RotateCcw, Send, Sparkles, Trash2 } from "lucide-react";
import type { Conversation, ConversationStatus, Message, Project } from "@/lib/chat/conversation-store";
import { DEFAULT_NOVA_MODEL } from "@/lib/chat/nova-model";
import { NOVA_INITIAL_SOURCE_LIMIT, readNovaWebSources, type NovaWebSource } from "@/lib/chat/nova-web-metadata";
import {
  createConversation, createProject, deleteConversation, deleteProject, listConversations, listMessages,
  listProjects, NovaClientError, sendMessage, setConversationStatus, setProjectStatus
} from "@/lib/chat/nova-client";

const INITIAL_MODEL_KEY = DEFAULT_NOVA_MODEL;

export function NovaWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectId, setProjectId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [projectView, setProjectView] = useState<ConversationStatus>("active");
  const [conversationView, setConversationView] = useState<ConversationStatus>("active");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [authBlocked, setAuthBlocked] = useState(false);

  const handleRequestError = useCallback((caught: unknown) => {
    if (caught instanceof NovaClientError && caught.status === 401) {
      setAuthBlocked(true);
      setError("Votre session a expiré. Reconnectez-vous.");
      return;
    }
    setError(caught instanceof Error ? caught.message : "Une erreur inattendue est survenue.");
  }, []);

  useEffect(() => {
    let active = true;
    listProjects().then((items) => {
      if (!active) return;
      setProjects(items);
      setProjectId(items.find((item) => item.status === "active")?.id || "");
    }).catch((caught) => active && handleRequestError(caught)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [handleRequestError]);

  useEffect(() => {
    let active = true;
    setConversations([]); setConversationId(""); setMessages([]);
    if (!projectId || authBlocked) return () => { active = false; };
    setLoading(true);
    listConversations(projectId).then((items) => {
      if (!active) return;
      setConversations(items);
      setConversationId(items.find((item) => item.status === conversationView)?.id || "");
    }).catch((caught) => active && handleRequestError(caught)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, conversationView, handleRequestError, projectId]);

  useEffect(() => {
    let active = true;
    setMessages([]); setRetryMessageId(null);
    if (!conversationId || authBlocked) return () => { active = false; };
    setLoading(true);
    listMessages(conversationId).then((items) => active && setMessages(items))
      .catch((caught) => active && handleRequestError(caught)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, conversationId, handleRequestError]);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim() || working) return;
    await runMutation(async () => {
      const project = await createProject({ name: projectName.trim(), description: projectDescription.trim() || null });
      setProjects((current) => [project, ...current]); setProjectName(""); setProjectDescription("");
      setProjectView("active"); setProjectId(project.id);
    });
  }

  async function handleCreateConversation() {
    if (!projectId || working) return;
    await runMutation(async () => {
      const conversation = await createConversation(projectId, { title: "Nouvelle conversation", mode: "CHAT", agent: "NOVA", modelKey: INITIAL_MODEL_KEY });
      setConversations((current) => [conversation, ...current]); setConversationView("active"); setConversationId(conversation.id);
    });
  }

  async function changeProjectStatus(project: Project, status: ConversationStatus) {
    await runMutation(async () => {
      const updated = await setProjectStatus(project.id, status);
      const next = projects.filter((item) => item.id !== project.id && item.status === projectView)[0];
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (project.id === projectId && status !== projectView) setProjectId(next?.id || "");
    });
  }

  async function removeProject(project: Project) {
    if (!window.confirm("Supprimer ce projet ?\nToutes les conversations et tous les messages associés seront également supprimés. Cette action est définitive.")) return;
    await runMutation(async () => {
      await deleteProject(project.id);
      const remaining = projects.filter((item) => item.id !== project.id);
      setProjects(remaining);
      if (project.id === projectId) setProjectId(remaining.find((item) => item.status === projectView)?.id || "");
    });
  }

  async function changeConversationStatus(conversation: Conversation, status: ConversationStatus) {
    await runMutation(async () => {
      const updated = await setConversationStatus(conversation.id, status);
      const next = conversations.filter((item) => item.id !== conversation.id && item.status === conversationView)[0];
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (conversation.id === conversationId && status !== conversationView) setConversationId(next?.id || "");
    });
  }

  async function removeConversation(conversation: Conversation) {
    if (!window.confirm("Supprimer cette conversation ?\nCette action est définitive.")) return;
    await runMutation(async () => {
      await deleteConversation(conversation.id);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      if (conversation.id === conversationId) setConversationId(remaining.find((item) => item.status === conversationView)?.id || "");
    });
  }

  async function runMutation(action: () => Promise<void>) {
    if (working) return;
    setWorking(true); setError("");
    try { await action(); } catch (caught) { handleRequestError(caught); } finally { setWorking(false); }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !draft.trim() || working) return;
    setWorking(true); setError(""); setNotice("Nova réfléchit…");
    try {
      const result = await sendMessage(conversationId, draft.trim(), retryMessageId);
      setMessages((current) => mergeMessages(current, [result.user_message, result.assistant_message]));
      setDraft(""); setRetryMessageId(null); setNotice("");
    } catch (caught) {
      if (caught instanceof NovaClientError && caught.userMessage) {
        setMessages((current) => mergeMessages(current, [caught.userMessage as Message]));
        setRetryMessageId(caught.userMessage.id);
        setNotice("Message enregistré. Vous pouvez réessayer l’envoi à Nova.");
      } else setNotice("");
      handleRequestError(caught);
    } finally { setWorking(false); }
  }

  const visibleProjects = projects.filter((item) => item.status === projectView);
  const visibleConversations = conversations.filter((item) => item.status === conversationView);
  const selectedProject = projects.find((item) => item.id === projectId);
  const selectedConversation = conversations.find((item) => item.id === conversationId);

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-noline-orange">NØLINE Nova</p><h1 className="mt-2 text-3xl font-black text-white">Votre espace conversationnel</h1><p className="mt-2 text-sm text-noline-muted">Organisez vos échanges par projet, avec un historique persistant.</p></div><div className="flex items-center gap-2 text-xs font-bold text-noline-muted"><Sparkles className="h-4 w-4 text-noline-orange" /> Nova · {INITIAL_MODEL_KEY}</div></header>
    {error ? <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
    <div className="grid min-h-[66vh] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="surface premium-border rounded-xl p-4 shadow-premium">
        <ListHeader title="Projets" status={projectView} onStatus={(status) => { setProjectView(status); setProjectId(projects.find((item) => item.status === status)?.id || ""); }} loading={loading} />
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">{visibleProjects.map((project) => <ResourceRow key={project.id} selected={project.id === projectId} label={project.name} onSelect={() => setProjectId(project.id)} archived={project.status === "archived"} working={working} onStatus={() => changeProjectStatus(project, project.status === "active" ? "archived" : "active")} onDelete={() => removeProject(project)} />)}{!loading && visibleProjects.length === 0 ? <p className="text-xs leading-5 text-noline-muted">Aucun projet {projectView === "archived" ? "archivé" : "actif"}.</p> : null}</div>
        {projectView === "active" ? <form onSubmit={handleCreateProject} className="mt-4 space-y-2 border-t border-white/10 pt-4"><input className="field" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nom du projet" aria-label="Nom du projet" /><input className="field" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="Description (optionnelle)" aria-label="Description du projet" /><button disabled={authBlocked || working || !projectName.trim()} className="flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><FolderPlus className="h-4 w-4" />Créer le projet</button></form> : null}
        <section className="mt-6 border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-2"><ListHeader title="Conversations" status={conversationView} onStatus={(status) => { setConversationView(status); setConversationId(conversations.find((item) => item.status === status)?.id || ""); }} /><button type="button" onClick={handleCreateConversation} disabled={authBlocked || conversationView === "archived" || !projectId || working} aria-label="Créer une conversation" className="rounded-md p-2 text-noline-orange disabled:opacity-30"><MessageSquarePlus className="h-4 w-4" /></button></div><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{visibleConversations.map((conversation) => <ResourceRow key={conversation.id} selected={conversation.id === conversationId} label={conversation.title} sublabel={`${conversation.agent} · ${conversation.mode}`} onSelect={() => setConversationId(conversation.id)} archived={conversation.status === "archived"} working={working} onStatus={() => changeConversationStatus(conversation, conversation.status === "active" ? "archived" : "active")} onDelete={() => removeConversation(conversation)} />)}{projectId && !loading && visibleConversations.length === 0 ? <p className="text-xs leading-5 text-noline-muted">Aucune conversation {conversationView === "archived" ? "archivée" : "active"}.</p> : null}</div></section>
      </aside>
      <section className="surface premium-border flex min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-xl shadow-premium"><header className="border-b border-white/10 px-5 py-4"><p className="text-xs font-bold text-noline-muted">{selectedProject?.name || "Aucun projet"}</p><h2 className="mt-1 truncate text-lg font-black text-white">{selectedConversation?.title || "Sélectionnez une conversation"}</h2></header><div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{!conversationId ? <div className="flex h-full min-h-52 items-center justify-center text-sm text-noline-muted">Créez ou sélectionnez une conversation.</div> : null}</div><div className="border-t border-white/10 p-4"><form onSubmit={handleSend} className="flex items-end gap-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={authBlocked || selectedConversation?.status === "archived" || !conversationId || working} rows={2} className="field min-h-12 flex-1 resize-none" placeholder="Écrire à Nova…" aria-label="Message pour Nova" /><button disabled={authBlocked || selectedConversation?.status === "archived" || !conversationId || !draft.trim() || working} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-noline-orange text-noline-black disabled:opacity-40" aria-label="Envoyer le message">{working ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button></form>{notice ? <p role="status" className="mt-2 text-xs text-noline-muted">{notice}</p> : null}</div></section>
    </div>
  </div>;
}

function ListHeader({ title, status, onStatus, loading = false }: { title: string; status: ConversationStatus; onStatus: (status: ConversationStatus) => void; loading?: boolean }) { return <div><div className="flex items-center gap-2"><h2 className="text-sm font-black text-white">{title}</h2>{loading ? <Loader2 className="h-4 w-4 animate-spin text-noline-orange" /> : null}</div><div className="mt-2 flex gap-1" role="group" aria-label={`Filtrer ${title}`}><FilterButton active={status === "active"} onClick={() => onStatus("active")}>Actifs</FilterButton><FilterButton active={status === "archived"} onClick={() => onStatus("archived")}>Archivés</FilterButton></div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider ${active ? "bg-noline-orange text-noline-black" : "bg-white/5 text-noline-muted"}`}>{children}</button>; }
function ResourceRow({ selected, label, sublabel, archived, working, onSelect, onStatus, onDelete }: { selected: boolean; label: string; sublabel?: string; archived: boolean; working: boolean; onSelect: () => void; onStatus: () => void; onDelete: () => void }) { return <div className={`flex items-center gap-1 rounded-md border ${selected ? "border-noline-orange bg-noline-orange/15" : "border-white/10 bg-white/5"}`}><button type="button" onClick={onSelect} className="min-w-0 flex-1 px-3 py-2 text-left"><span className="block truncate text-sm font-black text-white">{label}</span>{sublabel ? <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wider text-noline-muted">{sublabel}</span> : null}</button><details className="relative"><summary aria-label={`Actions pour ${label}`} className="list-none cursor-pointer rounded p-2 text-noline-muted hover:text-white"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-white/10 bg-noline-black p-1 shadow-xl"><button type="button" disabled={working} onClick={onStatus} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-white hover:bg-white/10">{archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{archived ? "Restaurer" : "Archiver"}</button><button type="button" disabled={working} onClick={onDelete} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Supprimer</button></div></details></div>; }
function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const user = message.role === "USER";
  const sources = readNovaWebSources(message.metadata);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  }

  return <article className={`group flex ${user ? "justify-end" : "justify-start"}`}>
    <div className={`relative min-w-0 max-w-[92%] rounded-xl px-4 py-3 sm:max-w-[85%] ${user ? "bg-noline-orange text-noline-black" : "border border-white/10 bg-white/5 text-white"}`}>
      <div className="mb-1 flex items-center justify-between gap-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">{message.role}</p><button type="button" onClick={copy} aria-label={`Copier le message ${message.role}`} className="flex items-center gap-1 rounded p-1 text-[10px] opacity-70 transition hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><span>{copied ? "Copié" : "Copier"}</span>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      {!user && sources.length > 0 ? <SourcesList sources={sources} expanded={sourcesExpanded} onToggle={() => setSourcesExpanded((value) => !value)} /> : null}
    </div>
  </article>;
}

function SourcesList({ sources, expanded, onToggle }: { sources: NovaWebSource[]; expanded: boolean; onToggle: () => void }) {
  const visibleSources = expanded ? sources : sources.slice(0, NOVA_INITIAL_SOURCE_LIMIT);
  const hiddenCount = sources.length - NOVA_INITIAL_SOURCE_LIMIT;
  return <div className="mt-3 min-w-0 border-t border-white/10 pt-2">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-noline-muted">Sources</p>
    <ul className="mt-1.5 space-y-1.5">{visibleSources.map((source) => <li key={source.url} className="min-w-0">
      <a href={source.url} target="_blank" rel="noreferrer noopener" title={source.title} className="block min-w-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-left transition hover:border-noline-orange/50">
        <span className="block truncate text-xs font-bold text-white">{source.title}</span>
        {source.domain ? <span className="mt-0.5 block truncate text-[10px] text-noline-muted">{source.domain}</span> : null}
      </a>
    </li>)}</ul>
    {hiddenCount > 0 ? <button type="button" onClick={onToggle} aria-expanded={expanded} className="mt-2 min-h-9 rounded-md px-2 text-xs font-bold text-noline-orange hover:bg-white/5 hover:text-white">
      {expanded ? "Réduire les sources" : `Voir toutes les sources (${sources.length})`}
    </button> : null}
  </div>;
}
function mergeMessages(current: Message[], incoming: Message[]) { const map = new Map(current.map((message) => [message.id, message])); for (const message of incoming) map.set(message.id, message); return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)); }