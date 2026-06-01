import Link from "next/link";
import { ArrowRight, BarChart3, ContactRound, Sparkles, Users } from "lucide-react";
import { GeneratorCard } from "@/components/GeneratorCard";
import { AccountSummary } from "@/components/AccountSummary";
import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";
import { generators } from "@/lib/generators";

export default function DashboardPage() {
  return (
    <Shell>
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-noline-orange">
            Dashboard
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
            Pilotez vos clients, templates, contenus, visuels et prospects.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-noline-muted">
            Travaillez en mode agence: choisissez un client, appliquez ses couleurs, selectionnez un
            template secteur et exportez les formats reseaux sociaux.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white"
            >
              <Sparkles className="h-4 w-4" />
              Creer un visuel
            </Link>
            <Link
              href="/crm"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/12 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
            >
              Ouvrir le CRM
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="surface premium-border rounded-lg p-5 shadow-premium">
          <p className="text-sm font-black text-white">Plan de lancement</p>
          <div className="mt-5 grid gap-3">
            {["Clients agence", "Templates secteurs", "Exports reseaux", "Presentations client", "CRM prospects"].map(
              (item) => (
                <div key={item} className="flex items-center justify-between rounded-md bg-white/6 p-4">
                  <span className="text-sm font-bold text-white">{item}</span>
                  <span className="h-2 w-2 rounded-full bg-noline-orange" />
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Modules" value="10" helper="Texte, business et visuels" icon={Sparkles} />
        <StatCard label="Cibles" value="3" helper="Clubs, assos, entreprises" icon={Users} />
        <StatCard label="Visuels" value="3" helper="Carre, story, banniere" icon={BarChart3} />
        <StatCard label="CRM" value="1" helper="Pipeline prospects inclus" icon={ContactRound} />
      </section>

      <section className="mt-10">
        <AccountSummary />
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
              Outils
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">Generateurs disponibles</h2>
          </div>
          <BarChart3 className="hidden h-6 w-6 text-noline-muted sm:block" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generators.map((generator) => (
            <GeneratorCard key={generator.id} generator={generator} />
          ))}
        </div>
      </section>
    </Shell>
  );
}
