"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import { generators, type GeneratorConfig, type GeneratorId } from "@/lib/generators";
import { saveRecord } from "@/lib/history";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";
import { readActiveClient, readActiveClientId, readClients, setActiveClientId, type AgencyClient } from "@/lib/agency";
import { CopyButton } from "./CopyButton";
import { VisualCreator } from "./VisualCreator";

type GeneratorFormProps = {
  initialTool?: string;
};

export function GeneratorForm({ initialTool }: GeneratorFormProps) {
  const initialGenerator = useMemo(
    () => generators.find((item) => item.id === initialTool) ?? generators[0],
    [initialTool]
  );
  const [selectedId, setSelectedId] = useState<GeneratorId>(initialGenerator.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [activeClientId, setActiveClientIdState] = useState("");
  const selected = generators.find((item) => item.id === selectedId) as GeneratorConfig;
  const activeClient = clients.find((client) => client.id === activeClientId) || null;

  useEffect(() => {
    const defaults = Object.fromEntries(selected.fields.map((field) => [field.name, ""]));
    const multiDefaults = Object.fromEntries(
      selected.fields
        .filter((field) => field.type === "multiselect")
        .map((field) => [field.name, []])
    );
    setValues(defaults);
    setMultiValues(multiDefaults);
    setOutput("");
    setError("");
    setDemo(false);
  }, [selected]);

  useEffect(() => {
    const storedClients = readClients();
    const storedActive = readActiveClientId();
    setClients(storedClients);
    setActiveClientIdState(storedActive || storedClients[0]?.id || "");
  }, []);

  function chooseClient(id: string) {
    setActiveClientIdState(id);
    setActiveClientId(id);
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function toggleMultiValue(name: string, option: string) {
    setMultiValues((current) => {
      const selected = current[name] || [];
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];

      return { ...current, [name]: next };
    });
  }

  function buildSubmitValues() {
    return {
      ...values,
      ...Object.fromEntries(
        Object.entries(multiValues).map(([name, selected]) => [name, selected.join(", ")])
      )
    };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOutput("");
    const submitValues = buildSubmitValues();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ generatorId: selected.id, values: submitValues })
      });
      const data = (await response.json()) as { output?: string; error?: string; demo?: boolean };

      if (!response.ok || !data.output) {
        throw new Error(data.error || "Generation impossible.");
      }

      setOutput(data.output);
      setDemo(Boolean(data.demo));
      if (!isSupabaseBrowserConfigured()) {
        saveRecord({
          id: crypto.randomUUID(),
          generatorId: selected.id,
          title: selected.title,
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface premium-border rounded-lg p-5 shadow-premium">
          <div className="mb-5">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
              Studio IA
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Generer du contenu
            </h1>
            <p className="mt-3 text-sm leading-6 text-noline-muted">
              Selectionnez un format, renseignez les informations, puis obtenez un texte et un
              template visuel pret a publier.
            </p>
          </div>

          <div className="mb-6 rounded-lg border border-white/10 bg-noline-black p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white">Client agence</span>
              <select
                value={activeClientId}
                onChange={(event) => chooseClient(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
              >
                <option value="">Aucun client selectionne</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.sector}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-noline-muted">
              Le logo, les couleurs et le secteur du client seront appliques aux templates visuels.
            </p>
          </div>

          <div className="mb-6 grid gap-2 sm:grid-cols-2">
            {generators.map((generator) => {
              const Icon = generator.icon;
              const active = generator.id === selectedId;

              return (
                <button
                  key={generator.id}
                  type="button"
                  onClick={() => setSelectedId(generator.id)}
                  className={`flex min-h-20 items-center gap-3 rounded-md border p-3 text-left transition ${
                    active
                      ? "border-noline-orange bg-noline-orange text-noline-black"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-black">{generator.title}</span>
                    <span className={`text-xs ${active ? "text-noline-black/70" : "text-noline-muted"}`}>
                      {generator.visual ? `${generator.plan} + visuel` : generator.plan}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {selected.fields.map((field) => {
              if (field.type === "multiselect") {
                const selectedValues = multiValues[field.name] || [];

                return (
                  <div key={field.name} className="block">
                    <span className="mb-2 block text-sm font-bold text-white">{field.label}</span>
                    <p className="mb-3 text-xs font-bold text-noline-muted">
                      Selectionnez une ou plusieurs tonalites.
                    </p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                      {field.options?.map((option) => {
                        const selected = selectedValues.includes(option);

                        return (
                          <label key={option} className="block">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleMultiValue(field.name, option)}
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
                      {selectedValues.length > 0
                        ? `Tonalites selectionnees : ${selectedValues.join(", ")}`
                        : "Aucune tonalite selectionnee"}
                    </p>
                    {process.env.NODE_ENV === "development" ? (
                      <p className="mt-2 rounded-md border border-white/10 bg-noline-black px-3 py-2 text-[11px] font-bold text-noline-muted">
                        DEBUG {field.name}: {JSON.stringify(selectedValues)}
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Generation..." : "Generer le contenu"}
            </button>
          </form>
        </section>

        <section className="surface premium-border flex min-h-[36rem] flex-col rounded-lg p-5 shadow-premium">
          <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">{selected.outputLabel}</p>
              <p className="mt-1 text-xs text-noline-muted">
                {demo ? "Mode demo: ajoutez OPENAI_API_KEY pour activer l'IA." : "Sortie optimisee par l'IA."}
              </p>
            </div>
            <CopyButton text={output} />
          </div>
          <pre className="min-h-0 flex-1 whitespace-pre-wrap rounded-md border border-white/10 bg-noline-black p-4 text-sm leading-7 text-white">
            {output || "Votre contenu apparaitra ici apres generation."}
          </pre>
        </section>
      </div>

      {selected.visual ? (
        <VisualCreator generator={selected} values={values} output={output} client={activeClient || readActiveClient()} />
      ) : null}
    </div>
  );
}
