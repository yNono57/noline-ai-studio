import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GeneratorConfig } from "@/lib/generators";

export function GeneratorCard({ generator }: { generator: GeneratorConfig }) {
  const Icon = generator.icon;

  return (
    <Link
      href={`/generate?tool=${generator.id}`}
      className="group surface premium-border flex min-h-48 flex-col justify-between rounded-lg p-5 transition hover:-translate-y-1 hover:border-noline-orange/80"
    >
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-noline-orange text-noline-black">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-noline-muted">
            {generator.plan}
          </span>
        </div>
        <h3 className="text-lg font-black text-white">{generator.title}</h3>
        <p className="mt-2 text-sm leading-6 text-noline-muted">{generator.description}</p>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm font-black text-noline-orange">
        Ouvrir
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
