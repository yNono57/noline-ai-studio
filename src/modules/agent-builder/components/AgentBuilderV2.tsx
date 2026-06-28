"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  Clipboard,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  WandSparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import type {
  AgentRoadmap,
  BusinessScore,
  GeneratedAgent,
  IdeaAnalysis,
  ProductRecommendation
} from "../types";

interface AgentBuilderV2Response {
  analysis: IdeaAnalysis;
  businessScore: BusinessScore;
  agent: GeneratedAgent;
  roadmap: AgentRoadmap;
  recommendations: ProductRecommendation[];
}

interface ResultCard {
  id: keyof AgentBuilderV2Response;
  eyebrow: string;
  title: string;
  description: string;
  content: string;
  icon: typeof Bot;
  render: React.ReactNode;
}

const PROGRESS_STEPS = [
  "Analyse du marché",
  "Score business",
  "Construction de l'agent",
  "Roadmap",
  "Recommandations"
];

const EXAMPLE_IDEA =
  "Je voudrais créer un agent IA qui aide les restaurants à gérer leurs réservations.";

export function AgentBuilderV2() {
  const [idea, setIdea] = useState("");
  const [submittedIdea, setSubmittedIdea] = useState("");
  const [result, setResult] = useState<AgentBuilderV2Response | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 1, PROGRESS_STEPS.length - 1));
    }, 700);

    return () => window.clearInterval(timer);
  }, [loading]);

  async function generate(nextIdea: string) {
    const normalizedIdea = nextIdea.trim();
    if (!normalizedIdea) {
      setError("Décris ton idée en quelques mots avant de lancer l'analyse.");
      return;
    }

    setLoading(true);
    setProgress(0);
    setError("");
    setResult(null);
    setSubmittedIdea(normalizedIdea);

    try {
      const response = await fetch("/api/agent-builder-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: normalizedIdea })
      });
      const data = (await response.json()) as AgentBuilderV2Response & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "L'analyse n'a pas pu être générée.");
      }

      setProgress(PROGRESS_STEPS.length);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCard(card: ResultCard) {
    await navigator.clipboard.writeText(card.content);
    setCopiedCard(card.id);
    window.setTimeout(() => setCopiedCard(null), 1600);
  }

  function exportCard(card: ResultCard) {
    const blob = new Blob([card.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-builder-${card.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = result ? buildResultCards(result) : [];

  return (
    <Shell>
      <main className="space-y-6 pb-10">
        <header className="relative overflow-hidden rounded-xl border border-white/10 bg-[#181818] px-5 py-8 shadow-premium sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-noline-orange/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-noline-orange/30 bg-noline-orange/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-noline-orange">
              <WandSparkles className="h-3.5 w-3.5" />
              Agent Builder V2
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Une idée suffit. <span className="text-noline-orange">L’IA construit le reste.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-noline-muted sm:text-base">
              Décris ton concept librement. NØLINE analyse son potentiel, imagine l’agent et prépare
              une feuille de route exploitable.
            </p>
          </div>
        </header>

        {!loading && !result ? (
          <section className="surface premium-border rounded-xl p-5 shadow-premium sm:p-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noline-orange text-noline-black">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-noline-orange">
                    Étape 1 · Ton idée
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                    Décris simplement ton idée d’agent IA.
                  </h2>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void generate(idea);
                }}
              >
                <label htmlFor="agent-idea" className="sr-only">
                  Idée d’agent IA
                </label>
                <textarea
                  id="agent-idea"
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder={EXAMPLE_IDEA}
                  rows={7}
                  maxLength={2000}
                  className="w-full resize-y rounded-xl border border-white/10 bg-noline-black p-5 text-base leading-7 text-white outline-none transition placeholder:text-noline-muted/70 focus:border-noline-orange focus:ring-4 focus:ring-noline-orange/10"
                />
                <div className="mt-3 flex items-center justify-between gap-4 text-xs text-noline-muted">
                  <button
                    type="button"
                    onClick={() => setIdea(EXAMPLE_IDEA)}
                    className="text-left font-bold transition hover:text-white"
                  >
                    Utiliser l’exemple
                  </button>
                  <span>{idea.length}/2000</span>
                </div>

                {error ? <ErrorMessage message={error} /> : null}

                <button
                  type="submit"
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-noline-orange px-6 py-3 text-sm font-black text-noline-black transition hover:bg-white sm:w-auto"
                >
                  Analyser l’idée
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {loading ? (
          <LoadingProgress currentStep={progress} idea={submittedIdea} />
        ) : null}

        {!loading && result ? (
          <section className="space-y-5">
            <div className="flex flex-col gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Étape 3 · Agent prêt
                </p>
                <h2 className="mt-1 text-xl font-black text-white">{result.agent.name}</h2>
                <p className="mt-1 max-w-2xl text-sm text-noline-muted">{submittedIdea}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setError("");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:border-noline-orange hover:text-noline-orange"
              >
                <Sparkles className="h-4 w-4" />
                Nouvelle idée
              </button>
            </div>

            {error ? <ErrorMessage message={error} /> : null}

            <div className="grid gap-5 xl:grid-cols-2">
              {cards.map((card, index) => {
                const Icon = card.icon;

                return (
                  <article
                    key={card.id}
                    className={`surface premium-border overflow-hidden rounded-xl shadow-premium ${
                      index === 2 ? "xl:col-span-2" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-noline-orange/30 bg-noline-orange/10 text-noline-orange">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-noline-orange">
                            {card.eyebrow}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-white">{card.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-noline-muted">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CardAction
                          label={copiedCard === card.id ? "Copié" : "Copier"}
                          icon={copiedCard === card.id ? Check : Clipboard}
                          onClick={() => void copyCard(card)}
                        />
                        <CardAction
                          label="Régénérer"
                          icon={RefreshCw}
                          onClick={() => void generate(submittedIdea)}
                        />
                        <CardAction
                          label="Export Markdown"
                          icon={Download}
                          onClick={() => exportCard(card)}
                        />
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">{card.render}</div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </Shell>
  );
}

function LoadingProgress({ currentStep, idea }: { currentStep: number; idea: string }) {
  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="surface premium-border rounded-xl p-6 shadow-premium sm:p-9"
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-noline-orange/10 text-noline-orange">
            <div className="absolute inset-0 animate-ping rounded-xl border border-noline-orange/30" />
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-noline-orange">
              Étape 2 · Analyse en cours
            </p>
            <h2 className="mt-1 text-xl font-black text-white">Nous construisons ton agent</h2>
          </div>
        </div>
        <p className="mt-5 rounded-lg border border-white/10 bg-noline-black/60 p-4 text-sm italic leading-6 text-noline-muted">
          « {idea} »
        </p>
        <ol className="mt-6 space-y-3">
          {PROGRESS_STEPS.map((step, index) => {
            const completed = index < currentStep;
            const active = index === currentStep;

            return (
              <li
                key={step}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold transition ${
                  completed
                    ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                    : active
                      ? "border-noline-orange/30 bg-noline-orange/10 text-white"
                      : "border-white/5 text-noline-muted"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    completed ? "bg-emerald-400 text-noline-black" : "bg-white/5"
                  }`}
                >
                  {completed ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-noline-orange" />
                  ) : (
                    index + 1
                  )}
                </span>
                {step}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function CardAction({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: typeof Bot;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-noline-black px-3 py-2 text-xs font-black text-white transition hover:border-noline-orange hover:text-noline-orange"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function buildResultCards(result: AgentBuilderV2Response): ResultCard[] {
  return [
    {
      id: "analysis",
      eyebrow: "Carte 1",
      title: "Analyse",
      description: "Le marché, la cible et le besoin détectés.",
      icon: Target,
      content: analysisMarkdown(result.analysis),
      render: <AnalysisContent analysis={result.analysis} />
    },
    {
      id: "businessScore",
      eyebrow: "Carte 2",
      title: "Score business",
      description: "Une lecture rapide du potentiel de l’idée.",
      icon: TrendingUp,
      content: businessScoreMarkdown(result.businessScore),
      render: <BusinessScoreContent score={result.businessScore} />
    },
    {
      id: "agent",
      eyebrow: "Carte 3",
      title: "Fiche complète",
      description: "Le positionnement et les paramètres du futur agent.",
      icon: Bot,
      content: agentMarkdown(result.agent),
      render: <AgentContent agent={result.agent} />
    },
    {
      id: "roadmap",
      eyebrow: "Carte 4",
      title: "Roadmap",
      description: "Les étapes prioritaires pour passer de l’idée au produit.",
      icon: ArrowRight,
      content: roadmapMarkdown(result.roadmap),
      render: <RoadmapContent roadmap={result.roadmap} />
    },
    {
      id: "recommendations",
      eyebrow: "Carte 5",
      title: "Recommandations",
      description: "Les décisions produit les plus utiles maintenant.",
      icon: WandSparkles,
      content: recommendationsMarkdown(result.recommendations),
      render: <RecommendationsContent recommendations={result.recommendations} />
    }
  ];
}

function AnalysisContent({ analysis }: { analysis: IdeaAnalysis }) {
  return (
    <div className="space-y-5 text-sm">
      <p className="text-base leading-7 text-white">{analysis.summary}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoItem label="Secteur" value={analysis.sector} />
        <InfoItem label="Cible" value={analysis.targetAudience} />
        <InfoItem label="Problème" value={analysis.problem} />
        <InfoItem label="Besoin" value={analysis.need} />
      </div>
      <InfoItem label="Proposition de valeur" value={analysis.valueProposition} />
    </div>
  );
}

function BusinessScoreContent({ score }: { score: BusinessScore }) {
  const criteria = [
    ["Besoin marché", score.marketNeed],
    ["Clarté de la cible", score.targetClarity],
    ["Différenciation", score.differentiation],
    ["Faisabilité", score.feasibility],
    ["Monétisation", score.monetizationPotential]
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <span className="text-5xl font-black text-noline-orange">{score.overall}</span>
        <span className="pb-1 text-sm font-bold text-noline-muted">/ 100</span>
      </div>
      <div className="space-y-4">
        {criteria.map(([label, criterion]) => (
          <div key={label}>
            <div className="mb-1.5 flex justify-between text-xs font-black text-white">
              <span>{label}</span>
              <span>{criterion.score}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-noline-orange"
                style={{ width: `${Math.min(100, Math.max(0, criterion.score))}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-noline-muted">{criterion.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentContent({ agent }: { agent: GeneratedAgent }) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-2xl font-black text-white">{agent.name}</h4>
        <p className="mt-2 text-sm leading-6 text-noline-muted">{agent.description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoItem label="Mission" value={agent.mission} />
        <InfoItem label="Cible" value={agent.targetAudience} />
        <InfoItem label="Objectif business" value={agent.businessGoal} />
      </div>
      <TagList label="Fonctionnalités" values={agent.features} />
      <TagList label="Entrées suggérées" values={agent.suggestedInputs} />
      <InfoItem label="Sortie attendue" value={agent.expectedOutput} />
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-noline-orange">
          Prompt système
        </p>
        <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-noline-black p-4 text-xs leading-6 text-white">
          {agent.systemPrompt}
        </pre>
      </div>
    </div>
  );
}

function RoadmapContent({ roadmap }: { roadmap: AgentRoadmap }) {
  return (
    <div>
      <p className="mb-5 text-sm leading-6 text-white">{roadmap.objective}</p>
      <ol className="space-y-4">
        {roadmap.phases.map((phase) => (
          <li key={phase.order} className="relative border-l border-noline-orange/40 pl-5">
            <span className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-noline-orange text-xs font-black text-noline-black">
              {phase.order}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-black text-white">{phase.title}</h4>
              <span className="text-xs font-bold text-noline-muted">{phase.estimatedDuration}</span>
            </div>
            <p className="mt-1 text-sm text-noline-muted">{phase.objective}</p>
            <ul className="mt-2 space-y-1 text-xs text-white">
              {phase.deliverables.map((deliverable) => (
                <li key={deliverable}>— {deliverable}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecommendationsContent({
  recommendations
}: {
  recommendations: ProductRecommendation[];
}) {
  return (
    <div className="space-y-3">
      {recommendations.map((recommendation) => (
        <div key={recommendation.title} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-black text-white">{recommendation.title}</h4>
            <span className="rounded-full bg-noline-orange/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-noline-orange">
              {recommendation.priority}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-noline-muted">{recommendation.rationale}</p>
          <p className="mt-2 text-xs font-bold text-white">{recommendation.expectedImpact}</p>
        </div>
      ))}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-noline-orange">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-noline-orange">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function analysisMarkdown(analysis: IdeaAnalysis) {
  return `# Analyse

${analysis.summary}

- **Secteur :** ${analysis.sector}
- **Cible :** ${analysis.targetAudience}
- **Problème :** ${analysis.problem}
- **Besoin :** ${analysis.need}
- **Proposition de valeur :** ${analysis.valueProposition}
- **Confiance :** ${analysis.confidence}

## Hypothèses
${analysis.assumptions.map((item) => `- ${item}`).join("\n")}`;
}

function businessScoreMarkdown(score: BusinessScore) {
  return `# Score business — ${score.overall}/100

- **Besoin marché (${score.marketNeed.score}) :** ${score.marketNeed.rationale}
- **Clarté de la cible (${score.targetClarity.score}) :** ${score.targetClarity.rationale}
- **Différenciation (${score.differentiation.score}) :** ${score.differentiation.rationale}
- **Faisabilité (${score.feasibility.score}) :** ${score.feasibility.rationale}
- **Monétisation (${score.monetizationPotential.score}) :** ${score.monetizationPotential.rationale}

## Prochaine validation
${score.nextValidationStep}`;
}

function agentMarkdown(agent: GeneratedAgent) {
  return `# ${agent.name}

${agent.description}

- **Secteur :** ${agent.sector}
- **Cible :** ${agent.targetAudience}
- **Mission :** ${agent.mission}
- **Complexité :** ${agent.complexity}
- **Objectif business :** ${agent.businessGoal}

## Fonctionnalités
${agent.features.map((item) => `- ${item}`).join("\n")}

## Prompt système
${agent.systemPrompt}

## Sortie attendue
${agent.expectedOutput}`;
}

function roadmapMarkdown(roadmap: AgentRoadmap) {
  return `# Roadmap

${roadmap.objective}

${roadmap.phases
  .map(
    (phase) => `## ${phase.order}. ${phase.title}

${phase.objective}

- **Durée :** ${phase.estimatedDuration}
- **Priorité :** ${phase.priority}
${phase.deliverables.map((item) => `- ${item}`).join("\n")}`
  )
  .join("\n\n")}`;
}

function recommendationsMarkdown(recommendations: ProductRecommendation[]) {
  return `# Recommandations

${recommendations
  .map(
    (item) => `## ${item.title}

${item.rationale}

- **Catégorie :** ${item.category}
- **Priorité :** ${item.priority}
- **Effort :** ${item.effort}
- **Impact :** ${item.expectedImpact}
${item.actionItems.map((action) => `- ${action}`).join("\n")}`
  )
  .join("\n\n")}`;
}
