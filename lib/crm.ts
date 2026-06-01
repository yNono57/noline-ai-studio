export type ProspectStatus = "Nouveau" | "Contacte" | "Rendez-vous" | "Proposition" | "Gagne" | "Perdu";

export type Prospect = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  need: string;
  status: ProspectStatus;
  value: string;
  nextAction: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const prospectStatuses: ProspectStatus[] = [
  "Nouveau",
  "Contacte",
  "Rendez-vous",
  "Proposition",
  "Gagne",
  "Perdu"
];

const STORAGE_KEY = "noline-crm-prospects";

export function readProspects(): Prospect[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prospect[]) : [];
  } catch {
    return [];
  }
}

export function saveProspects(prospects: Prospect[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
}

export function upsertProspect(prospect: Prospect) {
  const current = readProspects();
  const exists = current.some((item) => item.id === prospect.id);
  const next = exists
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
