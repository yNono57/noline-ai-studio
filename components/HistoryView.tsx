"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { clearHistory, readHistory, type GenerationRecord } from "@/lib/history";
import { CopyButton } from "./CopyButton";

export function HistoryView() {
  const [records, setRecords] = useState<GenerationRecord[]>([]);

  useEffect(() => {
    setRecords(readHistory());
  }, []);

  function clear() {
    clearHistory();
    setRecords([]);
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
            Historique
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Dernieres generations
          </h1>
          <p className="mt-3 text-sm text-noline-muted">
            Les 30 derniers contenus sont conserves dans ce navigateur.
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-white/12 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
        >
          <Trash2 className="h-4 w-4" />
          Vider
        </button>
      </div>

      {records.length === 0 ? (
        <div className="surface premium-border rounded-lg p-8 text-center text-noline-muted">
          Aucun contenu dans l'historique pour le moment.
        </div>
      ) : (
        <div className="grid gap-4">
          {records.map((record) => (
            <article key={record.id} className="surface premium-border rounded-lg p-5">
              <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-black text-white">{record.title}</h2>
                  <p className="mt-1 text-xs text-noline-muted">
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(new Date(record.createdAt))}
                  </p>
                </div>
                <CopyButton text={record.output} />
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-7 text-white">{record.output}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
