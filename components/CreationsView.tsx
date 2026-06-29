"use client";

import { useEffect, useState } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import { readVisualHistory, type VisualRecord } from "@/lib/visual-history";
import { getAuthenticatedHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

export function CreationsView() {
  const [visuals, setVisuals] = useState<VisualRecord[]>([]);
  useEffect(() => {
    async function load() {
      if (!isSupabaseBrowserConfigured()) { setVisuals(readVisualHistory()); return; }
      try {
        const headers = await getAuthenticatedHeaders();
        const response = await fetch("/api/creations", { headers, cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        setVisuals(Array.isArray(data?.visuals) ? data.visuals.map((item: Record<string, unknown>) => ({ id: String(item.id), title: String(item.title), format: item.format, width: Number(item.width), height: Number(item.height), svg: String(item.svg), createdAt: String(item.created_at) })) : readVisualHistory());
      } catch { setVisuals(readVisualHistory()); }
    }
    void load();
  }, []);
  return <section><p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Documents</p><h1 className="mt-2 text-4xl font-black text-white">Créations visuelles & exports</h1><p className="mt-3 text-sm text-noline-muted">Les rapports textuels sont désormais centralisés dans l’Historique IA.</p><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visuals.map((item) => <article key={item.id} className="surface premium-border rounded-xl p-4"><div className="max-h-72 overflow-hidden rounded-lg bg-black"><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`} alt="" className="w-full" /></div><div className="mt-4 flex items-center justify-between"><div><p className="font-black text-white">{item.title}</p><p className="text-xs text-noline-muted">{new Date(item.createdAt).toLocaleString("fr-FR")}</p></div><button onClick={() => download(item)} className="rounded-md bg-white p-2 text-black"><Download className="h-4 w-4" /></button></div></article>)}</div>{visuals.length === 0 ? <div className="surface premium-border mt-8 rounded-xl p-10 text-center text-noline-muted"><ImageIcon className="mx-auto mb-3 h-7 w-7 text-noline-orange" />Aucun visuel exporté pour le moment.</div> : null}</section>;
}
function download(item: VisualRecord) { const blob = new Blob([item.svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`; link.click(); URL.revokeObjectURL(url); }
