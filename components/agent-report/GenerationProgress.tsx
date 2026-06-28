"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Analyse de la demande…",
  "Diagnostic en cours…",
  "Génération des livrables…",
  "Finalisation du rapport…"
];

export function GenerationProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-noline-orange/30 bg-noline-orange/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-black text-white">{STEPS[step]}</span>
        <span className="text-xs font-bold text-noline-orange">{step + 1}/{STEPS.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-noline-orange transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
