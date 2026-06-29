"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  Bot,
  Copy,
  Loader2,
  Pencil,
  Sparkles,
  Trash2
} from "lucide-react";
import { AgentReport } from "@/components/agent-report/AgentReport";
import { AgentWorkflowRunner } from "@/components/AgentWorkflowRunner";
import { GenerationHistoryCard } from "@/components/agent-report/GenerationHistoryCard";
import { GenerationProgress } from "@/components/agent-report/GenerationProgress";
import { CopyButton } from "@/components/CopyButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  normalizeAgentRow,
  readAgents,
  type AgentRecord,
  type ApiAgentRow
} from "@/lib/agents";
import { readClients, type AgencyClient } from "@/lib/agency";
import {
  deleteHistoryRecord,
  normalizeGenerationRecord,
  mergeGenerationRecords,
  readHistory,
  saveRecord,
  type GenerationRecord
} from "@/lib/history";
import { deleteRemoteHistoryRecord } from "@/lib/history-api";
import type { OfficialAgent } from "@/lib/official-agents";
import {
  getAuthenticatedHeaders,
  isSupabaseBrowserConfigured
} from "@/lib/supabase-client";

export function AgentDetailView({
  officialAgent,
  customAgentId
}: {
  officialAgent?: OfficialAgent;
  customAgentId?: string;
}) {
  const [customAgent, setCustomAgent] = useState<AgentRecord | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [clientId, setClientId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolvingAgent, setResolvingAgent] = useState(Boolean(customAgentId));
  const [agentInput, setAgentInput] = useState("");
  const [agentOutput, setAgentOutput] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runDemo, setRunDemo] = useState(false);
  const [runHistorySaved, setRunHistorySaved] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyFeedback, setHistoryFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [history, setHistory] = useState<GenerationRecord[]>([]);

  useEffect(() => {
    setClients(readClients());
    if (!customAgentId) {
      setResolvingAgent(false);
      return;
    }
    const agentId = customAgentId;

    async function loadCustomAgent() {
      try {
        if (!isSupabaseBrowserConfigured()) {
          setCustomAgent(readAgents().find((item) => item.id === agentId) || null);
          return;
        }

        let headers = await getAuthenticatedHeaders();
        let response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
          headers
        });
        if (response.status === 401) {
          headers = await getAuthenticatedHeaders(true);
          response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
            headers
          });
        }
        const data = (await response.json()) as {
          agent?: ApiAgentRow;
          error?: string;
        };
        if (!response.ok || !data.agent) {
          throw new Error(data.error || "Agent introuvable.");
        }
        setCustomAgent(normalizeAgentRow(data.agent));
      } catch (caught) {
        const localAgent = readAgents().find((item) => item.id === agentId) || null;
        setCustomAgent(localAgent);
        if (!localAgent) {
          setError(caught instanceof Error ? caught.message : "Impossible de charger cet agent.");
        }
      } finally {
        setResolvingAgent(false);
      }
    }

    void loadCustomAgent();
  }, [customAgentId]);

  const agent = officialAgent;
  const historyAgentId = agent?.id || customAgent?.id || "";

  useEffect(() => {
    if (!historyAgentId) return;
    let cancelled = false;
    const local = readHistory().filter(
      (record) => record.generatorId === historyAgentId
    );

    if (!isSupabaseBrowserConfigured()) {
      setHistory(local);
      return;
    }

    async function loadHistory() {
      try {
        let headers = await getAuthenticatedHeaders();
        let response = await fetch("/api/history", {
          headers,
          cache: "no-store"
        });
        if (response.status === 401) {
          headers = await getAuthenticatedHeaders(true);
          response = await fetch("/api/history", {
            headers,
            cache: "no-store"
          });
        }
        const data = response.ok ? await response.json() : null;
        if (cancelled) return;
        const remote = Array.isArray(data?.records)
          ? data.records
              .map((item: Record<string, unknown>) =>
                ({
                  ...normalizeGenerationRecord(item),
                  storage: "supabase" as const
                })
              )
              .filter((record: GenerationRecord) => record.generatorId === historyAgentId)
          : [];
        setHistory(mergeGenerationRecords(remote, local));
      } catch {
        if (!cancelled) setHistory(local);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [agentOutput, historyAgentId, historyVersion, output]);

  if (resolvingAgent) {
    return (
      <div className="surface premium-border flex items-center justify-center gap-3 rounded-xl p-8">
        <Loader2 className="h-5 w-5 animate-spin text-noline-orange" />
        <p className="font-black text-white">Chargement de l’agent...</p>
      </div>
    );
  }

  if (!agent && !customAgent) {
    return (
      <div className="surface premium-border rounded-xl p-8 text-center">
        <p className="text-xl font-black text-white">{error || "Agent introuvable"}</p>
        <Link href="/agents" className="mt-4 inline-flex text-sm font-black text-noline-orange">
          Retour aux agents
        </Link>
      </div>
    );
  }

  const name = agent?.name || customAgent?.name || "";
  const prompt = agent?.systemPrompt || customAgent?.systemPrompt || customAgent?.output || "";
  const description = agent?.description || customAgent?.description || customAgent?.mission || "";
  const tones = agent?.tones || customAgent?.tone.split(",").map((tone) => tone.trim()) || [];

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agent) return;
    setLoading(true);
    setError("");
    setOutput("");

    try {
      const client = clients.find((item) => item.id === clientId);
      const response = await fetch("/api/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, values, client })
      });
      const data = (await response.json()) as { output?: string; error?: string };
      if (!response.ok || !data.output) throw new Error(data.error || "Génération impossible.");
      setOutput(data.output);
      saveRecord({
        id: crypto.randomUUID(),
        generatorId: agent.id,
        title: agent.name,
        createdAt: new Date().toISOString(),
        values,
        output: data.output,
        clientId: client?.id,
        clientName: client?.name,
        userPrompt: values.objective || values.additionalContext || JSON.stringify(values)
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function runCustomAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = customAgent?.id;
    const input = agentInput.trim();
    if (!id || !input) {
      setRunError("Décris ta demande avant de lancer l’agent.");
      return;
    }

    setAgentRunning(true);
    setRunError("");
    setAgentOutput("");
    setRunDemo(false);
    setRunHistorySaved(false);
    setHistorySaving(false);
    setHistoryFeedback(null);

    try {
      let authHeaders = await getAuthenticatedHeaders();
      const runRequest = () => fetch(`/api/agents/${encodeURIComponent(id)}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          input,
          localAgent: {
            name: customAgent.name,
            systemPrompt: customAgent.systemPrompt || customAgent.output
          }
        })
      });
      let response = await runRequest();
      if (response.status === 401) {
        authHeaders = await getAuthenticatedHeaders(true);
        response = await runRequest();
      }
      const data = (await response.json()) as {
        output?: string;
        error?: string;
        demo?: boolean;
        historySaved?: boolean;
        historyError?: boolean;
        historyItem?: GenerationRecord | null;
      };
      if (!response.ok || !data.output) {
        throw new Error(data.error || "L’agent n’a produit aucune réponse.");
      }

      setAgentOutput(data.output);
      setRunDemo(Boolean(data.demo));
      const historySaved = Boolean(data.historySaved);
      setRunHistorySaved(historySaved);
      if (historySaved && data.historyItem) {
        const historyItem: GenerationRecord = {
          ...normalizeGenerationRecord(
            data.historyItem as unknown as Record<string, unknown>
          ),
          storage: "supabase"
        };
        saveRecord(historyItem);
        setHistory((current) =>
          mergeGenerationRecords([historyItem], current)
        );
        setHistoryVersion((current) => current + 1);
        setHistoryFeedback({
          type: "success",
          message: "Génération sauvegardée dans l’historique"
        });
      } else if (historySaved) {
        setRunHistorySaved(false);
        setHistoryFeedback({
          type: "error",
          message: "La sauvegarde n’a pas pu être confirmée dans l’historique"
        });
      } else if (data.historyError) {
        setHistoryFeedback({
          type: "error",
          message: "Erreur lors de la sauvegarde"
        });
      }
    } catch (caught) {
      setRunError(caught instanceof Error ? caught.message : "Impossible d’utiliser cet agent.");
    } finally {
      setAgentRunning(false);
    }
  }

  async function saveRunToLocalHistory() {
    if (!customAgent || !agentOutput || runHistorySaved || historySaving) return;

    setHistorySaving(true);
    setHistoryFeedback(null);
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      saveRecord({
        id: crypto.randomUUID(),
        generatorId: customAgent.id,
        title: customAgent.name,
        createdAt: new Date().toISOString(),
        values: { input: agentInput.trim() },
        output: agentOutput,
        userPrompt: agentInput.trim()
      });
      setRunHistorySaved(true);
      setHistoryVersion((current) => current + 1);
      setHistoryFeedback({
        type: "success",
        message: "Génération sauvegardée dans l’historique"
      });
    } catch {
      setHistoryFeedback({
        type: "error",
        message: "Erreur lors de la sauvegarde"
      });
    } finally {
      setHistorySaving(false);
    }
  }

  async function deleteLinkedHistoryRecord(record: GenerationRecord) {
    if (record.storage === "supabase" && isSupabaseBrowserConfigured()) {
      await deleteRemoteHistoryRecord(record.id);
    }
    deleteHistoryRecord(record.id);
    setHistory((current) =>
      current.filter((item) => item.id !== record.id)
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface premium-border rounded-xl p-6 shadow-premium">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-noline-orange">
              {agent?.category || customAgent?.clientType}
            </p>
            <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">{name}</h1>
            <p className="mt-4 text-base leading-7 text-noline-muted">{description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tones.map((tone) => (
                <span key={tone} className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-white">
                  {tone}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="#utiliser-agent"
              className="inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white"
            >
              <ArrowDown className="h-4 w-4" />
              Utiliser cet agent
            </a>
            <a
              href="#workflow-agent"
              className="inline-flex items-center gap-2 rounded-md border border-noline-orange/50 px-4 py-2 text-sm font-black text-white transition hover:bg-noline-orange hover:text-noline-black"
            >
              Lancer un workflow
            </a>
            <FavoriteButton type="agent" targetId={agent?.id || customAgent?.id || ""} label={name} />
            <CopyButton text={prompt} />
            {customAgent ? (
              <>
                <Link href="/agent-builder" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-black text-white">
                  <Pencil className="h-4 w-4" /> Modifier
                </Link>
                <Link href="/agent-builder" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-black text-white">
                  <Copy className="h-4 w-4" /> Dupliquer
                </Link>
                <Link href="/agents" className="inline-flex items-center gap-2 rounded-md border border-red-400/30 px-3 py-2 text-sm font-black text-red-200">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {customAgent ? (
        <section
          id="utiliser-agent"
          className="surface premium-border scroll-mt-28 rounded-xl p-5 shadow-premium sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-noline-orange text-noline-black">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-noline-orange">
                Atelier
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">Utiliser cet agent</h2>
              <p className="mt-1 text-sm leading-6 text-noline-muted">
                Donne une consigne précise. L’agent répondra avec son expertise et son prompt système.
              </p>
            </div>
          </div>

          <form onSubmit={runCustomAgent} className="mt-6 space-y-4">
            <label className="block" htmlFor="custom-agent-input">
              <span className="mb-2 block text-sm font-bold text-white">Décris ta demande</span>
              <textarea
                id="custom-agent-input"
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
                placeholder="Exemple : prépare une stratégie claire pour lancer mon offre auprès des restaurants indépendants."
                rows={6}
                maxLength={10000}
                className="field resize-y"
              />
            </label>
            {runError ? (
              <p className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {runError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={agentRunning || !agentInput.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {agentRunning ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-noline-black" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              {agentRunning ? "Génération..." : "Générer avec cet agent"}
            </button>
            {agentRunning ? <GenerationProgress /> : null}
          </form>

          {agentOutput ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="mb-4">
                <h3 className="font-black text-white">Rapport généré</h3>
                <p className="mt-1 text-xs text-noline-muted">
                  {runDemo ? "Mode démonstration" : "Réponse structurée par l’agent"}
                </p>
              </div>
              <AgentReport
                content={agentOutput}
                title={`${customAgent.name} — Rapport`}
                onSave={saveRunToLocalHistory}
                saved={runHistorySaved}
                saveLoading={historySaving}
              />
              {historyFeedback ? (
                <div
                  role={historyFeedback.type === "error" ? "alert" : "status"}
                  className={`mt-4 rounded-lg border p-3 text-sm font-bold ${
                    historyFeedback.type === "success"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                      : "border-red-400/30 bg-red-500/10 text-red-100"
                  }`}
                >
                  {historyFeedback.message}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <AgentWorkflowRunner
        agentId={agent?.id || customAgent?.id || ""}
        agentName={name}
        clients={clients}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <section className="surface premium-border rounded-xl p-5">
            <h2 className="text-lg font-black text-white">Cas d’utilisation</h2>
            <ul className="mt-4 space-y-3 text-sm text-noline-muted">
              {(agent?.useCases || customAgent?.features.split("\n") || []).map((useCase) => (
                <li key={useCase} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-noline-orange" />
                  {useCase}
                </li>
              ))}
            </ul>
          </section>
          <section className="surface premium-border rounded-xl p-5">
            <h2 className="text-lg font-black text-white">Prompt système</h2>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-noline-black p-4 text-sm leading-6 text-noline-muted">
              {prompt}
            </pre>
          </section>
        </div>

        {agent ? (
          <section id="utiliser-agent" className="surface premium-border scroll-mt-28 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-noline-orange text-noline-black">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Lancer l’agent</h2>
                <p className="text-sm text-noline-muted">Le client sélectionné enrichit automatiquement le prompt.</p>
              </div>
            </div>
            <form onSubmit={generate} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white">Client</span>
                <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="field">
                  <option value="">Aucun client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name} - {client.sector}</option>
                  ))}
                </select>
              </label>
              {agent.variables.map((variable) => (
                <AgentField
                  key={variable.name}
                  variable={variable}
                  value={values[variable.name] || ""}
                  onChange={(value) => setValues((current) => ({ ...current, [variable.name]: value }))}
                />
              ))}
              {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
              <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black hover:bg-white disabled:opacity-60">
                {loading ? <span className="h-2 w-2 animate-pulse rounded-full bg-noline-black" /> : <Bot className="h-4 w-4" />}
                {loading ? "Génération..." : "Générer"}
              </button>
              {loading ? <GenerationProgress /> : null}
            </form>
            {output ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h3 className="mb-4 font-black text-white">Rapport généré</h3>
                <AgentReport content={output} title={`${agent.name} — Rapport`} saved />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <section className="surface premium-border rounded-xl p-5">
        <h2 className="text-xl font-black text-white">Historique lié</h2>
        <div className="mt-4 grid gap-3">
          {history.length === 0 ? <p className="text-sm text-noline-muted">Aucune génération avec cet agent.</p> : null}
          {history.slice(0, 5).map((record) => (
            <GenerationHistoryCard
              key={record.id}
              record={record}
              onDelete={() => deleteLinkedHistoryRecord(record)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AgentField({
  variable,
  value,
  onChange
}: {
  variable: OfficialAgent["variables"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white">{variable.label}</span>
      {variable.type === "textarea" ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={variable.placeholder} className="field" />
      ) : variable.type === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="field">
          <option value="">{variable.placeholder}</option>
          {variable.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input type={variable.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={variable.placeholder} className="field" />
      )}
    </label>
  );
}
