"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { cancelForgeAgentRun, getForgeRuntimeGitDiff, getLatestForgeAgentRun, startForgeAgentRun, type ForgeAgentRunPayload } from "@/lib/forge/forge-client";
import type { ForgeConversation, ForgeMessage } from "@/lib/forge/forge-store";

const ACTIVE = new Set(["QUEUED", "PLANNING", "RUNNING", "VALIDATING"]);
type LaunchRequest = { id: string; objective: string };
export function ForgeAgentRunnerPanel({ conversationId, launchRequest, onLaunchRequestHandled, onActiveChange, onConversationUpdated, onPayloadChange, onMessagesPersisted, onLaunchSettled }: { conversationId: string; launchRequest?: LaunchRequest | null; onLaunchRequestHandled?: (id: string) => void; onActiveChange?: (active: boolean) => void; onConversationUpdated?: (conversation: ForgeConversation) => void; onPayloadChange?: (payload: ForgeAgentRunPayload | null) => void; onMessagesPersisted?: (messages: ForgeMessage[]) => void; onLaunchSettled?: (submissionId: string) => void }) {
  const [objective, setObjective] = useState(""); const [payload, setPayload] = useState<ForgeAgentRunPayload | null>(null); const [launching, setLaunching] = useState(false); const [error, setError] = useState(""); const [diff, setDiff] = useState("");
  const handledRequest = useRef<string | null>(null);
  const launchInFlight = useRef(false);
  const stepsViewport = useRef<HTMLDivElement | null>(null);
  const followSteps = useRef(true);
  const active = launching || Boolean(payload && ACTIVE.has(payload.run.status));
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => { let mounted = true; const refresh = () => getLatestForgeAgentRun(conversationId).then(({ agentRun }) => { if (mounted) { setPayload(agentRun); onPayloadChange?.(agentRun); } }).catch(() => undefined); void refresh(); if (!active) return () => { mounted = false; }; const timer = window.setInterval(refresh, 1500); return () => { mounted = false; window.clearInterval(timer); }; }, [active, conversationId, onPayloadChange]);
  useEffect(() => { if (!followSteps.current || !stepsViewport.current) return; const frame = window.requestAnimationFrame(() => stepsViewport.current?.scrollTo({ top: stepsViewport.current.scrollHeight, behavior: "smooth" })); return () => window.cancelAnimationFrame(frame); }, [payload?.steps.length]);
  useEffect(() => { let mounted = true; if (payload?.run.status !== "COMPLETED") return () => { mounted = false; }; getForgeRuntimeGitDiff(conversationId).then(({ diff: result }) => { if (mounted) setDiff(result.patch || "Aucun changement."); }).catch(() => { if (mounted) setDiff("Diff indisponible."); }); return () => { mounted = false; }; }, [conversationId, payload?.run.runId, payload?.run.status]);
  const launchObjective = useCallback(async (value: string, submissionId = crypto.randomUUID()) => { if (!value.trim() || active || launchInFlight.current) return; launchInFlight.current = true; const launchStartedAt = Date.now(); setObjective(value); setLaunching(true); setError(""); setDiff(""); try { const result = await startForgeAgentRun(conversationId, value.trim(), submissionId); setPayload(result.agentRun); onPayloadChange?.(result.agentRun); onConversationUpdated?.(result.conversation); onMessagesPersisted?.([result.user_message, ...(result.assistant_message ? [result.assistant_message] : [])]); } catch (caught) {
    let recovered = false;
    try {
      const latest = (await getLatestForgeAgentRun(conversationId)).agentRun;
      const isCurrentLaunch = latest?.run.objective === value.trim() && Date.parse(latest.run.createdAt) >= launchStartedAt - 5_000;
      if (latest && isCurrentLaunch) { setPayload(latest); onPayloadChange?.(latest); setError(""); recovered = true; }
    } catch { /* Preserve the original launch error when polling cannot confirm a server-side run. */ }
    if (!recovered) setError(caught instanceof Error ? caught.message : "Run Forge indisponible.");
  } finally { launchInFlight.current = false; setLaunching(false); onLaunchSettled?.(submissionId); } }, [active, conversationId, onConversationUpdated, onLaunchSettled, onMessagesPersisted, onPayloadChange]);
  useEffect(() => { if (!launchRequest || handledRequest.current === launchRequest.id || active) return; handledRequest.current = launchRequest.id; onLaunchRequestHandled?.(launchRequest.id); void launchObjective(launchRequest.objective, launchRequest.id); }, [active, launchObjective, launchRequest, onLaunchRequestHandled]);
  async function launch() { await launchObjective(objective); }
  async function cancel() { if (!payload || !ACTIVE.has(payload.run.status)) return; try { await cancelForgeAgentRun(conversationId, payload.run.runId); setPayload((await getLatestForgeAgentRun(conversationId)).agentRun); } catch (caught) { setError(caught instanceof Error ? caught.message : "Annulation impossible."); } }
  return <details className="mt-3 rounded-md border border-noline-orange/30 bg-noline-orange/5 p-2">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-black text-white">Agent Forge<span className="ml-auto text-[10px] text-noline-muted">{payload?.run.status || "PRÊT"}</span></summary>
    <div className="mt-2 space-y-2">
      <textarea value={objective} onChange={(event) => setObjective(event.target.value)} disabled={active} rows={3} maxLength={4000} className="field w-full resize-y font-mono text-xs" placeholder="Décrivez une mission bornée pour ce sandbox…" aria-label="Mission de l’agent Forge" />
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={launch} disabled={active || !objective.trim()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-noline-orange px-3 py-2 font-black text-noline-black disabled:opacity-40">{active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Lancer Forge</button>{payload && ACTIVE.has(payload.run.status) ? <button type="button" onClick={cancel} className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 font-black text-white"><Square className="h-4 w-4" />Annuler</button> : null}</div>
      {error ? <p role="alert" className="text-red-300">{error}</p> : null}
      {payload?.run.plan.length ? <div><p className="font-black text-white">Plan</p><ol className="mt-1 list-decimal space-y-1 pl-4">{payload.run.plan.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></div> : null}
      {payload?.steps.length ? <div><p className="font-black text-white">Étapes</p><div ref={stepsViewport} onScroll={(event) => { const node = event.currentTarget; followSteps.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; }} className="mt-1 max-h-64 space-y-1 overflow-y-auto">{payload.steps.map((step) => <div key={step.stepId} className="rounded border border-white/10 p-2"><p className="font-bold text-white">{step.status === "FAILED" ? "FAIL" : step.status === "COMPLETED" ? "PASS" : "EN COURS"} · {step.summary}</p>{step.tool ? <p className="font-mono text-[10px]">{step.tool}{step.input.command ? ` · ${String(step.input.command)}` : ""}</p> : null}{step.resultSummary ? <p className="mt-1 break-words">{step.resultSummary}</p> : null}</div>)}</div></div> : null}
      {payload?.run.finalReport ? <div><p className="font-black text-white">Rapport final</p><p className="mt-1 whitespace-pre-wrap break-words">{payload.run.finalReport}</p></div> : null}
      {diff ? <details className="rounded border border-white/10 p-2"><summary className="cursor-pointer font-black text-white">Git diff final</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[10px]">{diff}</pre></details> : null}
    </div>
  </details>;
}
