"use client";

import { CheckCircle2, Clock3, Eye, Trash2, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgentReport } from "./agent-report/AgentReport";
import { getAuthenticatedHeaders } from "@/lib/supabase-client";
import {
  normalizeWorkflow,
  workflowOutput,
  type WorkflowRecord,
  type WorkflowStatus
} from "@/lib/workflows";

export function WorkflowsView() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [status, setStatus] = useState<WorkflowStatus | "all">("all");
  const [agent, setAgent] = useState("all");
  const [client, setClient] = useState("all");
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        let headers = await getAuthenticatedHeaders();
        let response = await fetch("/api/workflows", { headers, cache: "no-store" });
        if (response.status === 401) {
          headers = await getAuthenticatedHeaders(true);
          response = await fetch("/api/workflows", { headers, cache: "no-store" });
        }
        const data = (await response.json()) as { workflows?: Record<string, unknown>[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Chargement impossible.");
        setWorkflows((data.workflows || []).map(normalizeWorkflow));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Chargement impossible.");
      }
    }
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      workflows.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          (agent === "all" || item.agentId === agent) &&
          (client === "all" || item.clientId === client)
      ),
    [agent, client, status, workflows]
  );
  const agents = Array.from(new Set(workflows.map((item) => item.agentId)));
  const clients = Array.from(new Set(workflows.map((item) => item.clientId).filter(Boolean))) as string[];

  async function remove(item: WorkflowRecord) {
    if (!window.confirm(`Supprimer le workflow « ${item.title} » ?`)) return;
    try {
      let headers = await getAuthenticatedHeaders();
      let response = await fetch(`/api/workflows/${encodeURIComponent(item.id)}`, { method: "DELETE", headers });
      if (response.status === 401) {
        headers = await getAuthenticatedHeaders(true);
        response = await fetch(`/api/workflows/${encodeURIComponent(item.id)}`, { method: "DELETE", headers });
      }
      if (!response.ok) throw new Error("Suppression impossible.");
      setWorkflows((current) => current.filter((workflow) => workflow.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible.");
    }
  }

  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">V6</p>
      <h1 className="mt-2 text-4xl font-black text-white">Workflows clients</h1>
      <p className="mt-3 text-sm text-noline-muted">Retrouvez les missions structurées exécutées par vos agents.</p>

      <div className="surface premium-border mt-7 grid gap-3 rounded-xl p-4 md:grid-cols-3">
        <Filter value={status} onChange={(value) => setStatus(value as WorkflowStatus | "all")} options={["all", "draft", "running", "completed", "failed"]} />
        <Filter value={agent} onChange={setAgent} options={["all", ...agents]} />
        <Filter value={client} onChange={setClient} options={["all", ...clients]} />
      </div>
      {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}

      <div className="mt-6 grid gap-4">
        {filtered.length === 0 ? <div className="surface premium-border rounded-xl p-8 text-center text-noline-muted">Aucun workflow.</div> : null}
        {filtered.map((item) => (
          <article key={item.id} className="surface premium-border overflow-hidden rounded-xl">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-noline-orange" />
                  <h2 className="font-black text-white">{item.title}</h2>
                </div>
                <p className="mt-2 text-xs text-noline-muted">{item.agentId} · {formatDate(item.updatedAt)}</p>
                <Status status={item.status} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpenId(openId === item.id ? "" : item.id)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-black text-white">
                  <Eye className="h-4 w-4" /> Voir
                </button>
                <button onClick={() => void remove(item)} className="inline-flex items-center gap-2 rounded-md border border-red-400/30 px-3 py-2 text-xs font-black text-red-200">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </button>
              </div>
            </div>
            {openId === item.id ? <div className="border-t border-white/10 p-5"><AgentReport content={workflowOutput(item) || "Aucun résultat."} title={item.title} /></div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="field">{options.map((option) => <option key={option} value={option}>{option === "all" ? "Tous" : option}</option>)}</select>;
}

function Status({ status }: { status: WorkflowStatus }) {
  return <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-xs font-black text-white">{status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Clock3 className="h-3.5 w-3.5 text-noline-orange" />}{status}</span>;
}

function formatDate(value: string) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}
