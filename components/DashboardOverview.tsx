"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Clock3, Heart, History, Plus, Sparkles, UsersRound } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { readAgents } from "@/lib/agents";
import { readClients } from "@/lib/agency";
import { readFavorites, type FavoriteRecord } from "@/lib/favorites";
import { readHistory, type GenerationRecord } from "@/lib/history";
import { officialAgents } from "@/lib/official-agents";

export function DashboardOverview() {
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [customAgents, setCustomAgents] = useState(0);
  const [clients, setClients] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setHistory(readHistory());
      setFavorites(readFavorites());
      setCustomAgents(readAgents().length);
      setClients(readClients().length);
    };
    refresh();
    window.addEventListener("noline:favorites", refresh);
    return () => window.removeEventListener("noline:favorites", refresh);
  }, []);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-noline-graphite to-noline-black p-6 shadow-premium sm:p-9">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-noline-orange/15 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-noline-orange">NØLINE AI STUDIO</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-6xl">
            Pilotez votre production IA depuis un seul espace.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-noline-muted">
            Agents spécialisés, clients, historique et quotas : votre studio est prêt à produire pour chaque organisation.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agents" value={`${officialAgents.length + customAgents}`} helper={`${officialAgents.length} officiels`} icon={Bot} />
        <StatCard label="Générations" value={`${history.length}`} helper="Historique disponible" icon={Sparkles} />
        <StatCard label="Clients" value={`${clients}`} helper="Fiches personnalisables" icon={UsersRound} />
        <StatCard label="Favoris" value={`${favorites.length}`} helper="Agents et générations" icon={Heart} />
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-noline-orange">Accès rapide</p>
            <h2 className="mt-2 text-2xl font-black text-white">Continuer votre travail</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Shortcut href="/agent-builder" label="Créer un agent" description="Concevoir un spécialiste sur mesure" icon={Plus} />
          <Shortcut href="/agents" label="Voir les agents" description="Lancer un agent officiel ou personnel" icon={Bot} />
          <Shortcut href="/history" label="Historique" description="Retrouver et réutiliser les résultats" icon={History} />
          <Shortcut href="/clients" label="Clients" description="Gérer les identités et coordonnées" icon={UsersRound} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="surface premium-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-noline-orange" />
            <h2 className="text-xl font-black text-white">Activité récente</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {history.length === 0 ? <p className="rounded-lg bg-noline-black p-5 text-sm text-noline-muted">Lancez votre premier agent pour voir l’activité ici.</p> : null}
            {history.slice(0, 5).map((record) => (
              <Link key={record.id} href="/history" className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-noline-black p-4 transition hover:border-noline-orange/60">
                <div className="min-w-0">
                  <p className="font-black text-white">{record.title}</p>
                  <p className="mt-1 truncate text-sm text-noline-muted">{record.output}</p>
                </div>
                <time className="shrink-0 text-xs font-bold text-noline-muted">{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(record.createdAt))}</time>
              </Link>
            ))}
          </div>
        </section>

        <section className="surface premium-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-noline-orange" />
            <h2 className="text-xl font-black text-white">Favoris</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {favorites.length === 0 ? <p className="rounded-lg bg-noline-black p-5 text-sm text-noline-muted">Ajoutez un agent ou une génération en favori.</p> : null}
            {favorites.slice(0, 6).map((favorite) => (
              <Link key={favorite.id} href={favorite.type === "agent" ? `/agents/${favorite.targetId}` : "/history"} className="flex items-center justify-between rounded-lg border border-white/10 bg-noline-black p-4 hover:border-noline-orange/60">
                <div>
                  <p className="font-black text-white">{favorite.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-noline-muted">{favorite.type === "agent" ? "Agent" : "Génération"}</p>
                </div>
                <Heart className="h-4 w-4 fill-noline-orange text-noline-orange" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Shortcut({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: typeof Bot }) {
  return (
    <Link href={href} className="surface premium-border group rounded-xl p-5 transition hover:-translate-y-1 hover:border-noline-orange/60">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-noline-orange text-noline-black"><Icon className="h-5 w-5" /></div>
      <p className="mt-4 font-black text-white group-hover:text-noline-orange">{label}</p>
      <p className="mt-1 text-sm leading-5 text-noline-muted">{description}</p>
    </Link>
  );
}
