import { Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import { StripeCheckoutButton } from "@/components/StripeButtons";

const plans = [
  {
    name: "Gratuit",
    plan: "free",
    price: "0 EUR",
    detail: "5 generations/mois",
    features: ["Textes IA de base", "Templates visuels", "Export PNG", "Historique local"]
  },
  {
    name: "Starter",
    plan: "starter",
    price: "19 EUR/mois",
    detail: "Pour produire regulierement",
    features: ["Generations augmentees", "Export PNG/PDF", "Marque client", "Mes creations"]
  },
  {
    name: "Pro",
    plan: "pro",
    price: "49 EUR/mois",
    detail: "Pour NOLINE STUDIO et clients actifs",
    features: ["Usage avance", "CRM prospects", "Modules commerciaux", "Support prioritaire"]
  }
];

export default function PricingPage() {
  return (
    <Shell>
      <section>
        <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">Tarifs</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">3 offres simples</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-lg p-6 shadow-premium ${
                plan.name === "Starter"
                  ? "border border-noline-orange bg-noline-orange text-noline-black"
                  : "surface premium-border text-white"
              }`}
            >
              <p className="text-lg font-black">{plan.name}</p>
              <p className="mt-4 text-4xl font-black">{plan.price}</p>
              <p className={`mt-2 text-sm ${plan.name === "Starter" ? "text-noline-black/70" : "text-noline-muted"}`}>
                {plan.detail}
              </p>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm font-bold">
                    <Check className="h-4 w-4" />
                    {feature}
                  </p>
                ))}
              </div>
              {plan.plan === "starter" ? (
                <StripeCheckoutButton plan="starter" label="Souscrire Starter" variant="orange" />
              ) : null}
              {plan.plan === "pro" ? (
                <StripeCheckoutButton plan="pro" label="Souscrire Pro" />
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
