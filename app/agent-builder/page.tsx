"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Bot, Check, Loader2, Save, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { Shell } from "@/components/Shell";
import { generators, type GeneratorConfig } from "@/lib/generators";
import { saveAgentLocal } from "@/lib/agents";
import { saveRecord } from "@/lib/history";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

export default function AgentBuilderPage() {
  const agentBuilder = useMemo(
    () => generators.find((generator) => generator.id === "agent-builder") as GeneratorConfig,
    []
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(agentBuilder.fields.map((field) => [field.name, ""]))
  );
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSubmitValues, setLastSubmitValues] = useState<Record<string, string> | null>(null);
  const [savingAgent, setSavingAgent] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function toggleTone(tone: string) {
    setSelectedTones((current) =>
      current.includes(tone) ? current.filter((item) => item !== tone) : [...current, tone]
    );
  }

  function buildSubmitValues() {
    return {
      ...values,
      tone: selectedTones.join(", ")
    };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOutput("");
    setDemo(false);
    setSaveMessage("");
    setSaveError("");
    const submitValues = buildSubmitValues();

    try {
      const response = await fetch("/api/agent-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ generatorId: agentBuilder.id, values: submitValues })
      });
      const data = (await response.json()) as { output?: string; error?: string; demo?: boolean };

      if (!response.ok || !data.output) {
        throw new Error(data.error || "Creation de l'agent impossible.");
      }

      setOutput(data.output);
      setDemo(Boolean(data.demo));
      setLastSubmitValues(submitValues);

      if (!isSupabaseBrowserConfigured()) {
        saveRecord({
          id: crypto.randomUUID(),
          generatorId: agentBuilder.id,
          title: agentBuilder.title,
          createdAt: new Date().toISOString(),
          values: submitValues,
          output: data.output
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAgent() {
    if (!output || !lastSubmitValues) return;

    const agent = {
      name: lastSubmitValues.agentName,
      clientType: lastSubmitValues.clientType,
      mission: lastSubmitValues.mission,
      features: lastSubmitValues.features,
      tone: lastSubmitValues.tone,
      complexity: lastSubmitValues.complexity,
      businessGoal: lastSubmitValues.businessGoal,
      output
    };

    setSavingAgent(true);
    setSaveMessage("");
    setSaveError("");

    try {
      if (!isSupabaseBrowserConfigured()) {
        saveAgentLocal(agent);
        setSaveMessage("Agent sauvegarde dans votre bibliotheque locale.");
        return;
      }

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(agent)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Sauvegarde impossible.");
      }

      setSaveMessage("Agent sauvegarde dans votre bibliotheque.");
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setSavingAgent(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <section className="surface premium-border rounded-lg p-5 shadow-premium sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
                NØLINE Agent Builder
              </p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                Creer une fiche complete d'agent IA
              </h1>
              <p className="mt-3 text-sm leading-6 text-noline-muted">
                Transformez une idee d'agent en offre claire: positionnement, fonctionnalites,
                prompt systeme, argumentaire commercial, prix conseille et evolutions futures.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-noline-orange/40 bg-noline-orange/10 text-noline-orange">
              <Bot className="h-7 w-7" />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="surface premium-border rounded-lg p-5 shadow-premium">
            <div className="mb-5">
              <p className="text-sm font-black text-white">Brief de l'agent</p>
              <p className="mt-1 text-xs leading-5 text-noline-muted">
                Renseignez les informations essentielles pour produire une fiche exploitable par
                NOLINE AI STUDIO.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {agentBuilder.fields.map((field) => {
                if (field.name === "tone" && field.type === "multiselect") {
                  return (
                    <div key={field.name} className="block">
                      <span className="mb-2 block text-sm font-bold text-white">{field.label}</span>
                      <p className="mb-3 text-xs font-bold text-noline-muted">
                        Selectionnez une ou plusieurs tonalites.
                      </p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                        {field.options?.map((option) => {
                          const selected = selectedTones.includes(option);

                          return (
                            <label key={option} className="block">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleTone(option)}
                                className="sr-only"
                              />
                              <span
                                className={`inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-full border px-3 py-2 text-left text-xs font-black leading-4 transition sm:text-sm ${
                                  selected
                                    ? "border-noline-orange bg-noline-orange text-white shadow-[0_0_0_1px_rgba(255,107,0,0.25)]"
                                    : "border-white/10 bg-noline-black text-noline-muted hover:border-white/30 hover:text-white"
                                }`}
                              >
                                <span>{option}</span>
                                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white">
                        {selectedTones.length > 0
                          ? `Tonalites selectionnees : ${selectedTones.join(", ")}`
                          : "Aucune tonalite selectionnee"}
                      </p>
                      {process.env.NODE_ENV === "development" ? (
                        <p className="mt-2 rounded-md border border-white/10 bg-noline-black px-3 py-2 text-[11px] font-bold text-noline-muted">
                          DEBUG selectedTones: {JSON.stringify(selectedTones)}
                        </p>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <label key={field.name} className="block">
                    <span className="mb-2 block text-sm font-bold text-white">{field.label}</span>
                    {field.type === "textarea" ? (
                    <textarea
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-noline-muted focus:border-noline-orange"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition focus:border-noline-orange"
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={values[field.name] || ""}
                      onChange={(event) => updateValue(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      type={field.type}
                      className="w-full rounded-md border border-white/10 bg-noline-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-noline-muted focus:border-noline-orange"
                    />
                  )}
                  </label>
                );
              })}

              {error ? (
                <div className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Creation en cours..." : "Créer l'agent"}
              </button>
            </form>
          </section>

          <section className="surface premium-border flex min-h-[36rem] flex-col rounded-lg p-5 shadow-premium">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-white">{agentBuilder.outputLabel}</p>
                <p className="mt-1 text-xs text-noline-muted">
                  {demo
                    ? "Mode demo: ajoutez OPENAI_API_KEY pour activer l'IA."
                    : "Sortie structuree pour vendre et produire l'agent."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={output} />
                {output ? (
                  <button
                    type="button"
                    onClick={saveAgent}
                    disabled={savingAgent}
                    className="inline-flex items-center gap-2 rounded-md bg-noline-orange px-4 py-2 text-sm font-black text-noline-black transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
                  >
                    {savingAgent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingAgent ? "Sauvegarde..." : "Sauvegarder l'agent"}
                  </button>
                ) : null}
              </div>
            </div>
            {saveMessage ? (
              <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
                {saveMessage}
              </div>
            ) : null}
            {saveError ? (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {saveError}
              </div>
            ) : null}
            <pre className="min-h-0 flex-1 whitespace-pre-wrap rounded-md border border-white/10 bg-noline-black p-4 text-sm leading-7 text-white">
              {output ||
                "La fiche d'agent apparaitra ici apres generation: nom final, public cible, prompt systeme, argumentaire, prix et evolutions."}
            </pre>
          </section>
        </div>
      </div>
    </Shell>
  );
}
