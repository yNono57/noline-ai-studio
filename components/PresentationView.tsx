"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { readActiveClient, readClients, type AgencyClient } from "@/lib/agency";
import { sectorTemplates } from "@/lib/templates";

export function PresentationView() {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [clientId, setClientId] = useState("");
  const client = clients.find((item) => item.id === clientId) || null;
  const template = sectorTemplates.find((item) => item.sector === client?.sector) || sectorTemplates[0];

  useEffect(() => {
    const stored = readClients();
    const active = readActiveClient();
    setClients(stored);
    setClientId(active?.id || stored[0]?.id || "");
  }, []);

  const proposal = useMemo(() => {
    if (!client) return "";
    return `Mini-proposition commerciale\n\nObjectif\nAider ${client.name} a professionnaliser sa communication et produire des contenus plus reguliers.\n\nApproche NOLINE STUDIO\n- Structurer une ligne visuelle reconnaissable\n- Creer des posts prets a publier\n- Valoriser les temps forts, offres et partenaires\n- Gagner du temps avec des templates reutilisables\n\nPack recommande\n3 visuels exemples + calendrier de contenus + proposition commerciale adaptee au secteur ${client.sector}.`;
  }, [client]);

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
        Presentation client
      </p>
      <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Convaincre avec un pack exemple</h1>

      <div className="mt-6 max-w-xl rounded-lg border border-white/10 bg-noline-black p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-white">Client</span>
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-noline-orange">
            <option value="">Choisir un client</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!client ? (
        <div className="mt-8 rounded-lg border border-white/10 bg-noline-black p-8 text-center">
          <p className="text-sm text-noline-muted">Ajoutez un client pour generer une presentation.</p>
          <Link href="/clients" className="mt-4 inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black">
            Ajouter un client
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="surface premium-border rounded-lg p-5 shadow-premium">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-noline-orange" />
              <h2 className="text-xl font-black text-white">Mini-proposition commerciale</h2>
            </div>
            <pre className="mt-5 whitespace-pre-wrap rounded-md border border-white/10 bg-noline-black p-4 text-sm leading-7 text-white">
              {proposal}
            </pre>
          </article>

          <div className="grid gap-6">
            <article className="surface premium-border rounded-lg p-5 shadow-premium">
              <h2 className="text-xl font-black text-white">Avant / apres</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Panel title="Avant" lines={["Posts irreguliers", "Identite visuelle peu stable", "Messages disperses", "Peu de preuves pour convaincre"]} />
                <Panel title="Apres" lines={["Templates reutilisables", "Couleurs et logo coherents", "Posts prets a publier", "Pack visuel pour vendre l'offre"]} highlighted />
              </div>
            </article>

            <article className="surface premium-border rounded-lg p-5 shadow-premium">
              <h2 className="text-xl font-black text-white">Pack de 3 visuels exemples</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {["Annonce", "Preuve", "Offre"].map((label, index) => (
                  <div key={label} className="aspect-square rounded-md border border-white/10 bg-noline-black p-4" style={{ background: `linear-gradient(135deg, ${client.primaryColor}, #111111 62%)` }}>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{template.sector}</p>
                    <p className="mt-12 text-2xl font-black leading-none text-white">{label}</p>
                    <p className="mt-3 text-sm text-white/75">{index === 0 ? template.headline : index === 1 ? "Avant / apres communication" : "Pack contenus mensuel"}</p>
                    <p className="mt-8 text-xs font-black text-white">{client.name}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}

function Panel({ title, lines, highlighted = false }: { title: string; lines: string[]; highlighted?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlighted ? "bg-noline-orange text-noline-black" : "border border-white/10 bg-noline-black text-white"}`}>
      <p className="font-black">{title}</p>
      <ul className="mt-4 space-y-2 text-sm font-bold">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}
