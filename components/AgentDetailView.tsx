"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Copy, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  normalizeAgentRow,
  readAgents,
  type AgentRecord,
  type ApiAgentRow
} from "@/lib/agents";
import { readClients, type AgencyClient } from "@/lib/agency";
import { readHistory, saveRecord } from "@/lib/history";
import type { OfficialAgent } from "@/lib/official-agents";
import {
  getAuthHeaders,
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

        const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
          headers: getAuthHeaders()
        });
        const data = (await response.json()) as {
          agent?: ApiAgentRow;
          error?: string;
        };
        if (!response.ok || !data.agent) {
          throw new Error(data.error || "Agent introuvable.");
        }
        setCustomAgent(normalizeAgentRow(data.agent));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Impossible de charger cet agent.");
      } finally {
        setResolvingAgent(false);
      }
    }

    void loadCustomAgent();
  }, [customAgentId]);

  const agent = officialAgent;
  const history = useMemo(
    () =>
      readHistory().filter(
        (record) => record.generatorId === (agent?.id || customAgent?.id)
      ),
    [agent?.id, customAgent?.id, output]
  );

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
          <section id="lancer" className="surface premium-border rounded-xl p-5">
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {loading ? "Génération..." : "Générer"}
              </button>
            </form>
            {output ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-white">Résultat</h3>
                  <CopyButton text={output} />
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-noline-black p-4 text-sm leading-7 text-white">{output}</pre>
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
            <div key={record.id} className="rounded-lg border border-white/10 bg-noline-black p-4">
              <p className="text-xs font-bold text-noline-muted">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}</p>
              <p className="mt-2 line-clamp-2 text-sm text-white">{record.output}</p>
            </div>
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
