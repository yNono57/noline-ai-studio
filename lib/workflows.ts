export type WorkflowStatus = "draft" | "running" | "completed" | "failed";
export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowStep = {
  id: string;
  title: string;
  status: WorkflowStepStatus;
  output?: string;
};

export type WorkflowRecord = {
  id: string;
  agentId: string;
  clientId?: string;
  title: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  result?: { output?: string } | string | null;
  createdAt: string;
  updatedAt: string;
};

export function normalizeWorkflow(item: Record<string, unknown>): WorkflowRecord {
  return {
    id: text(item.id),
    agentId: text(item.agent_id) || text(item.agentId),
    clientId: text(item.client_id) || text(item.clientId) || undefined,
    title: text(item.title) || "Workflow",
    status: normalizeStatus(item.status),
    steps: Array.isArray(item.steps) ? (item.steps as WorkflowStep[]) : [],
    result: normalizeResult(item.result),
    createdAt: text(item.created_at) || text(item.createdAt),
    updatedAt: text(item.updated_at) || text(item.updatedAt)
  };
}

export function workflowOutput(workflow: WorkflowRecord) {
  if (typeof workflow.result === "string") return workflow.result;
  return workflow.result?.output || "";
}

function normalizeStatus(value: unknown): WorkflowStatus {
  return value === "running" || value === "completed" || value === "failed"
    ? value
    : "draft";
}

function normalizeResult(value: unknown): WorkflowRecord["result"] {
  if (typeof value === "string") return value;
  return value && typeof value === "object"
    ? (value as { output?: string })
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
