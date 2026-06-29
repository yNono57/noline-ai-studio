"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Image as ImageIcon } from "lucide-react";
import {
  normalizeGenerationRecord,
  mergeGenerationRecords,
  readHistory,
  type GenerationRecord
} from "@/lib/history";
import { readVisualHistory, type VisualRecord } from "@/lib/visual-history";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";
import { CopyButton } from "./CopyButton";

export function CreationsView() {
  const [texts, setTexts] = useState<GenerationRecord[]>([]);
  const [visuals, setVisuals] = useState<VisualRecord[]>([]);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setTexts(readHistory());
      setVisuals(readVisualHistory());
      return;
    }

    fetch("/api/creations", { headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) {
          setTexts(readHistory());
          setVisuals(readVisualHistory());
          return;
        }

        setTexts(
          mergeGenerationRecords(
            (data.texts || []).map(normalizeGenerationRecord),
            readHistory()
          )
        );
        setVisuals(
          (data.visuals || []).map((item: Record<string, unknown>) => ({
            id: String(item.id),
            title: String(item.title),
            format: item.format,
            width: Number(item.width),
            height: Number(item.height),
            svg: String(item.svg),
            createdAt: String(item.created_at)
          }))
        );
      })
      .catch(() => {
        setTexts(readHistory());
        setVisuals(readVisualHistory());
      });
  }, []);

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
        Mes creations
      </p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Historique textes et visuels</h1>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="mb-5 flex items-center gap-2">
            <FileText className="h-5 w-5 text-noline-orange" />
            <h2 className="text-xl font-black text-white">Textes generes</h2>
          </div>
          <div className="grid gap-3">
            {texts.length === 0 ? (
              <p className="rounded-md bg-noline-black p-5 text-sm text-noline-muted">Aucun texte pour le moment.</p>
            ) : (
              texts.map((item) => (
                <article key={item.id} className="rounded-md border border-white/10 bg-noline-black p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{item.title}</p>
                      <p className="text-xs text-noline-muted">{formatDate(item.createdAt)}</p>
                    </div>
                    <CopyButton text={item.output} />
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6 text-white">{item.output}</pre>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="mb-5 flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-noline-orange" />
            <h2 className="text-xl font-black text-white">Visuels exportes</h2>
          </div>
          <div className="grid gap-3">
            {visuals.length === 0 ? (
              <p className="rounded-md bg-noline-black p-5 text-sm text-noline-muted">
                Aucun visuel exporte. Exportez un PNG ou PDF depuis le createur pour l'ajouter ici.
              </p>
            ) : (
              visuals.map((item) => (
                <article key={item.id} className="rounded-md border border-white/10 bg-noline-black p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{item.title}</p>
                      <p className="text-xs text-noline-muted">{formatDate(item.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadSvg(item)}
                      className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-black text-noline-black transition hover:bg-noline-orange"
                    >
                      <Download className="h-4 w-4" />
                      SVG
                    </button>
                  </div>
                  <div className="max-h-72 overflow-hidden rounded-md bg-black">
                    <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`} alt="" className="h-auto w-full" />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function downloadSvg(item: VisualRecord) {
  const blob = new Blob([item.svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
