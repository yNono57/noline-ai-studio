"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Palette } from "lucide-react";
import { readCustomTemplates, saveCustomTemplate, sectorTemplates, type SectorTemplate } from "@/lib/templates";

export function TemplatesView() {
  const [custom, setCustom] = useState<SectorTemplate[]>([]);
  const templates = [...sectorTemplates, ...custom];

  useEffect(() => setCustom(readCustomTemplates()), []);

  function duplicate(template: SectorTemplate) {
    const next = saveCustomTemplate({
      ...template,
      id: `${template.id}-copy-${Date.now()}`,
      name: `${template.name} copie`
    });
    setCustom(next);
  }

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
        Bibliotheque
      </p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Templates par secteur</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-noline-muted">
        Selectionnez un template dans le createur, dupliquez-le, puis modifiez couleurs, textes,
        logo et image de fond.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article key={template.id} className="surface premium-border rounded-lg p-4 shadow-premium">
            <div className="aspect-square rounded-md border border-white/10 bg-noline-black p-5" style={{ background: `linear-gradient(135deg, ${template.primaryColor}, #111111 58%)` }}>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: template.secondaryColor }}>
                {template.kicker}
              </p>
              <p className="mt-16 text-3xl font-black leading-none text-white">{template.headline}</p>
              <p className="mt-4 text-sm font-bold text-white/80">{template.subheadline}</p>
              <p className="mt-10 text-xs leading-5 text-white/70">{template.footer}</p>
            </div>
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-white">{template.name}</h2>
                  <p className="mt-1 text-sm text-noline-muted">{template.sector}</p>
                </div>
                <Palette className="h-5 w-5 text-noline-orange" />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => duplicate(template)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-white/12 px-3 py-2 text-sm font-black text-white hover:bg-white hover:text-noline-black">
                  <Copy className="h-4 w-4" />
                  Dupliquer
                </button>
                <Link href="/generate" className="flex-1 rounded-md bg-noline-orange px-3 py-2 text-center text-sm font-black text-noline-black hover:bg-white">
                  Modifier
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
