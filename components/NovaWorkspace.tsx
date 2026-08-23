"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, Loader2, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import type { Conversation, Message, Project } from "@/lib/chat/conversation-store";
import {
  createConversation,
  createProject,
  listConversations,
  listMessages,
  listProjects,
  NovaClientError,
  sendMessage
} from "@/lib/chat/nova-client";

const INITIAL_MODEL_KEY = "gpt-4.1-mini";

export function NovaWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectId, setProjectId] = useState("");
  const [conversationId, setConversationId] = useState("");
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
    setError(errorMessage(caught));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listProjects()
      .then((items) => {
        if (!active) return;
        setProjects(items);
        setProjectId((current) => current || items[0]?.id || "");
      })
      .catch((caught) => active && handleRequestError(caught))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [handleRequestError]);

  useEffect(() => {
    let active = true;
    setConversations([]);
    setConversationId("");
    setMessages([]);
    if (!projectId || authBlocked) return () => { active = false; };

    setLoading(true);
    listConversations(projectId)
      .then((items) => {
        if (!active) return;
        setConversations(items);
        setConversationId(items[0]?.id || "");
      })
      .catch((caught) => active && handleRequestError(caught))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, handleRequestError, projectId]);

  useEffect(() => {
    let active = true;
    setMessages([]);
    if (!conversationId || authBlocked) return () => { active = false; };

    setLoading(true);
    listMessages(conversationId)
      .then((items) => active && setMessages(items))
      .catch((caught) => active && handleRequestError(caught))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authBlocked, conversationId, handleRequestError]);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      const project = await createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || null
      });
      setProjects((current) => [project, ...current]);
      setProjectName("");
      setProjectDescription("");
      setProjectId(project.id);
    } catch (caught) {
      handleRequestError(caught);
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateConversation() {
    if (!projectId || working) return;
    setWorking(true);
    setError("");
    try {
      const conversation = await createConversation(projectId, {
        title: "Nouvelle conversation",
        mode: "CHAT",
        agent: "NOVA",
        modelKey: INITIAL_MODEL_KEY
      });
      setConversations((current) => [conversation, ...current]);
      setConversationId(conversation.id);
    } catch (caught) {
      handleRequestError(caught);
    } finally {
      setWorking(false);
    }
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !draft.trim() || working) return;
    setWorking(true);
    setError("");
    setNotice("Nova réfléchit…");
    try {
      const result = await sendMessage(conversationId, draft.trim(), retryMessageId);
      setMessages((current) => mergeMessages(current, [result.user_message, result.assistant_message]));
      setDraft("");
      setRetryMessageId(null);
      setNotice("");
    } catch (caught) {
      if (caught instanceof NovaClientError && caught.userMessage) {
        setMessages((current) => mergeMessages(current, [caught.userMessage as Message]));
        setRetryMessageId(caught.userMessage.id);
        setNotice("Message enregistré. Vous pouvez réessayer l’envoi à Nova.");
      } else {
        setNotice("");
      }
      handleRequestError(caught);
    } finally {
      setWorking(false);
    }
  }

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedConversation = conversations.find((item) => item.id === conversationId);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-noline-orange">NØLINE Nova</p>
          <h1 className="mt-2 text-3xl font-black text-white">Votre espace conversationnel</h1>
          <p className="mt-2 text-sm text-noline-muted">Organisez vos échanges par projet, avec un historique persistant.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-noline-muted"><Sparkles className="h-4 w-4 text-noline-orange" /> Nova · {INITIAL_MODEL_KEY}</div>
      </header>

      {error ? <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      <div className="grid min-h-[66vh] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="surface premium-border rounded-xl p-4 shadow-premium">
          <section>
            <div className="flex items-center justify-between"><h2 className="text-sm font-black text-white">Projets</h2>{loading ? <Loader2 className="h-4 w-4 animate-spin text-noline-orange" /> : null}</div>
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {projects.map((project) => (
                <button key={project.id} type="button" onClick={() => setProjectId(project.id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm font-bold transition ${project.id === projectId ? "border-noline-orange bg-noline-orange/15 text-white" : "border-white/10 bg-white/5 text-noline-muted hover:text-white"}`}>{project.name}</button>
              ))}
              {!loading && projects.length === 0 ? <p className="text-xs leading-5 text-noline-muted">Créez votre premier projet pour démarrer.</p> : null}
            </div>
            <form onSubmit={handleCreateProject} className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <input className="field" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nom du projet" aria-label="Nom du projet" />
              <input className="field" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="Description (optionnelle)" aria-label="Description du projet" />
              <button disabled={authBlocked || working || !projectName.trim()} className="flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 disabled:opacity-40"><FolderPlus className="h-4 w-4" /> Créer le projet</button>
            </form>
          </section>

          <section className="mt-6 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black text-white">Conversations</h2><button type="button" onClick={handleCreateConversation} disabled={authBlocked || !projectId || working} aria-label="Créer une conversation" className="rounded-md p-2 text-noline-orange transition hover:bg-white/10 disabled:opacity-30"><MessageSquarePlus className="h-4 w-4" /></button></div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {conversations.map((conversation) => (
                <button key={conversation.id} type="button" onClick={() => setConversationId(conversation.id)} className={`w-full rounded-md px-3 py-2 text-left transition ${conversation.id === conversationId ? "bg-white text-noline-black" : "bg-white/5 text-noline-muted hover:text-white"}`}><span className="block truncate text-sm font-black">{conversation.title}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wider">{conversation.agent} · {conversation.mode}</span></button>
              ))}
              {projectId && !loading && conversations.length === 0 ? <p className="text-xs leading-5 text-noline-muted">Aucune conversation dans ce projet.</p> : null}
            </div>
          </section>
        </aside>

        <section className="surface premium-border flex min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-xl shadow-premium">
          <header className="border-b border-white/10 px-5 py-4"><p className="text-xs font-bold text-noline-muted">{selectedProject?.name || "Aucun projet"}</p><h2 className="mt-1 truncate text-lg font-black text-white">{selectedConversation?.title || "Sélectionnez une conversation"}</h2></header>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {!loading && conversationId && messages.length === 0 ? <div className="flex h-full min-h-52 items-center justify-center text-center"><div><Sparkles className="mx-auto h-7 w-7 text-noline-orange" /><p className="mt-3 text-sm font-bold text-white">Commencez la conversation</p><p className="mt-1 text-xs text-noline-muted">Votre premier message sera enregistré dans ce projet.</p></div></div> : null}
            {!conversationId ? <div className="flex h-full min-h-52 items-center justify-center text-sm text-noline-muted">Créez ou sélectionnez une conversation.</div> : null}
          </div>
          <div className="border-t border-white/10 p-4">
            <form onSubmit={handleSend} className="flex items-end gap-3">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={authBlocked || !conversationId || working} rows={2} className="field min-h-12 flex-1 resize-none" placeholder="Écrire à Nova…" aria-label="Message pour Nova" />
              <button disabled={authBlocked || !conversationId || !draft.trim() || working} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-noline-orange text-noline-black transition hover:bg-white disabled:opacity-40" aria-label="Envoyer le message">{working ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
            </form>
            {notice ? <p role="status" className="mt-2 text-xs text-noline-muted">{notice}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const userMessage = message.role === "USER";
  return <article className={`flex ${userMessage ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-4 py-3 ${userMessage ? "bg-noline-orange text-noline-black" : "border border-white/10 bg-white/5 text-white"}`}><p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] opacity-60">{message.role}</p><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p></div></article>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) =>
    left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)
  );
}
