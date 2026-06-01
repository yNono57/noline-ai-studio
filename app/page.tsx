import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { Brand } from "@/components/Brand";

const benefits = [
  "Textes Facebook, Instagram et hashtags en quelques secondes",
  "Templates visuels modifies dans l'application",
  "Exports PNG/PDF pour posts, stories et bannieres",
  "Marques clients, CRM et historique centralises"
];

const plans = [
  { name: "Gratuit", price: "0 EUR", detail: "5 generations/mois" },
  { name: "Starter", price: "19 EUR/mois", detail: "Studio visuel + historique" },
  { name: "Pro", price: "49 EUR/mois", detail: "CRM, marques clients et usage avance" }
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-noline-black/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/generators" className="rounded-md px-4 py-2 text-sm font-bold text-noline-muted hover:text-white">
              Generateurs
            </Link>
            <Link href="/pricing" className="rounded-md px-4 py-2 text-sm font-bold text-noline-muted hover:text-white">
              Tarifs
            </Link>
            <Link href="/dashboard" className="rounded-md bg-white px-4 py-2 text-sm font-black text-noline-black">
              Acceder
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-noline-orange">
            NOLINE AI STUDIO
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight text-white sm:text-7xl">
            Le SaaS interne pour produire textes et visuels clients plus vite.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-noline-muted">
            Creez des posts sportifs, scripts, propositions commerciales et visuels reseaux sociaux
            depuis des templates professionnels, sans generer d'images aleatoires.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-noline-orange px-6 py-3 text-sm font-black text-noline-black transition hover:bg-white"
            >
              <Sparkles className="h-4 w-4" />
              Creer un visuel
            </Link>
            <Link
              href="/generators"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/12 px-6 py-3 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
            >
              Voir les generateurs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="aspect-[4/5] rounded-md border border-white/10 bg-noline-black p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-noline-orange px-3 py-2 text-xs font-black text-noline-black">
                MATCHDAY
              </span>
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div className="mt-28">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-noline-orange">
                Template live
              </p>
              <p className="mt-5 text-5xl font-black leading-none text-white">POST PRET A PUBLIER</p>
              <p className="mt-5 text-sm leading-6 text-noline-muted">
                Logo, photo, couleurs, format story ou carre, export PNG/PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {benefits.map((benefit) => (
            <div key={benefit} className="surface premium-border rounded-lg p-5">
              <CheckCircle2 className="h-5 w-5 text-noline-orange" />
              <p className="mt-4 text-sm font-bold leading-6 text-white">{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Tarifs</p>
          <h2 className="mt-2 text-3xl font-black text-white">Des offres simples pour lancer le studio</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="surface premium-border rounded-lg p-6">
              <p className="text-lg font-black text-white">{plan.name}</p>
              <p className="mt-4 text-3xl font-black text-white">{plan.price}</p>
              <p className="mt-3 text-sm text-noline-muted">{plan.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
