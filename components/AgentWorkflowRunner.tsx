"use client";

import { Check, Circle, Loader2, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgencyClient } from "@/lib/agency";
import { getAuthenticatedHeaders } from "@/lib/supabase-client";
import type { WorkflowRecord } from "@/lib/workflows";
import { AgentReport } from "./agent-report/AgentReport";

const stepTitles = [
  "Analyse de la demande",
  "Diagnostic / stratégie",
  "Livrables prêts à utiliser",
  "Plan d’action + prochaine étape"
];

export function AgentWorkflowRunner({
  agentId,
  agentName,
  clients
}: {
  agentId: string;
  agentName: string;
  clients: AgencyClient[];
}) {
  const [input, setInput] = useState("");
  const [clientId, setClientId] = useState("");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () => setActiveStep((current) => Math.min(current + 1, 3)),
      2200
    );
    return () => window.clearInterval(timer);
  }, [running]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;
    setRunning(true);
    setActiveStep(0);
    setOutput("");
    setError("");
    setWorkflow(null);

    try {
      let headers = await getAuthenticatedHeaders();
      const run = () =>
        fetch(`/api/agents/${encodeURIComponent(agentId)}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ input: input.trim(), clientId: clientId || undefined })
        });
      let response = await run();
      if (response.status === 401) {
        headers = await getAuthenticatedHeaders(true);
        response = await run();
      }
      const data = (await response.json()) as {
        workflow?: WorkflowRecord;
        output?: string;
        error?: string;
      };
      if (!response.ok || !data.workflow || !data.output) {
        throw new Error(data.error || "Workflow impossible.");
      }
      setActiveStep(4);
      setWorkflow(data.workflow);
      setOutput(data.output);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workflow impossible.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section id="workflow-agent" className="surface premium-border scroll-mt-28 rounded-xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-noline-orange text-noline-black">
          <Workflow className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-noline-orange">V6</p>
          <h2 className="text-2xl font-black text-white">Lancer un workflow</h2>
          <p className="text-sm text-noline-muted">Quatre étapes métier, sauvegardées automatiquement.</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={5}
          maxLength={10000}
          placeholder={`Décris le résultat attendu de ${agentName}.`}
          className="field resize-y"
        />
        <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="field">
          <option value="">Aucun client lié</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <button
          disabled={running || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-noline-orange px-5 py-3 text-sm font-black text-noline-black hover:bg-white disabled:opacity-50 sm:w-fit"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
          {running ? "Workflow en cours..." : "Lancer le workflow"}
        </button>
      </form>

      {running || workflow ? (
        <ol className="mt-6 grid gap-2 sm:grid-cols-2">
          {stepTitles.map((title, index) => {
            const completed = activeStep > index;
            const active = running && activeStep === index;
            return (
              <li key={title} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 text-sm text-white">
                {completed ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-noline-orange" />
                ) : (
                  <Circle className="h-4 w-4 text-noline-muted" />
                )}
                {title}
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      {output ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <AgentReport content={output} title={`${agentName} — Workflow`} saved />
        </div>
      ) : null}
    </section>
  );
}
