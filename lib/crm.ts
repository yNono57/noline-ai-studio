export type ProspectStatus =
  | "Nouveau"
  | "Contacté"
  | "Diagnostic"
  | "Proposition"
  | "Négociation"
  | "Gagné"
  | "Perdu";

export type Prospect = {
  id: string;
  contactName: string;
  phone: string;
  email: string;
  company: string;
  website: string;
  facebook: string;
  linkedin: string;
  sector: string;
  estimatedRevenue: number | null;
  estimatedBudget: number | null;
  source: string;
  tags: string[];
  need: string;
  status: ProspectStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmTask = {
  id: string;
  prospectId: string;
  title: string;
  type: "Rappeler" | "Envoyer devis" | "Relancer" | "Préparer rendez-vous";
  dueAt: string;
  completed: boolean;
  createdAt: string;
};

export type TimelineEvent = {
  id: string;
  prospectId: string;
  type: "workflow" | "generation" | "quote" | "note" | "status" | "created" | "updated";
  title: string;
  content: string;
  createdAt: string;
};

export const prospectStatuses: ProspectStatus[] = [
  "Nouveau",
  "Contacté",
  "Diagnostic",
  "Proposition",
  "Négociation",
  "Gagné",
  "Perdu"
];

const STORAGE_KEY = "noline-crm-prospects";

export function normalizeProspect(item: Record<string, unknown>): Prospect {
  return {
    id: text(item.id) || cryptoId(),
    contactName: text(item.contact_name) || text(item.contactName),
    phone: text(item.phone),
    email: text(item.email),
    company: text(item.company),
    website: text(item.website),
    facebook: text(item.facebook),
    linkedin: text(item.linkedin),
    sector: text(item.sector),
    estimatedRevenue: numberOrNull(item.estimated_revenue ?? item.estimatedRevenue),
    estimatedBudget: numberOrNull(item.estimated_budget ?? item.estimatedBudget ?? item.value),
    source: text(item.source),
    tags: array(item.tags),
    need: text(item.need),
    status: normalizeStatus(item.status),
    notes: text(item.notes),
    createdAt: text(item.created_at) || text(item.createdAt) || new Date().toISOString(),
    updatedAt: text(item.updated_at) || text(item.updatedAt) || new Date().toISOString()
  };
}

export function normalizeTask(item: Record<string, unknown>): CrmTask {
  return {
    id: text(item.id),
    prospectId: text(item.prospect_id),
    title: text(item.title),
    type: (text(item.type) || "Relancer") as CrmTask["type"],
    dueAt: text(item.due_at),
    completed: Boolean(item.completed),
    createdAt: text(item.created_at)
  };
}

export function normalizeTimeline(item: Record<string, unknown>): TimelineEvent {
  return {
    id: text(item.id),
    prospectId: text(item.prospect_id),
    type: (text(item.type) || "note") as TimelineEvent["type"],
    title: text(item.title),
    content: text(item.content),
    createdAt: text(item.created_at)
  };
}

export function readProspects(): Prospect[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? (JSON.parse(raw) as Record<string, unknown>[]).map(normalizeProspect)
      : [];
  } catch {
    return [];
  }
}

export function saveProspects(prospects: Prospect[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
}

export function upsertProspect(prospect: Prospect) {
  const current = readProspects();
  const next = current.some((item) => item.id === prospect.id)
    ? current.map((item) => (item.id === prospect.id ? prospect : item))
    : [prospect, ...current];
  saveProspects(next);
  return next;
}

export function deleteProspect(id: string) {
  const next = readProspects().filter((prospect) => prospect.id !== id);
  saveProspects(next);
  return next;
}

function normalizeStatus(value: unknown): ProspectStatus {
  const status = text(value);
  const legacy: Record<string, ProspectStatus> = {
    Contacte: "Contacté",
    "Rendez-vous": "Diagnostic",
    "Diagnostic envoyé": "Diagnostic",
    "Devis envoyé": "Proposition",
    Gagne: "Gagné"
  };
  return prospectStatuses.includes(status as ProspectStatus)
    ? (status as ProspectStatus)
    : legacy[status] || "Nouveau";
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function array(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cryptoId() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `prospect-${Date.now()}`;
}
