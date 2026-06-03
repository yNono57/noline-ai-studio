export type AgentRecord = {
  id: string;
  userId?: string | null;
  name: string;
  clientType: string;
  mission: string;
  features: string;
  tone: string;
  complexity: string;
  businessGoal: string;
  output: string;
  createdAt: string;
};

export type AgentInput = Omit<AgentRecord, "id" | "createdAt" | "userId">;

const STORAGE_KEY = "noline-agent-library";

export function readAgents(): AgentRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AgentRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveAgentLocal(input: AgentInput) {
  const record: AgentRecord = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString()
  };
  const next = [record, ...readAgents()];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return record;
}

export function deleteAgentLocal(id: string) {
  const next = readAgents().filter((agent) => agent.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
