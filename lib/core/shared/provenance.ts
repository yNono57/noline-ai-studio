import type { AgentId, RunId, UserId } from "./ids";

export type ProvenanceSource = "user" | "agent" | "tool" | "system" | "import";

export interface Provenance {
  readonly source: ProvenanceSource;
  readonly userId?: UserId;
  readonly agentId?: AgentId;
  readonly runId?: RunId;
  readonly tool?: string;
  readonly externalReference?: string;
}

export function provenance(value: Provenance): Provenance {
  if (value.source === "agent" && !value.agentId) {
    throw new TypeError("Agent provenance requires an agentId.");
  }
  if (value.source === "tool" && !value.tool?.trim()) {
    throw new TypeError("Tool provenance requires a tool name.");
  }
  if (value.runId && !value.agentId) {
    throw new TypeError("Run provenance requires its agentId.");
  }
  return Object.freeze({ ...value });
}
