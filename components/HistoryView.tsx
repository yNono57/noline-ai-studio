"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GenerationHistoryCard } from "./agent-report/GenerationHistoryCard";
import {
  deleteHistoryRecord,
  mergeGenerationRecords,
  normalizeGenerationRecord,
  readHistory,
  type GenerationRecord
} from "@/lib/history";
import {
  getAuthHeaders,
  isSupabaseBrowserConfigured
} from "@/lib/supabase-client";

export function HistoryView() {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setRecords(readHistory());
      return;
    }

    fetch("/api/history", {
      headers: getAuthHeaders(),
      cache: "no-store"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const remote = Array.isArray(data?.records)
          ? data.records.map((item: Record<string, unknown>) =>
              normalizeGenerationRecord(item)
            )
          : [];
        setRecords(mergeGenerationRecords(remote, readHistory()));
      })
      .catch(() => setRecords(readHistory()));
  }, []);

  const agents = useMemo(
    () => Array.from(new Map(records.map((record) => [record.generatorId, record.title])).entries()),
    [records]
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesAgent = agentFilter === "all" || record.generatorId === agentFilter;
      const matchesQuery =
        !normalized ||
        [record.title, record.userPrompt, record.output, record.clientName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesAgent && matchesQuery;
    });
  }, [agentFilter, query, records]);

  return (
    <section>
      <div>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Historique</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Toutes les générations</h1>
        <p className="mt-3 text-sm text-noline-muted">Retrouvez, filtrez et réutilisez chaque résultat produit.</p>
      </div>

      <div className="surface premium-border mt-7 grid gap-3 rounded-xl p-4 sm:grid-cols-[1fr_15rem]">
        <label className="flex items-center gap-3 rounded-md border border-white/10 bg-noline-black px-3">
          <Search className="h-4 w-4 text-noline-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un prompt, résultat ou client" className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-noline-muted" />
        </label>
        <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="field">
          <option value="all">Tous les agents</option>
          {agents.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>

      <div className="mt-6 grid gap-4">
        {filtered.length === 0 ? (
          <div className="surface premium-border rounded-xl p-8 text-center text-noline-muted">Aucune génération à afficher.</div>
        ) : (
          filtered.map((record) => (
            <GenerationHistoryCard
              key={record.id}
              record={{
                ...record,
                userPrompt: record.userPrompt || formatValues(record.values)
              }}
              onDelete={
                isSupabaseBrowserConfigured()
                  ? undefined
                  : () => setRecords(deleteHistoryRecord(record.id))
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

function formatValues(values: Record<string, string>) {
  return Object.values(values).filter(Boolean).join(" · ") || "Prompt non disponible";
}
