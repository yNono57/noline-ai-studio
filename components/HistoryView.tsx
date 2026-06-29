"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { GenerationHistoryCard } from "./agent-report/GenerationHistoryCard";
import {
  clearHistory,
  deleteHistoryRecord,
  mergeGenerationRecords,
  normalizeGenerationRecord,
  readHistory,
  type GenerationRecord
} from "@/lib/history";
import {
  deleteAllRemoteHistory,
  deleteRemoteHistoryRecord
} from "@/lib/history-api";
import {
  getAuthenticatedHeaders,
  isSupabaseBrowserConfigured
} from "@/lib/supabase-client";

export function HistoryView() {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setRecords(readHistory());
      return;
    }

    let cancelled = false;

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
          ? data.records.map((item: Record<string, unknown>) =>
              ({
                ...normalizeGenerationRecord(item),
                storage: "supabase" as const
              })
            )
          : [];
        setRecords(mergeGenerationRecords(remote, readHistory()));
      } catch {
        if (!cancelled) setRecords(readHistory());
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function deleteRecord(record: GenerationRecord) {
    setDeleteError("");
    try {
      if (record.storage === "supabase" && isSupabaseBrowserConfigured()) {
        await deleteRemoteHistoryRecord(record.id);
      }
      deleteHistoryRecord(record.id);
      setRecords((current) =>
        current.filter((item) => item.id !== record.id)
      );
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "Suppression impossible."
      );
      throw caught;
    }
  }

  async function deleteAll() {
    const confirmation = window.prompt(
      "Cette action est irréversible. Tapez SUPPRIMER pour effacer tout l’historique."
    );
    if (confirmation !== "SUPPRIMER") return;

    setDeletingAll(true);
    setDeleteError("");
    try {
      if (isSupabaseBrowserConfigured()) {
        await deleteAllRemoteHistory();
      }
      clearHistory();
      setRecords([]);
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "Suppression impossible."
      );
    } finally {
      setDeletingAll(false);
    }
  }

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Historique</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Toutes les générations</h1>
        <p className="mt-3 text-sm text-noline-muted">Retrouvez, filtrez et réutilisez chaque résultat produit.</p>
        </div>
        <button
          type="button"
          disabled={deletingAll || records.length === 0}
          onClick={() => void deleteAll()}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-red-400/30 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deletingAll ? "Suppression..." : "Tout supprimer"}
        </button>
      </div>

      {deleteError ? (
        <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {deleteError}
        </p>
      ) : null}

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
              onDelete={() => deleteRecord(record)}
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
