"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Play, Plus, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  deleteAgentLocal,
  normalizeAgentRow,
  readAgents,
  type AgentRecord,
  type ApiAgentRow
} from "@/lib/agents";
import { officialAgents } from "@/lib/official-agents";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

export function AgentsView() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAgents();
  }, []);

  async function loadAgents() {
    if (!isSupabaseBrowserConfigured()) {
      setAgents(readAgents());
      return;
    }

    try {
      const response = await fetch("/api/agents", { headers: getAuthHeaders() });
      const data = (await response.json()) as { agents?: ApiAgentRow[]; error?: string };
      if (!response.ok || !data.agents) throw new Error(data.error || "Chargement impossible.");
      setAgents(data.agents.map(normalizeAgentRow));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
      setAgents(readAgents());
    }
  }

  async function removeAgent(id: string) {
    if (!isSupabaseBrowserConfigured()) {
      setAgents(deleteAgentLocal(id));
      return;
    }

    const response = await fetch("/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ id })
    });
    if (response.ok) setAgents((current) => current.filter((agent) => agent.id !== id));
  }

  return (
    <section className="space-y-12">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Agents</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Votre équipe IA</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-noline-muted">
            Lancez un agent NØLINE prêt à l’emploi ou créez votre propre spécialiste.
          </p>
        </div>
        <Link
          href="/agent-builder"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black hover:bg-white"
        >
          <Plus className="h-4 w-4" />
          Créer un agent
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div>
        <SectionTitle title="Agents officiels NØLINE" count={officialAgents.length} />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {officialAgents.map((agent) => (
            <article key={agent.id} className="surface premium-border flex flex-col rounded-xl p-5 shadow-premium">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-noline-orange text-noline-black">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-noline-muted">
                  {agent.category}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-black text-white">{agent.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-noline-muted">{agent.shortDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.tones.slice(0, 3).map((tone) => (
                  <span key={tone} className="rounded-md bg-white/6 px-2 py-1 text-xs font-bold text-white">
                    {tone}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <Link
                  href={`/agents/${agent.id}`}
                  className="inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black hover:bg-white"
                >
                  <Play className="h-4 w-4" />
                  Lancer
                </Link>
                <CopyButton text={agent.systemPrompt} />
                <FavoriteButton type="agent" targetId={agent.id} label={agent.name} compact />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle title="Mes agents" count={agents.length} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {agents.length === 0 ? (
            <div className="surface premium-border rounded-xl p-8 text-center md:col-span-2">
              <Bot className="mx-auto h-8 w-8 text-noline-orange" />
              <p className="mt-4 font-black text-white">Aucun agent personnalisé</p>
              <p className="mt-2 text-sm text-noline-muted">
                Agent Builder vous aide à créer un agent adapté à votre activité.
              </p>
            </div>
          ) : (
            agents.map((agent) => (
              <article key={agent.id} className="surface premium-border rounded-xl p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-noline-orange">
                  {agent.clientType}
                </p>
                <h2 className="mt-2 text-xl font-black text-white">{agent.name}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-noline-muted">{agent.mission}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-black text-noline-black"
                  >
                    Voir la fiche
                  </Link>
                  <CopyButton text={agent.output} />
                  <FavoriteButton type="agent" targetId={agent.id} label={agent.name} compact />
                  <button
                    type="button"
                    onClick={() => removeAgent(agent.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-red-400/30 px-3 py-2 text-sm font-black text-red-200"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <span className="rounded-full bg-noline-orange px-2.5 py-1 text-xs font-black text-noline-black">
        {count}
      </span>
    </div>
  );
}
