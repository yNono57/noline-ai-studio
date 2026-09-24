export const FORGE_AGENT_STEP_TYPES = ["PLAN", "TOOL_CALL", "FINAL", "FAIL"] as const;
export type ForgeAgentStepType = (typeof FORGE_AGENT_STEP_TYPES)[number];

export const FORGE_AGENT_TOOL_NAMES = ["list_files", "search_code", "read_file", "write_file", "delete_file", "run_command", "git_status", "git_diff"] as const;
export type ForgeAgentToolName = (typeof FORGE_AGENT_TOOL_NAMES)[number];

export const FORGE_AGENT_STEP_STATUSES = ["RUNNING", "COMPLETED", "FAILED"] as const;
export type ForgeAgentStepStatus = (typeof FORGE_AGENT_STEP_STATUSES)[number];

export const FORGE_AGENT_RUN_STATUSES = ["QUEUED", "PLANNING", "RUNNING", "VALIDATING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export type ForgeAgentRunStatus = (typeof FORGE_AGENT_RUN_STATUSES)[number];
