import type { ForgeRuntimeCommandResult, ForgeRuntimeGitDiff, ForgeRuntimeGitStatus } from "./runtime-foundation";
import { ForgeAgentError, type ForgeAgentRun, type ForgeRunArtifact } from "./agent-foundation";
import { getForgeArtifactPublicationBlocker } from "./artifact-publication";

export type ForgeArtifactRestoreStatus = "AVAILABLE" | "RESTORING" | "RESTORED" | "CONFLICT" | "FAILED";
export type ForgeArtifactPublicationStatus = "LOCAL" | "BRANCHED" | "COMMITTED" | "PUSHED" | "PR_CREATED";
export type ForgeContinuityArtifact = ForgeRunArtifact;
export type ForgeContinuityWorkspace = { workspaceId: string; projectId: string; conversationId: string; repository: string; branch: string; baseCommitSha: string; status: string };
export type ForgeContinuityRuntime = { runtimeId: string; status: string; baseCommitSha: string };
type ArtifactUpdate = Partial<Pick<ForgeContinuityArtifact, "restoreStatus" | "publicationStatus" | "restoredAt" | "restoredRuntimeId" | "branchName" | "commitSha" | "pullRequestUrl" | "remoteBranch" | "pullRequestNumber" | "pullRequestTarget" | "publishedAt" | "pullRequestCreatedAt" | "conflictFiles">>;
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
  preparePush?(userId: string, repository: string, branch: string): Promise<{ username: string; password: string; remoteSha: string | null }>;
  createPullRequest?(userId: string, input: { repository: string; head: string; base: string; title: string; body: string }): Promise<{ number: number; url: string; createdAt: string }>;
  now(): string;
};

export function assertContinuityPatchSafe(artifact: ForgeContinuityArtifact) {
  const blocker = getForgeArtifactPublicationBlocker(artifact);
  if (blocker) throw new ForgeAgentError(blocker.includes("200000") ? "LIMIT" : "INVALID_INPUT", `${blocker.includes("200000") ? "ARTIFACT_TOO_LARGE" : "SENSITIVE_FILES"}: ${blocker}`);
}
export function normalizeForgeBranchName(value: unknown) {
  if (typeof value !== "string") throw new ForgeAgentError("INVALID_INPUT", "INVALID_BRANCH: nom de branche invalide.");
  const branch = value.trim();
  if (!/^forge\/[a-z0-9][a-z0-9._/-]{0,78}$/i.test(branch) || branch.includes("..") || branch.includes("//") || branch.endsWith("/") || branch.endsWith(".lock")) throw new ForgeAgentError("INVALID_INPUT", "INVALID_BRANCH: utilisez un nom Git sûr sous forge/.");
  return branch;
}
export function normalizeForgeCommitMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200 || /[\r\n\0]/.test(value)) throw new ForgeAgentError("INVALID_INPUT", "COMMIT_FAILED: message de commit invalide.");
  return value.trim();
}
function normalizePullRequestBody(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || value.length > 10_000 || value.includes("\0")) throw new ForgeAgentError("INVALID_INPUT", "PR_FAILED: description invalide.");
  return value.trim();
}
function requireConfirmation(value: unknown, action: string) { if (value !== true) throw new ForgeAgentError("CONFLICT", `AUTH_REQUIRED: Confirmation explicite requise pour ${action}.`); }
export type ForgeGitFailureReason = "GIT_IDENTITY_MISSING" | "NOT_A_GIT_REPOSITORY" | "BRANCH_MISMATCH" | "WORKTREE_MISMATCH" | "NOTHING_TO_COMMIT" | "INDEX_LOCKED" | "GIT_COMMAND_FAILED";
export function sanitizeForgeGitOutput(value: string, max = 2_000) {
  return value
    .replace(/(https?:\/\/)[^/@\s]+:[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, (match) => `${match.split(/\s/, 1)[0]} [REDACTED]`)
    .replace(/\b(?:github_pat_|gh[opsur]_|sk-|vcp_)[A-Za-z0-9_-]{8,}/gi, "[REDACTED]")
    .replace(/(?:API_KEY|PRIVATE_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .slice(0, max)
    .trim();
}
export function classifyForgeGitFailure(result: ForgeRuntimeCommandResult): ForgeGitFailureReason {
  const output = `${result.stderr}\n${result.stdout}`;
  if (/author identity unknown|unable to auto-detect email address|no email was given|please tell me who you are/i.test(output)) return "GIT_IDENTITY_MISSING";
  if (/not a git repository/i.test(output)) return "NOT_A_GIT_REPOSITORY";
  if (/index\.lock|another git process seems to be running|unable to create .*\.lock/i.test(output)) return "INDEX_LOCKED";
  if (/nothing to commit|no changes added to commit/i.test(output)) return "NOTHING_TO_COMMIT";
  return "GIT_COMMAND_FAILED";
}
function failedGit(result: ForgeRuntimeCommandResult, operation: string, label: string, reason = classifyForgeGitFailure(result)): never {
  const stdout = sanitizeForgeGitOutput(result.stdout) || "(vide)";
  const stderr = sanitizeForgeGitOutput(result.stderr) || "(vide)";
  throw new ForgeAgentError("CONFLICT", `${label}\noperation: ${operation}\nexitCode: ${result.exitCode ?? "null"}\nreason: ${reason}\nstdout: ${stdout}\nstderr: ${stderr}`);
}
function succeeded(result: ForgeRuntimeCommandResult, label: string, operation = "git") {
  if (result.timedOut || result.exitCode !== 0) failedGit(result, operation, label);
  return result.stdout.trim();
}
function git(runtime: ForgeContinuityRuntimeAdapter, args: string[]) { return runtime.execute({ command: "git", args, cwd: ".", timeoutMs: 60_000, maxOutputBytes: 250_000 }); }
function conflictFiles(output: string) { return [...new Set([...output.matchAll(/(?:error:\s+patch failed:\s+|patch does not apply\s+)([^:\r\n]+)/gi)].map((match) => match[1].trim()).filter(Boolean))].slice(0, 50); }
function encodeBasic(username: string, password: string) {
  if (!username || !password || /[\r\n\0]/.test(username + password)) throw new ForgeAgentError("INVALID_INPUT", "GITHUB_AUTH_REQUIRED: credential GitHub invalide.");
  return Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}
function changedFiles(status: ForgeRuntimeGitStatus) { return [...new Set([...status.added, ...status.modified, ...status.deleted])].sort(); }
function sameFiles(left: string[], right: string[]) { return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort()); }
function outputFiles(output: string) { return [...new Set(output.split(/\r?\n/).map((path) => path.trim()).filter(Boolean))].sort(); }
function samePatch(left: string, right: string) { return left.replace(/\r\n/g, "\n").trimEnd() === right.replace(/\r\n/g, "\n").trimEnd(); }

export function createForgeContinuityService(deps: ForgeContinuityDependencies) {
  async function owned(userId: string, conversationId: string, artifactId: string) {
    if (!userId.trim()) throw new ForgeAgentError("UNAUTHENTICATED", "AUTH_REQUIRED: authentification requise.");
    const [workspace, runtime, artifact] = await Promise.all([deps.getWorkspace(userId, conversationId), deps.getRuntime(userId, conversationId), deps.getArtifact(userId, artifactId)]);
    if (!workspace || !runtime || !artifact) throw new ForgeAgentError("NOT_FOUND", "OWNERSHIP_DENIED: artifact ou runtime Forge introuvable.");
    const run = await deps.getRun(userId, artifact.runId);
    if (!run || run.conversationId !== conversationId || run.projectId !== workspace.projectId || artifact.repository !== workspace.repository) throw new ForgeAgentError("NOT_FOUND", "OWNERSHIP_DENIED: artifact Forge non autorisé pour ce projet.");
    if (runtime.status !== "READY") throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: un runtime READY est requis.");
    return { workspace, runtime, artifact, run, adapter: deps.runtime(userId, conversationId) };
  }

  async function ownedArtifact(userId: string, conversationId: string, artifactId: string) {
    if (!userId.trim()) throw new ForgeAgentError("UNAUTHENTICATED", "AUTH_REQUIRED: authentification requise.");
    const [workspace, artifact] = await Promise.all([deps.getWorkspace(userId, conversationId), deps.getArtifact(userId, artifactId)]);
    if (!workspace || !artifact) throw new ForgeAgentError("NOT_FOUND", "OWNERSHIP_DENIED: artifact Forge introuvable.");
    const run = await deps.getRun(userId, artifact.runId);
    if (!run || run.conversationId !== conversationId || run.projectId !== workspace.projectId || artifact.repository !== workspace.repository) throw new ForgeAgentError("NOT_FOUND", "OWNERSHIP_DENIED: artifact Forge non autorisé pour ce projet.");
    return { workspace, artifact, run };
  }

  async function restore(userId: string, conversationId: string, artifactId: string, allowBaseMismatch = false) {
    const target = await owned(userId, conversationId, artifactId);
    if (target.artifact.status === "EMPTY") return deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORED", restoredAt: deps.now(), restoredRuntimeId: target.runtime.runtimeId, conflictFiles: [] });
    assertContinuityPatchSafe(target.artifact);
    await deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORING", conflictFiles: [] });
    const existingStatus = await target.adapter.getGitStatus();
    const existingChanges = changedFiles(existingStatus);
    if (existingChanges.length > 0) {
      const existingDiff = await target.adapter.getGitDiff();
      if (!existingDiff.truncated && sameFiles(target.artifact.changedFiles, existingChanges) && existingDiff.patch === target.artifact.patch) return deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORED", restoredAt: deps.now(), restoredRuntimeId: target.runtime.runtimeId, conflictFiles: [] });
      return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: existingChanges });
    }
    const temporaryPath = `.noline/restore-${target.artifact.artifactId}.patch`;
    try {
      await target.adapter.writeFile(temporaryPath, target.artifact.patch);
      const head = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "Lecture du HEAD échouée");
      const check = await git(target.adapter, ["apply", "--check", "--whitespace=nowarn", temporaryPath]);
      if (check.timedOut || check.exitCode !== 0) return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: conflictFiles(`${check.stdout}\n${check.stderr}`) });
      if (head !== target.artifact.baseCommitSha && !allowBaseMismatch) return deps.updateArtifact(userId, artifactId, { restoreStatus: "CONFLICT", conflictFiles: [] });
      succeeded(await git(target.adapter, ["apply", "--whitespace=nowarn", temporaryPath]), "Restauration du patch échouée");
      const [status, diff] = await Promise.all([target.adapter.getGitStatus(), target.adapter.getGitDiff()]);
      if (diff.truncated) throw new ForgeAgentError("LIMIT", "Le diff restauré dépasse la limite de vérification.");
      if (!sameFiles(target.artifact.changedFiles, changedFiles(status))) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: le working tree restauré ne correspond pas à l’artifact.");
      return deps.updateArtifact(userId, artifactId, { restoreStatus: "RESTORED", restoredAt: deps.now(), restoredRuntimeId: target.runtime.runtimeId, conflictFiles: [] });
    } catch (error) {
      if (error instanceof ForgeAgentError) await deps.updateArtifact(userId, artifactId, { restoreStatus: error.code === "CONFLICT" ? "CONFLICT" : "FAILED" });
      throw error;
    } finally { await target.adapter.deleteFile(temporaryPath).catch(() => undefined); }
  }

  async function createBranch(userId: string, conversationId: string, artifactId: string, branchInput: unknown) {
    const branch = normalizeForgeBranchName(branchInput), target = await owned(userId, conversationId, artifactId);
    if (target.artifact.publicationStatus !== "LOCAL") {
      if (target.artifact.branchName === branch) return target.artifact;
      throw new ForgeAgentError("CONFLICT", "ALREADY_PUBLISHED: une branche de publication existe déjà.");
    }
    if (target.artifact.restoreStatus !== "RESTORED" || target.artifact.restoredRuntimeId !== target.runtime.runtimeId) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: restaurez cet artifact dans le runtime actif avant de créer la branche.");
    assertContinuityPatchSafe(target.artifact);
    const head = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "Lecture du HEAD échouée");
    if (head !== target.artifact.baseCommitSha) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: la branche doit partir du SHA attendu.");
    const exists = await git(target.adapter, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    if (exists.exitCode === 0) {
      const currentBranch = succeeded(await git(target.adapter, ["branch", "--show-current"]), "COMMIT_FAILED: lecture de branche échouée");
      if (currentBranch === branch) return deps.updateArtifact(userId, artifactId, { publicationStatus: "BRANCHED", branchName: branch });
      throw new ForgeAgentError("CONFLICT", "BRANCH_EXISTS: cette branche existe déjà.");
    }
    if (exists.exitCode !== 1) throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED: impossible de vérifier la branche.");
    succeeded(await git(target.adapter, ["switch", "-c", branch, target.artifact.baseCommitSha]), "COMMIT_FAILED: création de branche échouée");
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "BRANCHED", branchName: branch });
  }

  async function commit(userId: string, conversationId: string, artifactId: string, messageInput: unknown, confirmed: unknown) {
    requireConfirmation(confirmed, "créer le commit");
    const message = normalizeForgeCommitMessage(messageInput), target = await owned(userId, conversationId, artifactId);
    if (["COMMITTED", "PUSHED", "PR_CREATED"].includes(target.artifact.publicationStatus) && target.artifact.commitSha) return target.artifact;
    if (target.artifact.restoreStatus !== "RESTORED" || target.artifact.restoredRuntimeId !== target.runtime.runtimeId || target.artifact.publicationStatus !== "BRANCHED" || !target.artifact.branchName) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: restaurez cet artifact dans le runtime actif et créez une branche avant le commit.");
    assertContinuityPatchSafe(target.artifact);
    const branch = succeeded(await git(target.adapter, ["branch", "--show-current"]), "COMMIT_FAILED: lecture de branche échouée", "branch_verification");
    if (branch !== target.artifact.branchName || /^(?:main|master)$/i.test(branch)) throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: BRANCH_MISMATCH\nLe commit doit cibler la branche Forge confirmée.");
    const status = await target.adapter.getGitStatus();
    const headBefore = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "COMMIT_FAILED: lecture du HEAD échouée", "head_verification");
    if (headBefore !== target.artifact.baseCommitSha) {
      if (changedFiles(status).length !== 0) throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: WORKTREE_MISMATCH\nLe HEAD et le working tree ne correspondent pas à l’artifact attendu.");
      const parent = succeeded(await git(target.adapter, ["rev-parse", "HEAD^"]), "COMMIT_FAILED: lecture du parent échouée", "retry_parent_verification");
      const committedFiles = outputFiles(succeeded(await git(target.adapter, ["diff", "--name-only", target.artifact.baseCommitSha, headBefore, "--"]), "COMMIT_FAILED: lecture des fichiers commités échouée", "retry_files_verification"));
      const committedPatch = succeeded(await git(target.adapter, ["diff", "--no-ext-diff", "--no-color", target.artifact.baseCommitSha, headBefore, "--", ...target.artifact.changedFiles]), "COMMIT_FAILED: lecture du diff commité échouée", "retry_diff_verification");
      if (parent === target.artifact.baseCommitSha && sameFiles(target.artifact.changedFiles, committedFiles) && samePatch(target.artifact.patch, committedPatch)) return deps.updateArtifact(userId, artifactId, { publicationStatus: "COMMITTED", commitSha: headBefore });
      throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: WORKTREE_MISMATCH\nLe commit existant ne correspond pas exactement à l’artifact attendu.");
    }
    if (!sameFiles(target.artifact.changedFiles, changedFiles(status))) throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: WORKTREE_MISMATCH\nLes fichiers du working tree diffèrent de l’artifact.");
    succeeded(await git(target.adapter, ["add", "--", ...target.artifact.changedFiles]), "COMMIT_FAILED: préparation du commit échouée", "artifact_staging");
    const stagedFiles = outputFiles(succeeded(await git(target.adapter, ["diff", "--cached", "--name-only", "--"]), "COMMIT_FAILED: lecture des fichiers indexés échouée", "staged_files_verification"));
    const stagedPatch = succeeded(await git(target.adapter, ["diff", "--cached", "--no-ext-diff", "--no-color", "--", ...target.artifact.changedFiles]), "COMMIT_FAILED: lecture du diff indexé échouée", "staged_diff_verification");
    if (!sameFiles(target.artifact.changedFiles, stagedFiles) || !samePatch(target.artifact.patch, stagedPatch)) throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: WORKTREE_MISMATCH\nLe contenu indexé ne correspond pas exactement à l’artifact.");
    const staged = await git(target.adapter, ["diff", "--cached", "--quiet"]);
    if (staged.exitCode !== 1 || staged.timedOut) failedGit(staged, "staged_changes_verification", "COMMIT_FAILED", "NOTHING_TO_COMMIT");
    const commitResult = await git(target.adapter, ["-c", "user.name=NØLINE Forge", "-c", "user.email=forge@noline-ai.fr", "commit", "-m", message]);
    if (commitResult.timedOut || commitResult.exitCode !== 0) failedGit(commitResult, "commit", "COMMIT_FAILED");
    const sha = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "COMMIT_FAILED: lecture du commit échouée", "commit_sha_verification");
    const parent = succeeded(await git(target.adapter, ["rev-parse", "HEAD^"]), "COMMIT_FAILED: lecture du parent échouée", "commit_parent_verification");
    const committedFiles = outputFiles(succeeded(await git(target.adapter, ["diff", "--name-only", target.artifact.baseCommitSha, sha, "--"]), "COMMIT_FAILED: lecture des fichiers commités échouée", "commit_files_verification"));
    const committedPatch = succeeded(await git(target.adapter, ["diff", "--no-ext-diff", "--no-color", target.artifact.baseCommitSha, sha, "--", ...target.artifact.changedFiles]), "COMMIT_FAILED: lecture du diff commité échouée", "commit_diff_verification");
    if (sha !== headBefore && parent === target.artifact.baseCommitSha && sameFiles(target.artifact.changedFiles, committedFiles) && samePatch(target.artifact.patch, committedPatch)) return deps.updateArtifact(userId, artifactId, { publicationStatus: "COMMITTED", commitSha: sha });
    throw new ForgeAgentError("CONFLICT", "COMMIT_FAILED\nreason: WORKTREE_MISMATCH\nLe commit créé ne correspond pas exactement à l’artifact attendu.");
  }

  async function push(userId: string, conversationId: string, artifactId: string, confirmed: unknown) {
    requireConfirmation(confirmed, "push vers GitHub");
    const target = await owned(userId, conversationId, artifactId);
    if (["PUSHED", "PR_CREATED"].includes(target.artifact.publicationStatus) && target.artifact.remoteBranch) return target.artifact;
    if (target.artifact.publicationStatus !== "COMMITTED" || !target.artifact.branchName || !target.artifact.commitSha) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: un commit local sur une branche Forge est requis.");
    if (!deps.preparePush) throw new ForgeAgentError("CONFLICT", "GITHUB_AUTH_REQUIRED: publication GitHub indisponible.");
    const branch = normalizeForgeBranchName(target.artifact.branchName);
    if (/^(?:main|master)$/i.test(branch)) throw new ForgeAgentError("CONFLICT", "PUSH_REJECTED: le push direct vers main/master est interdit.");
    const currentBranch = succeeded(await git(target.adapter, ["branch", "--show-current"]), "PUSH_REJECTED: lecture de branche échouée");
    const head = succeeded(await git(target.adapter, ["rev-parse", "HEAD"]), "PUSH_REJECTED: lecture du commit échouée");
    if (currentBranch !== branch || head !== target.artifact.commitSha) throw new ForgeAgentError("CONFLICT", "WORKTREE_NOT_READY: branche ou commit local inattendu.");
    let credential: { username: string; password: string; remoteSha: string | null };
    try { credential = await deps.preparePush(userId, target.artifact.repository, branch); }
    catch { throw new ForgeAgentError("CONFLICT", "GITHUB_AUTH_REQUIRED: autorisation GitHub d’écriture indisponible."); }
    if (credential.remoteSha === target.artifact.commitSha) return deps.updateArtifact(userId, artifactId, { publicationStatus: "PUSHED", remoteBranch: branch, publishedAt: target.artifact.publishedAt || deps.now() });
    if (credential.remoteSha && credential.remoteSha !== target.artifact.baseCommitSha) throw new ForgeAgentError("CONFLICT", "REMOTE_CHANGED: la branche distante a divergé; aucun push effectué.");
    const header = `AUTHORIZATION: basic ${encodeBasic(credential.username, credential.password)}`;
    const result = await git(target.adapter, ["-c", `http.https://github.com/.extraheader=${header}`, "push", "origin", `${target.artifact.commitSha}:refs/heads/${branch}`]);
    if (result.timedOut || result.exitCode !== 0) throw new ForgeAgentError("CONFLICT", "PUSH_REJECTED: GitHub a refusé le push non forcé.");
    const verified = await deps.preparePush(userId, target.artifact.repository, branch).catch(() => null);
    if (!verified || verified.remoteSha !== target.artifact.commitSha) throw new ForgeAgentError("CONFLICT", "PUSH_REJECTED: la branche distante ne correspond pas au commit attendu.");
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "PUSHED", remoteBranch: branch, publishedAt: deps.now() });
  }

  async function createPullRequest(userId: string, conversationId: string, artifactId: string, titleInput: unknown, bodyInput: unknown, confirmed: unknown) {
    requireConfirmation(confirmed, "créer la Pull Request");
    const title = normalizeForgeCommitMessage(titleInput), target = await ownedArtifact(userId, conversationId, artifactId);
    if (target.artifact.publicationStatus === "PR_CREATED" && target.artifact.pullRequestUrl && target.artifact.pullRequestNumber) return target.artifact;
    if (target.artifact.publicationStatus !== "PUSHED" || !target.artifact.remoteBranch || !deps.createPullRequest) throw new ForgeAgentError("CONFLICT", "PR_FAILED: une branche Forge poussée est requise.");
    const fallback = `Forge AgentRun ${target.artifact.runId}\n\n${target.artifact.changedFiles.length} fichier(s), +${target.artifact.additions}/-${target.artifact.deletions}.\n\nFichiers :\n${target.artifact.changedFiles.map((path) => `- ${path}`).join("\n")}\n\nValidations enregistrées dans la conversation Forge.`;
    const body = normalizePullRequestBody(bodyInput, fallback);
    let result: { number: number; url: string; createdAt: string };
    try { result = await deps.createPullRequest(userId, { repository: target.artifact.repository, head: target.artifact.remoteBranch, base: target.artifact.sourceBranch, title, body }); }
    catch { throw new ForgeAgentError("CONFLICT", "PR_FAILED: GitHub a refusé la création de la Pull Request."); }
    return deps.updateArtifact(userId, artifactId, { publicationStatus: "PR_CREATED", pullRequestUrl: result.url, pullRequestNumber: result.number, pullRequestTarget: target.artifact.sourceBranch, pullRequestCreatedAt: result.createdAt });
  }

  return { restore, createBranch, commit, push, createPullRequest };
}
