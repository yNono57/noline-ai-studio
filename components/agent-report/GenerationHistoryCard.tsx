"use client";

import { Check, Clipboard, Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import type { GenerationRecord } from "@/lib/history";
import { AgentReport } from "./AgentReport";
import { exportMarkdown } from "./report-export";

export function GenerationHistoryCard({
  record,
  onDelete
}: {
  record: GenerationRecord;
  onDelete?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(record.output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function remove() {
    if (
      !onDelete ||
      !window.confirm("Supprimer définitivement cette génération ?")
    ) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
    } catch {
      // The parent view owns and displays the deletion error.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="surface premium-border overflow-hidden rounded-xl">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-black text-white">{record.title}</h2>
          <p className="mt-1 text-xs text-noline-muted">{formatDate(record.createdAt)}</p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-noline-muted">{record.output}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <HistoryAction label={open ? "Fermer" : "Voir"} icon={open ? EyeOff : Eye} onClick={() => setOpen((value) => !value)} />
          <HistoryAction label={copied ? "Copié" : "Copier"} icon={copied ? Check : Clipboard} onClick={() => void copy()} />
          <HistoryAction label="Exporter" icon={Download} onClick={() => exportMarkdown(record.output, record.title)} />
          {onDelete ? (
            <HistoryAction
              label={deleting ? "Suppression..." : "Supprimer"}
              icon={Trash2}
              onClick={() => void remove()}
              danger
              disabled={deleting}
            />
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="border-t border-white/10 p-4 sm:p-5">
          <AgentReport content={record.output} title={record.title} hideToolbar />
        </div>
      ) : null}
    </article>
  );
}

function HistoryAction({
  label,
  icon: Icon,
  onClick,
  danger = false,
  disabled = false
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-black transition ${
        danger
          ? "border-red-400/30 text-red-200 hover:bg-red-500/10"
          : "border-white/10 text-white hover:border-noline-orange"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
