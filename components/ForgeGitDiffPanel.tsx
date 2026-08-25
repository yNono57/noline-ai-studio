"use client";

import { useEffect, useState } from "react";
import { GitCompare, Loader2 } from "lucide-react";
import { getForgeRuntimeGitDiff } from "@/lib/forge/forge-client";

export function ForgeGitDiffPanel({ conversationId, active }: { conversationId: string; active: boolean }) {
  const [patch, setPatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!active || !conversationId) return () => { mounted = false; };
    setLoading(true); setError("");
    getForgeRuntimeGitDiff(conversationId)
      .then(({ diff }) => { if (mounted) setPatch(diff.patch || "Aucun changement suivi."); })
      .catch((caught) => { if (mounted) setError(caught instanceof Error ? caught.message : "Diff indisponible."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [active, conversationId]);

  return <details id="forge-workspace-git" open={active} className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-xs font-black text-white"><GitCompare className="h-4 w-4 text-noline-orange" />Git diff{loading ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : null}</summary>
    {error ? <p role="alert" className="mt-2 text-xs text-red-200">{error}</p> : <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-3 font-mono text-[10px] leading-5 text-noline-muted">{patch || "Ouvrez cette section pour charger le diff."}</pre>}
    <p className="mt-2 text-[10px] text-noline-muted">Lecture seule : aucun commit ni push n’est disponible.</p>
  </details>;
}
