"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Facebook,
  FileDown,
  FileText,
  Lightbulb,
  Linkedin,
  Mail,
  RefreshCw,
  Save,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { parseAgentReport, type ReportPriority, type ReportSection } from "./report-parser";
import { exportMarkdown, exportPdf } from "./report-export";

export function AgentReport({
  content,
  title,
  onSave,
  saved = false,
  hideToolbar = false
}: {
  content: string;
  title: string;
  onSave?: () => void;
  saved?: boolean;
  hideToolbar?: boolean;
}) {
  const sections = useMemo(() => parseAgentReport(content), [content]);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function copy(text: string, id?: string) {
    await navigator.clipboard.writeText(text);
    if (id) setCopiedSection(id);
    else setCopiedAll(true);
    window.setTimeout(() => {
      setCopiedSection(null);
      setCopiedAll(false);
    }, 1600);
  }

  return (
    <div className="space-y-4">
      {!hideToolbar ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <ReportAction
            label={copiedAll ? "Tout copié" : "Copier tout"}
            icon={copiedAll ? Check : Clipboard}
            onClick={() => void copy(content)}
          />
          <ReportAction label="Export Markdown" icon={Download} onClick={() => exportMarkdown(content, title)} />
          <ReportAction label="Export PDF" icon={FileDown} onClick={() => exportPdf(content, title)} />
          {onSave || saved ? (
            <ReportAction
              label={saved ? "Sauvegardé" : "Sauvegarder"}
              icon={saved ? Check : Save}
              onClick={onSave || (() => undefined)}
              disabled={saved}
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, index) => (
          <ReportSectionCard
            key={section.id}
            section={section}
            featured={index === 0}
            copied={copiedSection === section.id}
            onCopy={() =>
              void copy(`## ${section.title}\n\n${section.content}`, section.id)
            }
          />
        ))}
      </div>
    </div>
  );
}

function ReportSectionCard({
  section,
  featured,
  copied,
  onCopy
}: {
  section: ReportSection;
  featured: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(featured);
  const Icon = iconForTitle(section.title);

  return (
    <article className={`overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] ${featured ? "md:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-expanded={mobileOpen}
          className="flex min-w-0 flex-1 items-start gap-3 text-left md:pointer-events-none"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-noline-orange/10 text-noline-orange">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-black text-white">{section.title}</span>
            <span className="mt-1 flex flex-wrap gap-2">
              {section.priority ? <PriorityBadge priority={section.priority} /> : null}
              {section.score !== undefined ? (
                <span className="text-xs font-black text-noline-orange">{section.score}/100</span>
              ) : null}
            </span>
          </span>
          <ChevronDown className={`ml-auto mt-2 h-4 w-4 shrink-0 text-noline-muted transition md:hidden ${mobileOpen ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-2 text-xs font-black text-white transition hover:border-noline-orange"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">
            {copied ? "Section copiée" : "Copier cette section"}
          </span>
        </button>
      </div>
      <div className={`${mobileOpen ? "block" : "hidden"} p-4 md:block`}>
        {section.score !== undefined ? <ScoreBar score={section.score} /> : null}
        <FormattedContent content={section.content} />
      </div>
    </article>
  );
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n").filter((line, index, items) => line.trim() || items[index - 1]?.trim());
  return (
    <div className="space-y-2 text-sm leading-7 text-noline-muted">
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-*•]\s+(.+)/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)/);
        if (bullet || numbered) {
          return (
            <div key={`${line}-${index}`} className="flex gap-2">
              <span className="text-noline-orange">•</span>
              <p>{formatInline((bullet || numbered)?.[1] || line)}</p>
            </div>
          );
        }
        return <p key={`${line}-${index}`}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`} className="font-black text-white">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mb-4">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-noline-orange" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ReportPriority }) {
  const styles = {
    high: "bg-red-500/15 text-red-200",
    medium: "bg-amber-500/15 text-amber-200",
    low: "bg-emerald-500/15 text-emerald-200"
  };
  const labels = { high: "Priorité haute", medium: "Priorité moyenne", low: "Priorité faible" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles[priority]}`}>{labels[priority]}</span>;
}

function ReportAction({
  label,
  icon: Icon,
  onClick,
  disabled = false
}: {
  label: string;
  icon: typeof Save;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-noline-black px-3 py-2 text-xs font-black text-white transition hover:border-noline-orange disabled:text-emerald-300"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function iconForTitle(title: string) {
  const value = title.toLowerCase();
  if (value.includes("diagnostic") || value.includes("analyse")) return Search;
  if (value.includes("opportun")) return Lightbulb;
  if (value.includes("offre") || value.includes("recommand")) return BriefcaseBusiness;
  if (value.includes("email") || value.includes("mail")) return Mail;
  if (value.includes("linkedin")) return Linkedin;
  if (value.includes("facebook")) return Facebook;
  if (value.includes("relance")) return RefreshCw;
  if (value.includes("score") || value.includes("performance")) return BarChart3;
  return FileText;
}
