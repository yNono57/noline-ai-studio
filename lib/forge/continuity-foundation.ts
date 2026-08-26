import type { ForgeRuntimeCommandResult, ForgeRuntimeGitDiff, ForgeRuntimeGitStatus } from "./runtime-foundation";
import { ForgeAgentError, type ForgeAgentRun, type ForgeRunArtifact } from "./agent-foundation";

export type ForgeArtifactRestoreStatus = "AVAILABLE" | "RESTORING" | "RESTORED" | "CONFLICT" | "FAILED";
export type ForgeArtifactPublicationStatus = "LOCAL" | "BRANCHED" | "COMMITTED" | "PUSHED" | "PR_CREATED";
export type ForgeContinuityArtifact = ForgeRunArtifact & {
  restoreStatus: ForgeArtifactRestoreStatus;
  publicationStatus: ForgeArtifactPublicationStatus;
  restoredAt: string | null;
  restoredRuntimeId: string | null;
  branchName: string | null;
  commitSha: string | null;
  pullRequestUrl: string | null;
  conflictFiles: string[];
};
export type ForgeContinuityWorkspace = { workspaceId: string; projectId: string; conversationId: string; repository: string; branch: string; baseCommitSha: string; status: string };
export type ForgeContinuityRuntime = { runtimeId: string; status: string; baseCommitSha: string };
type ArtifactUpdate = Partial<Pick<ForgeContinuityArtifact, "restoreStatus" | "publicationStatus" | "restoredAt" | "restoredRuntimeId" | "branchName" | "commitSha" | "pullRequestUrl" | "conflictFiles">>;
export type ForgeContinuityRuntimeAdapter = {
  writeFile(path: string, content: string): Promise<unknown>;
  deleteFile(path: string): Promise<void>;
  execute(command: { command: string; args: string[]; cwd: string; timeoutMs: number; maxOutputBytes: number }): Promise<ForgeRuntimeCommandResult>;
  getGitStatus(): Promise<ForgeRuntimeGitStatus>;
  getGitDiff(): Promise<ForgeRuntimeGitDiff>;
};
export type ForgeContinuityDependencies = {
  getWorkspace(userId: string, conversationId: string): Promise<ForgeContinuityWorkspace | null>;
  getRuntime(userId: string, conversationId: string): Promise<ForgeContinuityRuntime | null>;
  getArtifact(userId: string, artifactId: string): Promise<ForgeContinuityArtifact | null>;
  getRun(userId: string, runId: string): Promise<ForgeAgentRun | null>;
  updateArtifact(userId: string, artifactId: string, update: ArtifactUpdate): Promise<ForgeContinuityArtifact>;
  runtime(userId: string, conversationId: string): ForgeContinuityRuntimeAdapter;
  getPushCredential?(userId: string, repository: string): Promise<{ username: string; password: string }>;
  createPullRequest?(userId: string, input: { repository: string; head: string; base: string; title: string; body: string }): Promise<{ url: string }>;
  now(): string;
};

const sensitivePath = /(^|\/)(?:\.env(?:\..*)?|\.git|node_modules|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?)(\/|$)/i;
export function assertContinuityPatchSafe(artifact: ForgeContinuityArtifact) {
  if (artifact.status !== "READY") throw new ForgeAgentError("CONFLICT", "Seul un artifact READY peut être restauré.");
  if (!artifact.patch || artifact.patch.includes("\0")) throw new ForgeAgentError("INVALID_INPUT", "Patch artifact invalide.");
  if (artifact.changedFiles.some((path) => !path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..") || sensitivePath.test(path))) throw new ForgeAgentError("INVALID_INPUT", "Patch artifact sensible ou hors repository refusé.");
  for (const line of artifact.patch.split("\n")) {
    if (!/^(?:diff --git|--- |\+\+\+ )/.test(line) || /(?:---|\+\+\+) \/dev\/null$/.test(line)) continue;
    if (/ (?:a|b)?\/\.\.\//.test(line) || / (?:a|b)?\/(?:\.env(?:[./]|$)|\.git(?:\/|$)|node_modules(?:\/|$)|credentials?(?:[./]|$)|secrets?(?:[./]|$))/i.test(line)) throw new ForgeAgentError("INVALID_INPUT", "Patch artifact sensible ou hors repository refusé.");
  }
}
export function normalizeForgeBranchName(value: unknown) {
  if (typeof value !== "string") throw new ForgeAgentError("INVALID_INPUT", "Nom de branche invalide.");
  const branch = value.trim();
  if (!/^forge\/[a-z0-9][a-z0-9._/-]{0,78}$/i.test(branch) || branch.includes("..") || branch.includes("//") || branch.endsWith("/") || branch.endsWith(".lock")) throw new ForgeAgentError("INVALID_INPUT", "La branche doit utiliser un nom Git sûr sous forge/.");
  return branch;
}
export function normalizeForgeCommitMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200 || /[\r\n\0]/.test(value)) throw new ForgeAgentError("INVALID_INPUT", "Message de commit invalide.");
  return value.trim();
}
function requireConfirmation(value: unknown, action: string) { if (value !== true) throw new ForgeAgentError("CONFLICT", `Confirmation explicite requise pour ${action}.`); }
function succeeded(result: ForgeRuntimeCommandResult, label: string) {
  if (result.timedOut || result.exitCode !== 0) throw new ForgeAgentError("CONFLICT", `${label} a échoué (exitCode=${result.exitCode ?? "null"}).`);
  return result.stdout.trim();
}
function git(runtime: ForgeContinuityRuntimeAdapter, args: string[]) { return runtime.execute({ command: "git", args, cwd: ".", timeoutMs: 60_000, maxOutputBytes: 250_000 }); }
function conflictFiles(output: string) { return [...new Set([...output.matchAll(/(?:error:\s+patch failed:\s+|patch does not apply\s+)([^:\r\n]+)/gi)].map((match) => match[1].trim()).filter(Boolean))].slice(0, 50); }
function encodeBasic(username: string, password: string) {
  if (!username || !password || /[\r\n\0]/.test(username + password)) throw new ForgeAgentError("INVALID_INPUT", "Credential GitHub invalide.");
  return Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}

export function createForgeContinuityService(deps: ForgeContinuityDependencies) {
  async function owned(userId: string, conversationId: string, artifactId: string) {
    if (!userId.trim()) throw new ForgeAgentError("UNAUTHENTICATED", "Authentification requise.");
    const [workspace, runtime, artifact] = await Promise.all([deps.getWorkspace(userId, conversationId), deps.getRuntime(userId, conversationId), deps.getArtifact(userId, artifactId)]);
    if (!workspace || !runtime || !artifact) throw new ForgeAgentError("NOT_FOUND", "Artifact ou runtime Forge introuvable.");
    const run = await deps.getRun(userId, artifact.runId);
    if (!run || run.conversationId !== conversationId || run.projectId !== workspace.projectId || artifact.repository !== workspace.repository) throw new ForgeAgentError("NOT_FOUND", "Artifact Forge non autorisé pour ce projet.");
    if (runtime.status !== "READY") throw new ForgeAgentError("CONFLICT", "Un runtime READY est requis.");
    return { workspace, runtime, artifact, run, adapter: deps.runtime(userId, conversationId) };
  }

  async function restore(userId: string, conversationId: string, artifactId: string, allowBaseMismatch = false) {
    const target = await owned(userId, conversationId, artifactId);
    if (target.artifact.status === "EMPTY") {
      return deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORED", restoredAt: deps.now(), restoredRuntimeId: target.runtime.runtimeId, conflictFiles: [] });
    }
    assertContinuityPatchSafe(target.artifact);
    await deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORING", conflictFiles: [] });
    const initialStatus = await target.adapter.getGitStatus();
    const existingChanges = [...initialStatus.added, ...initialStatus.modified, ...initialStatus.deleted];
    if (existingChanges.length > 0) return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: [...new Set(existingChanges)].sort() });
    const temporaryPath = `.noline/restore-${target.artifact.artifactId}.patch`;
    try {
      await target.adapter.writeFile(temporaryPath, target.artifact.patch);
      const head = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "Lecture du HEAD");
      const check = await git(target.adapter, ["apply", "--check", "--whitespace=nowarn", temporaryPath]);
      if (check.timedOut || check.exitCode !== 0) return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: conflictFiles(`${check.stdout}\n${check.stderr}`) });
      if (head !== target.artifact.baseCommitSha && !allowBaseMismatch) return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: [] });
      succeeded(await git(target.adapter, ["apply", "--whitespace=nowarn", temporaryPath]), "Restauration du patch");
      const [status, diff] = await Promise.all([target.adapter.getGitStatus(), target.adapter.getGitDiff()]);
      if (diff.truncated) throw new ForgeAgentError("LIMIT", "Le diff restauré dépasse la limite de vérification.");
      const expected = [...target.artifact.changedFiles].sort();
      const actual = [...new Set([...status.added, ...status.modified, ...status.deleted])].sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new ForgeAgentError("CONFLICT", "Le working tree restauré ne correspond pas à l’artifact.");
      return deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORED", restoredAt: deps.now(), restoredRuntimeId: target.runtime.runtimeId, conflictFiles: [] });
    } catch (error) {
      if (error instanceof ForgeAgentError) await deps.updateArtifact(userId, artifactId, { restoreStatus: error.code === "CONFLICT" ? "CONFLICT" : "FAILED" });
      throw error;
    } finally { await target.adapter.deleteFile(temporaryPath).catch(() => undefined); }
  }

  async function createBranch(userId: string, conversationId: string, artifactId: string, branchInput: unknown) {
    const branch = normalizeForgeBranchName(branchInput), target = await owned(userId, conversationId, artifactId);
    const head = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "Lecture du HEAD");
    if (head !== target.artifact.baseCommitSha) throw new ForgeAgentError("CONFLICT", "La branche doit être créée depuis le SHA de base attendu.");
    const exists = await git(target.adapter, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    if (exists.exitCode === 0) throw new ForgeAgentError("CONFLICT", "Cette branche existe déjà.");
    if (exists.exitCode !== 1) throw new ForgeAgentError("CONFLICT", "Impossible de vérifier la branche.");
    succeeded(await git(target.adapter, ["switch", "-c", branch, target.artifact.baseCommitSha]), "Création de la branche");
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "BRANCHED", branchName: branch });
  }

  async function commit(userId: string, conversationId: string, artifactId: string, messageInput: unknown, confirmed: unknown) {
    requireConfirmation(confirmed, "créer le commit");
    const message = normalizeForgeCommitMessage(messageInput), target = await owned(userId, conversationId, artifactId);
    if (target.artifact.restoreStatus !== "RESTORED" || target.artifact.publicationStatus !== "BRANCHED" || !target.artifact.branchName) throw new ForgeAgentError("CONFLICT", "Restaurez l’artifact et créez une branche avant le commit.");
    assertContinuityPatchSafe(target.artifact);
    const branch = succeeded(await git(target.adapter, ["branch", "--show-current"]), "Lecture de la branche");
    if (branch !== target.artifact.branchName || /^(?:main|master)$/i.test(branch)) throw new ForgeAgentError("CONFLICT", "Le commit doit cibler la branche Forge confirmée.");
    succeeded(await git(target.adapter, ["add", "--", ...target.artifact.changedFiles]), "Préparation du commit");
    succeeded(await git(target.adapter, ["commit", "-m", message]), "Création du commit");
    const sha = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "Lecture du commit");
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "COMMITTED", commitSha: sha });
  }

  async function push(userId: string, conversationId: string, artifactId: string, confirmed: unknown) {
    requireConfirmation(confirmed, "push vers GitHub");
    const target = await owned(userId, conversationId, artifactId);
    if (target.artifact.publicationStatus !== "COMMITTED" || !target.artifact.branchName || !deps.getPushCredential) throw new ForgeAgentError("CONFLICT", "Un commit local sur une branche Forge est requis.");
    const branch = normalizeForgeBranchName(target.artifact.branchName);
    if (/^(?:main|master)$/i.test(branch)) throw new ForgeAgentError("CONFLICT", "Le push direct vers main/master est interdit.");
    const credential = await deps.getPushCredential(userId, target.artifact.repository);
    const header = `AUTHORIZATION: basic ${encodeBasic(credential.username, credential.password)}`;
    succeeded(await git(target.adapter, ["-c", "http.https://github.com/.extraheader=" + header, "push", "--set-upstream", "origin", branch]), "Push GitHub");
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "PUSHED" });
  }

  async function createPullRequest(userId: string, conversationId: string, artifactId: string, titleInput: unknown, confirmed: unknown) {
    requireConfirmation(confirmed, "créer la Pull Request");
    const title = normalizeForgeCommitMessage(titleInput), target = await owned(userId, conversationId, artifactId);
    if (target.artifact.publicationStatus !== "PUSHED" || !target.artifact.branchName || !deps.createPullRequest) throw new ForgeAgentError("CONFLICT", "Une branche Forge poussée est requise.");
    const result = await deps.createPullRequest(userId, { repository: target.artifact.repository, head: target.artifact.branchName, base: target.artifact.sourceBranch, title, body: `Forge AgentRun ${target.artifact.runId}\n\n${target.artifact.changedFiles.length} fichier(s), +${target.artifact.additions}/-${target.artifact.deletions}.\nValidations enregistrées dans la conversation Forge.` });
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "PR_CREATED", pullRequestUrl: result.url });
  }

  return { restore, createBranch, commit, push, createPullRequest };
}
