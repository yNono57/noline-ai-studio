import { Shell } from "@/components/Shell";
import { GeneratorCard } from "@/components/GeneratorCard";
import { generators } from "@/lib/generators";

export default function GeneratorsPage() {
  return (
    <Shell>
      <section>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
          Generateurs
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Modules disponibles</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-noline-muted">
          Choisissez un module pour generer un texte, un document commercial ou un visuel pret a
          publier.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generators.map((generator) => (
            <GeneratorCard key={generator.id} generator={generator} />
          ))}
        </div>
      </section>
    </Shell>
  );
}
