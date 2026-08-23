export type ForgeToolRisk = "READ" | "WRITE" | "EXECUTE" | "DESTRUCTIVE" | "REMOTE";
export type ForgeToolName =
  | "repository.listFiles" | "repository.readFile" | "repository.search" | "repository.diff"
  | "workspace.writeFile" | "workspace.deleteFile"
  | "git.status" | "git.diff" | "git.branch" | "git.commit" | "git.push"
  | "command.run" | "tests.run" | "github.pullRequest";

export interface ForgeToolDefinition { readonly name: ForgeToolName; readonly risk: ForgeToolRisk; readonly requiresApproval: boolean; }
export const FORGE_TOOL_CATALOG: readonly ForgeToolDefinition[] = [
  { name: "repository.listFiles", risk: "READ", requiresApproval: false },
  { name: "repository.readFile", risk: "READ", requiresApproval: false },
  { name: "repository.search", risk: "READ", requiresApproval: false },
  { name: "repository.diff", risk: "READ", requiresApproval: false },
  { name: "workspace.writeFile", risk: "WRITE", requiresApproval: true },
  { name: "workspace.deleteFile", risk: "DESTRUCTIVE", requiresApproval: true },
  { name: "git.status", risk: "READ", requiresApproval: false },
  { name: "git.diff", risk: "READ", requiresApproval: false },
  { name: "git.branch", risk: "READ", requiresApproval: false },
  { name: "git.commit", risk: "WRITE", requiresApproval: true },
  { name: "git.push", risk: "REMOTE", requiresApproval: true },
  { name: "command.run", risk: "EXECUTE", requiresApproval: true },
  { name: "tests.run", risk: "EXECUTE", requiresApproval: true },
  { name: "github.pullRequest", risk: "REMOTE", requiresApproval: true }
];
export const FORGE_V1_ENABLED_TOOLS: readonly ForgeToolName[] = [];