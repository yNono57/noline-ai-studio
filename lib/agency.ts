export type AgencyClient = {
  id: string;
  name: string;
  sector: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  slogan: string;
  email: string;
  phone: string;
  website: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "noline-agency-clients";
const ACTIVE_KEY = "noline-active-client-id";

export const emptyAgencyClient: Omit<AgencyClient, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  sector: "Club sportif",
  logo: "",
  primaryColor: "#FF6B00",
  secondaryColor: "#FFFFFF",
  slogan: "",
  email: "",
  phone: "",
  website: "",
  facebook: "",
  instagram: "",
  linkedin: "",
  tiktok: "",
  notes: ""
};

export function readClients(): AgencyClient[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Array<Partial<AgencyClient> & { socials?: string }>).map((client) => ({
      ...emptyAgencyClient,
      ...client,
      slogan: client.slogan || "",
      phone: client.phone || "",
      facebook: client.facebook || client.socials || "",
      instagram: client.instagram || "",
      linkedin: client.linkedin || "",
      tiktok: client.tiktok || ""
    })) as AgencyClient[];
  } catch {
    return [];
  }
}

export function saveClients(clients: AgencyClient[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function upsertClient(client: AgencyClient) {
  const current = readClients();
  const exists = current.some((item) => item.id === client.id);
  const next = exists
    ? current.map((item) => (item.id === client.id ? client : item))
    : [client, ...current];
  saveClients(next);
  return next;
}

export function deleteClient(id: string) {
  const next = readClients().filter((client) => client.id !== id);
  saveClients(next);
  if (readActiveClientId() === id) setActiveClientId(next[0]?.id || "");
  return next;
}

export function readActiveClientId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_KEY) || "";
}

export function setActiveClientId(id: string) {
  if (typeof window === "undefined") return;
  if (!id) window.localStorage.removeItem(ACTIVE_KEY);
  else window.localStorage.setItem(ACTIVE_KEY, id);
}

export function readActiveClient() {
  const clients = readClients();
  const id = readActiveClientId();
  return clients.find((client) => client.id === id) || clients[0] || null;
}
