"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { FavoriteButton } from "./FavoriteButton";
import { deleteHistoryRecord, readHistory, type GenerationRecord } from "@/lib/history";

export function HistoryView() {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  useEffect(() => setRecords(readHistory()), []);

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
            <article key={record.id} className="surface premium-border rounded-xl p-5">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-white">{record.title}</h2>
                    {record.clientName ? <span className="rounded-full bg-noline-orange/15 px-2 py-1 text-xs font-black text-noline-orange">{record.clientName}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-noline-muted">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}</p>
                </div>
                <div className="flex gap-2">
                  <CopyButton text={record.output} />
                  <FavoriteButton type="generation" targetId={record.id} label={record.title} compact />
                  <button type="button" onClick={() => setRecords(deleteHistoryRecord(record.id))} className="grid h-9 w-9 place-items-center rounded-md border border-red-400/30 text-red-200" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-noline-orange">Prompt utilisateur</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-noline-muted">{record.userPrompt || formatValues(record.values)}</p>
                </div>
                <pre className="whitespace-pre-wrap rounded-lg bg-noline-black p-4 text-sm leading-7 text-white">{record.output}</pre>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatValues(values: Record<string, string>) {
  return Object.values(values).filter(Boolean).join(" · ") || "Prompt non disponible";
}
