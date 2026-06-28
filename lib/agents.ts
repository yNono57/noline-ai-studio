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
  description?: string;
  targetAudience?: string;
  systemPrompt?: string;
  source?: string;
};

export type AgentInput = Omit<AgentRecord, "id" | "createdAt" | "userId">;

export type ApiAgentRow = {
  id: string;
  user_id?: string | null;
  name: string;
  client_type?: string | null;
  mission?: string | null;
  features?: string | null;
  tone?: string | null;
  tones?: string[] | null;
  complexity?: string | null;
  business_goal?: string | null;
  output?: string | null;
  description?: string | null;
  target_audience?: string | null;
  system_prompt?: string | null;
  source?: string | null;
  created_at: string;
};

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

export function normalizeAgentRow(item: ApiAgentRow): AgentRecord {
  return {
    id: item.id,
    userId: item.user_id,
    name: item.name,
    clientType: item.client_type || item.target_audience || "Agent personnalisé",
    mission: item.mission || item.description || "",
    features: item.features || "",
    tone: item.tone || item.tones?.join(", ") || "",
    complexity: item.complexity || "intermediate",
    businessGoal: item.business_goal || "",
    output: item.output || item.system_prompt || "",
    createdAt: item.created_at,
    description: item.description || undefined,
    targetAudience: item.target_audience || item.client_type || undefined,
    systemPrompt: item.system_prompt || item.output || undefined,
    source: item.source || undefined
  };
}
