"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronDown, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { deleteAgentLocal, readAgents, type AgentRecord } from "@/lib/agents";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

type ApiAgent = {
  id: string;
  user_id?: string | null;
  name: string;
  client_type: string;
  mission: string;
  features: string;
  tone: string;
  complexity: string;
  business_goal: string;
  output: string;
  created_at: string;
};

export function AgentsView() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setError("");

    if (!isSupabaseBrowserConfigured()) {
      setAgents(readAgents());
      return;
    }

    try {
      const response = await fetch("/api/agents", { headers: getAuthHeaders() });
      const data = (await response.json()) as { agents?: ApiAgent[]; error?: string };

      if (!response.ok || !data.agents) {
        throw new Error(data.error || "Chargement impossible.");
      }

      setAgents(data.agents.map(normalizeAgent));
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

    try {
      const response = await fetch("/api/agents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ id })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Suppression impossible.");
      }

      setAgents((current) => current.filter((agent) => agent.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    }
  }

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
        Mes agents
      </p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Bibliotheque d'agents</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-noline-muted">
        Retrouve tous les agents IA crees avec NOLINE Agent Builder.
      </p>

      {error ? (
        <div className="mt-6 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {agents.length === 0 ? (
          <div className="surface premium-border rounded-lg p-6 shadow-premium lg:col-span-2">
            <Bot className="h-8 w-8 text-noline-orange" />
            <p className="mt-4 text-lg font-black text-white">Aucun agent sauvegarde</p>
            <p className="mt-2 text-sm leading-6 text-noline-muted">
              Genere un agent depuis Agent Builder, puis clique sur Sauvegarder l'agent pour le
              retrouver ici.
            </p>
          </div>
        ) : (
          agents.map((agent) => {
            const open = openId === agent.id;

            return (
              <article key={agent.id} className="surface premium-border rounded-lg p-5 shadow-premium">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-white">{agent.name}</p>
                    <p className="mt-1 text-sm text-noline-muted">{agent.clientType}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-noline-orange">
                      {agent.tone || "Sans tonalite"}
                    </p>
                    <p className="mt-2 text-xs text-noline-muted">{formatDate(agent.createdAt)}</p>
                  </div>
                  <Bot className="h-6 w-6 shrink-0 text-noline-orange" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? "" : agent.id)}
                    className="inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white"
                  >
                    <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                    Voir le detail
                  </button>
                  <CopyButton text={agent.output} />
                  <button
                    type="button"
                    onClick={() => removeAgent(agent.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </div>

                {open ? (
                  <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <Info label="Mission" value={agent.mission} />
                      <Info label="Complexite" value={agent.complexity} />
                      <Info label="Fonctionnalites" value={agent.features} />
                      <Info label="Objectif commercial" value={agent.businessGoal} />
                    </dl>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-noline-black p-4 text-sm leading-7 text-white">
                      {agent.output}
                    </pre>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-noline-black p-3">
      <dt className="text-xs font-black uppercase tracking-[0.16em] text-noline-muted">{label}</dt>
      <dd className="mt-1 text-white">{value || "-"}</dd>
    </div>
  );
}

function normalizeAgent(item: ApiAgent): AgentRecord {
  return {
    id: item.id,
    userId: item.user_id,
    name: item.name,
    clientType: item.client_type,
    mission: item.mission,
    features: item.features,
    tone: item.tone,
    complexity: item.complexity,
    businessGoal: item.business_goal,
    output: item.output,
    createdAt: item.created_at
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
