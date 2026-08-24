export const FORGE_RUNTIME_LIMITS = { maxFileCharacters: 250_000, maxListEntries: 1_000, maxCommandTimeoutMs: 60_000, maxCommandOutputBytes: 1_000_000, maxDiffCharacters: 200_000 } as const;

export type ForgeRuntimeStatus = "UNPROVISIONED" | "CREATING" | "READY" | "ERROR" | "EXPIRED" | "DESTROYING" | "DESTROYED";

export type ForgeRuntime = {
  runtimeId: string;
  workspaceId: string;
  userId: string;
  provider: string;
  providerRuntimeId: string | null;
  status: ForgeRuntimeStatus;
  baseCommitSha: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  lastActivityAt: string | null;
  errorCode: string | null;
};

export type ForgeRuntimeView = Omit<ForgeRuntime, "userId" | "providerRuntimeId">;
export type ForgeRuntimeSourceCredential = { username: string; password: string };
export type ForgeRuntimeSource = { repository: string; branch: string; baseCommitSha: string; credential?: ForgeRuntimeSourceCredential };
export type ForgeRuntimeFile = { path: string; size: number; content: string };
export type ForgeRuntimeFileEntry = { path: string; type: "file" | "directory"; size: number | null };
export type ForgeRuntimeCommand = { command: string; args: string[]; cwd: string; timeoutMs: number; maxOutputBytes: number };
export type ForgeRuntimeCommandResult = { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; truncated: boolean; durationMs: number };
export type ForgeRuntimeGitStatus = { added: string[]; modified: string[]; deleted: string[] };
export type ForgeRuntimeGitDiff = ForgeRuntimeGitStatus & { patch: string; truncated: boolean };

export type ForgeRuntimeProvisionResult = { providerRuntimeId: string; status: "CREATING" | "READY"; readyAt: string | null; expiresAt: string | null };

export interface ForgeRuntimeProvider {
  readonly name: string;
  readonly provisioningAvailable: boolean;
  createRuntime(runtime: ForgeRuntime, source: ForgeRuntimeSource): Promise<ForgeRuntimeProvisionResult>;
  getRuntime(runtime: ForgeRuntime): Promise<ForgeRuntimeProvisionResult | null>;
  destroyRuntime(runtime: ForgeRuntime): Promise<void>;
  readFile(runtime: ForgeRuntime, path: string): Promise<ForgeRuntimeFile>;
  writeFile(runtime: ForgeRuntime, path: string, content: string): Promise<ForgeRuntimeFile>;
  listFiles(runtime: ForgeRuntime, path: string): Promise<ForgeRuntimeFileEntry[]>;
  executeCommand(runtime: ForgeRuntime, command: ForgeRuntimeCommand): Promise<ForgeRuntimeCommandResult>;
  getGitStatus(runtime: ForgeRuntime): Promise<ForgeRuntimeGitStatus>;
  getGitDiff(runtime: ForgeRuntime, maxPatchCharacters: number): Promise<ForgeRuntimeGitDiff>;
}

export type ForgeRuntimeErrorCode = "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "AUTHORIZATION" | "CONFLICT" | "UNAVAILABLE" | "PERSISTENCE";
export class ForgeRuntimeError extends Error {
  readonly code: ForgeRuntimeErrorCode;
  constructor(code: ForgeRuntimeErrorCode, message: string) { super(message); this.name = "ForgeRuntimeError"; this.code = code; }
}

const transitions: Record<ForgeRuntimeStatus, readonly ForgeRuntimeStatus[]> = {
  UNPROVISIONED: ["CREATING", "DESTROYING", "DESTROYED"],
  CREATING: ["READY", "ERROR", "UNPROVISIONED", "DESTROYING"],
  READY: ["ERROR", "EXPIRED", "DESTROYING"],
  ERROR: ["CREATING", "DESTROYING", "DESTROYED"],
  EXPIRED: ["DESTROYING", "DESTROYED"],
  DESTROYING: ["DESTROYED", "ERROR"],
  DESTROYED: [],
};

export function assertRuntimeTransition(from: ForgeRuntimeStatus, to: ForgeRuntimeStatus) {
  if (from === to) return;
  if (!transitions[from].includes(to)) throw new ForgeRuntimeError("CONFLICT", `Transition runtime interdite : ${from} → ${to}.`);
}

export function normalizeRuntimePath(input: string, allowRoot = false) {
  if (typeof input !== "string" || input.includes("\0") || input.includes("\\")) throw new ForgeRuntimeError("INVALID_INPUT", "Chemin runtime invalide.");
  if (input.length > 4096 || input.startsWith("/") || /^[A-Za-z]:\//.test(input)) throw new ForgeRuntimeError("INVALID_INPUT", "Les chemins absolus sont interdits.");
  const parts = input.split("/");
  if (parts.some((part) => part === "..")) throw new ForgeRuntimeError("INVALID_INPUT", "La traversée de répertoires est interdite.");
  const normalized = parts.filter((part) => part && part !== ".").join("/");
  if (!normalized && !allowRoot) throw new ForgeRuntimeError("INVALID_INPUT", "Un chemin relatif est requis.");
  return normalized || ".";
}

export function normalizeRuntimeCommand(input: Partial<ForgeRuntimeCommand>): ForgeRuntimeCommand {
  if (typeof input.command !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(input.command)) throw new ForgeRuntimeError("INVALID_INPUT", "Commande runtime invalide.");
  if (!Array.isArray(input.args) || input.args.length > 100 || input.args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))) throw new ForgeRuntimeError("INVALID_INPUT", "Arguments runtime invalides.");
  const timeoutMs = input.timeoutMs ?? 30_000;
  const maxOutputBytes = input.maxOutputBytes ?? 250_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > FORGE_RUNTIME_LIMITS.maxCommandTimeoutMs) throw new ForgeRuntimeError("INVALID_INPUT", "Timeout runtime invalide.");
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1_000 || maxOutputBytes > FORGE_RUNTIME_LIMITS.maxCommandOutputBytes) throw new ForgeRuntimeError("INVALID_INPUT", "Limite de sortie runtime invalide.");
  return { command: input.command, args: input.args, cwd: normalizeRuntimePath(input.cwd || ".", true), timeoutMs, maxOutputBytes };
}

export function normalizeRuntimeDiffLimit(value: number = FORGE_RUNTIME_LIMITS.maxDiffCharacters) {
  if (!Number.isInteger(value) || value < 1 || value > FORGE_RUNTIME_LIMITS.maxDiffCharacters) throw new ForgeRuntimeError("INVALID_INPUT", "Limite de diff runtime invalide.");
  return value;
}

export function assertRuntimeReady(runtime: ForgeRuntime, now = Date.now()) {
  if (runtime.status === "EXPIRED" || (runtime.expiresAt && Date.parse(runtime.expiresAt) <= now)) throw new ForgeRuntimeError("CONFLICT", "Le runtime a expiré.");
  if (runtime.status === "DESTROYED" || runtime.status === "DESTROYING") throw new ForgeRuntimeError("CONFLICT", "Le runtime est détruit ou en cours de destruction.");
  if (runtime.status !== "READY" || !runtime.providerRuntimeId) throw new ForgeRuntimeError("UNAVAILABLE", "Aucun environnement runtime réel n’est disponible.");
}

export function publicRuntime(runtime: ForgeRuntime): ForgeRuntimeView {
  return { runtimeId: runtime.runtimeId, workspaceId: runtime.workspaceId, provider: runtime.provider, status: runtime.status, baseCommitSha: runtime.baseCommitSha, createdAt: runtime.createdAt, updatedAt: runtime.updatedAt, readyAt: runtime.readyAt, expiresAt: runtime.expiresAt, lastActivityAt: runtime.lastActivityAt, errorCode: runtime.errorCode };
}

type OwnedWorkspace = { workspaceId: string; userId: string; status: string; repository: string; branch: string; baseCommitSha: string };
export type RuntimeUpdate = Partial<Pick<ForgeRuntime, "providerRuntimeId" | "status" | "readyAt" | "expiresAt" | "lastActivityAt" | "errorCode">>;
export type ForgeRuntimeServiceDependencies = {
  getOwnedWorkspace(userId: string, conversationId: string): Promise<OwnedWorkspace | null>;
  findByWorkspace(userId: string, workspaceId: string, provider: string): Promise<ForgeRuntime | null>;
  insert(input: Omit<ForgeRuntime, "runtimeId" | "createdAt" | "updatedAt">): Promise<{ runtime: ForgeRuntime; created: boolean }>;
  update(userId: string, runtimeId: string, input: RuntimeUpdate): Promise<ForgeRuntime>;
  getSourceCredential?(userId: string, repository: string): Promise<ForgeRuntimeSourceCredential>;
  provider: ForgeRuntimeProvider;
  now(): string;
};

export function createForgeRuntimeService(deps: ForgeRuntimeServiceDependencies) {
  async function source(userId: string, conversationId: string) {
    if (!userId.trim()) throw new ForgeRuntimeError("UNAUTHENTICATED", "Authentification requise.");
    if (!conversationId.trim()) throw new ForgeRuntimeError("INVALID_INPUT", "conversationId est requis.");
    const workspace = await deps.getOwnedWorkspace(userId, conversationId);
    if (!workspace || workspace.userId !== userId) throw new ForgeRuntimeError("NOT_FOUND", "Workspace Forge introuvable ou inaccessible.");
    if (workspace.status !== "READY") throw new ForgeRuntimeError("CONFLICT", "Le workspace doit être prêt avant de créer un runtime.");
    if (!/^[0-9a-f]{40,64}$/.test(workspace.baseCommitSha)) throw new ForgeRuntimeError("CONFLICT", "Le workspace ne possède pas de source Git immuable valide.");
    return workspace;
  }

  function ensureRelation(runtime: ForgeRuntime, workspace: OwnedWorkspace) {
    if (runtime.workspaceId !== workspace.workspaceId || runtime.userId !== workspace.userId || runtime.baseCommitSha !== workspace.baseCommitSha) throw new ForgeRuntimeError("CONFLICT", "La source immuable du runtime ne correspond pas au workspace.");
  }

  async function create(userId: string, conversationId: string) {
    const workspace = await source(userId, conversationId);
    const existing = await deps.findByWorkspace(userId, workspace.workspaceId, deps.provider.name);
    if (existing) {
      ensureRelation(existing, workspace);
      if (["DESTROYING", "DESTROYED", "EXPIRED"].includes(existing.status)) throw new ForgeRuntimeError("CONFLICT", "Ce runtime ne peut pas être recréé dans son état actuel.");
      return existing;
    }
    const inserted = await deps.insert({ workspaceId: workspace.workspaceId, userId, provider: deps.provider.name, providerRuntimeId: null, status: deps.provider.provisioningAvailable ? "CREATING" : "UNPROVISIONED", baseCommitSha: workspace.baseCommitSha, readyAt: null, expiresAt: null, lastActivityAt: null, errorCode: null });
    let runtime = inserted.runtime;
    if (!inserted.created) return runtime;
    if (!deps.provider.provisioningAvailable) return runtime;
    const runtimeSource: ForgeRuntimeSource = { repository: workspace.repository, branch: workspace.branch, baseCommitSha: workspace.baseCommitSha };
    try {
      if (deps.getSourceCredential) runtimeSource.credential = await deps.getSourceCredential(userId, workspace.repository);
      const provisioned = await deps.provider.createRuntime(runtime, runtimeSource);
      assertRuntimeTransition(runtime.status, provisioned.status);
      runtime = await deps.update(userId, runtime.runtimeId, { providerRuntimeId: provisioned.providerRuntimeId, status: provisioned.status, readyAt: provisioned.readyAt, expiresAt: provisioned.expiresAt, lastActivityAt: deps.now(), errorCode: null });
      return runtime;
    } catch (error) {
      await deps.update(userId, runtime.runtimeId, { status: "ERROR", errorCode: "PROVISION_FAILED" });
      throw error;
    } finally {
      delete runtimeSource.credential;
    }
  }

  async function get(userId: string, conversationId: string) {
    const workspace = await source(userId, conversationId);
    let runtime = await deps.findByWorkspace(userId, workspace.workspaceId, deps.provider.name);
    if (!runtime) return null;
    ensureRelation(runtime, workspace);
    if (runtime.status === "READY" && runtime.expiresAt && Date.parse(runtime.expiresAt) <= Date.parse(deps.now())) runtime = await deps.update(userId, runtime.runtimeId, { status: "EXPIRED" });
    if (!runtime.providerRuntimeId || !["CREATING", "READY"].includes(runtime.status)) return runtime;
    const providerRuntime = await deps.provider.getRuntime(runtime);
    if (!providerRuntime) return deps.update(userId, runtime.runtimeId, { status: "ERROR", errorCode: "PROVIDER_RUNTIME_MISSING" });
    assertRuntimeTransition(runtime.status, providerRuntime.status);
    return deps.update(userId, runtime.runtimeId, { status: providerRuntime.status, readyAt: providerRuntime.readyAt, expiresAt: providerRuntime.expiresAt, lastActivityAt: deps.now(), errorCode: null });
  }

  async function destroy(userId: string, conversationId: string) {
    const workspace = await source(userId, conversationId);
    let runtime = await deps.findByWorkspace(userId, workspace.workspaceId, deps.provider.name);
    if (!runtime) return null;
    ensureRelation(runtime, workspace);
    if (runtime.status === "DESTROYED" || runtime.status === "DESTROYING") return runtime;
    assertRuntimeTransition(runtime.status, runtime.providerRuntimeId ? "DESTROYING" : "DESTROYED");
    if (!runtime.providerRuntimeId) return deps.update(userId, runtime.runtimeId, { status: "DESTROYED", lastActivityAt: deps.now() });
    runtime = await deps.update(userId, runtime.runtimeId, { status: "DESTROYING", lastActivityAt: deps.now() });
    try { await deps.provider.destroyRuntime(runtime); return deps.update(userId, runtime.runtimeId, { status: "DESTROYED", lastActivityAt: deps.now() }); }
    catch (error) { await deps.update(userId, runtime.runtimeId, { status: "ERROR", errorCode: "DESTROY_FAILED" }); throw error; }
  }

  async function ready(userId: string, conversationId: string) {
    const workspace = await source(userId, conversationId);
    let runtime = await deps.findByWorkspace(userId, workspace.workspaceId, deps.provider.name);
    if (!runtime) throw new ForgeRuntimeError("NOT_FOUND", "Runtime Forge introuvable ou inaccessible.");
    ensureRelation(runtime, workspace);
    if (runtime.status === "READY" && runtime.expiresAt && Date.parse(runtime.expiresAt) <= Date.parse(deps.now())) runtime = await deps.update(userId, runtime.runtimeId, { status: "EXPIRED" });
    assertRuntimeReady(runtime, Date.parse(deps.now()));
    return runtime;
  }

  async function touch(userId: string, runtime: ForgeRuntime) { await deps.update(userId, runtime.runtimeId, { lastActivityAt: deps.now() }); }

  async function readFile(userId: string, conversationId: string, path: string) {
    const runtime = await ready(userId, conversationId); const result = await deps.provider.readFile(runtime, normalizeRuntimePath(path)); await touch(userId, runtime); return result;
  }
  async function writeFile(userId: string, conversationId: string, path: string, content: string) {
    if (typeof content !== "string" || content.length > FORGE_RUNTIME_LIMITS.maxFileCharacters) throw new ForgeRuntimeError("INVALID_INPUT", "Contenu runtime trop volumineux.");
    const runtime = await ready(userId, conversationId); const result = await deps.provider.writeFile(runtime, normalizeRuntimePath(path), content); await touch(userId, runtime); return result;
  }
  async function listFiles(userId: string, conversationId: string, path = ".") {
    const runtime = await ready(userId, conversationId); const result = await deps.provider.listFiles(runtime, normalizeRuntimePath(path, true)); await touch(userId, runtime); return result.slice(0, FORGE_RUNTIME_LIMITS.maxListEntries);
  }
  async function executeCommand(userId: string, conversationId: string, input: Partial<ForgeRuntimeCommand>) {
    const runtime = await ready(userId, conversationId); const result = await deps.provider.executeCommand(runtime, normalizeRuntimeCommand(input)); await touch(userId, runtime); return result;
  }
  async function getGitStatus(userId: string, conversationId: string) {
    const runtime = await ready(userId, conversationId); const result = await deps.provider.getGitStatus(runtime); await touch(userId, runtime); return result;
  }
  async function getGitDiff(userId: string, conversationId: string, maxPatchCharacters?: number) {
    const runtime = await ready(userId, conversationId); const result = await deps.provider.getGitDiff(runtime, normalizeRuntimeDiffLimit(maxPatchCharacters)); await touch(userId, runtime); return result;
  }

  return { create, get, destroy, readFile, writeFile, listFiles, executeCommand, getGitStatus, getGitDiff };
}
