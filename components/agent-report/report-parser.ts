export type ReportPriority = "high" | "medium" | "low";

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  priority?: ReportPriority;
  score?: number;
}

export function parseAgentReport(markdown: string): ReportSection[] {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const sections: Array<{ title: string; lines: string[] }> = [];
  let current = { title: "Résultat", lines: [] as string[] };

  for (const line of normalized.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      if (current.lines.some((item) => item.trim())) sections.push(current);
      current = { title: cleanHeading(heading[1]), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.some((item) => item.trim()) || sections.length === 0) {
    sections.push(current);
  }

  return sections.map((section, index) => {
    const content = section.lines.join("\n").trim();
    const searchable = `${section.title}\n${content}`;
    return {
      id: `${slugify(section.title) || "section"}-${index}`,
      title: section.title,
      content,
      priority: detectPriority(searchable),
      score: detectScore(searchable)
    };
  });
}

function cleanHeading(value: string) {
  return value.replace(/\*\*/g, "").replace(/:$/, "").trim() || "Section";
}

function detectPriority(value: string): ReportPriority | undefined {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(priorite|priority)\s*(?:[:—-]\s*)?(haute|elevee|high)|\burgent\b/.test(normalized)) {
    return "high";
  }
  if (/(priorite|priority)\s*(?:[:—-]\s*)?(moyenne|medium)/.test(normalized)) {
    return "medium";
  }
  if (/(priorite|priority)\s*(?:[:—-]\s*)?(faible|basse|low)/.test(normalized)) {
    return "low";
  }
  return undefined;
}

function detectScore(value: string) {
  const match = value.match(/\b(\d{1,3})\s*(?:\/\s*100|%)/);
  if (!match) return undefined;
  return Math.min(100, Math.max(0, Number(match[1])));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
