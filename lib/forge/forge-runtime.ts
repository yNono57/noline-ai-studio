import type { AIMessage, GenerationResult } from "@/lib/ai/contracts";
import type { ForgeToolName, ForgeToolRisk } from "./forge-tools";

export interface ForgeContextLimits { readonly maxHistoryMessages: number; readonly maxFiles: number; readonly maxFileCharacters: number; readonly maxToolResultCharacters: number; }
export const FORGE_V1_CONTEXT_LIMITS: ForgeContextLimits = { maxHistoryMessages: 40, maxFiles: 12, maxFileCharacters: 40_000, maxToolResultCharacters: 20_000 };

export interface ForgeModelProvider { readonly key: string; generate(input: { readonly model: string; readonly messages: readonly AIMessage[]; readonly jsonMode?: boolean }): Promise<GenerationResult>; }
export interface ForgeRepositoryConnection { readonly provider: "github"; readonly repositoryIdentifier: string; readonly defaultBranch: string; }
export interface ForgeRepositoryProvider { readonly key: "github"; listAuthorizedRepositories(userId: string): Promise<readonly ForgeRepositoryConnection[]>; }
export interface ForgeApprovalRequest { readonly id: string; readonly tool: ForgeToolName; readonly risk: ForgeToolRisk; readonly summary: string; readonly status: "pending" | "approved" | "rejected"; }
export interface ForgeExecutionRequest { readonly tool: ForgeToolName; readonly arguments: Readonly<Record<string, unknown>>; readonly approvalId?: string; }
export interface ForgeToolResult { readonly tool: ForgeToolName; readonly ok: boolean; readonly output: string; }
export interface ForgeExecutionProvider { readonly key: string; execute(request: ForgeExecutionRequest): Promise<ForgeToolResult>; }

// V1 ne branche volontairement aucun repository, outil ou environnement d’exécution.
export const forgeExecutionProvider: ForgeExecutionProvider | null = null;
export const forgeRepositoryProvider: ForgeRepositoryProvider | null = null;