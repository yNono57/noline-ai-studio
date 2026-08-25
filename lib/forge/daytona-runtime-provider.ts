import "server-only";
import { randomUUID } from "node:crypto";
import { Daytona, DaytonaFileAccessDeniedError, DaytonaInvalidFilePathError, DaytonaNotFoundError, DaytonaProcessExecutionTimeoutError, SandboxState, type Sandbox } from "@daytona/sdk";
import { FORGE_RUNTIME_LIMITS, ForgeRuntimeError, normalizeRuntimePath, type ForgeRuntime, type ForgeRuntimeCommand, type ForgeRuntimeCommandResult, type ForgeRuntimeFileEntry, type ForgeRuntimeProvider, type ForgeRuntimeSource } from "./runtime-foundation";
import { parseGitPorcelain, quoteSandboxArgument } from "./daytona-foundation";

const ROOT = "repo", TTL = 60, STATUS_BYTES = 1_000_000;
function daytona() {
  const apiKey = process.env.DAYTONA_API_KEY?.trim();
  if (!apiKey) throw new ForgeRuntimeError("UNAVAILABLE", "Le provider Daytona n'est pas configure.");
  return new Daytona({ apiKey, otelEnabled: false, requestTimeoutMs: 65_000 });
}
function providerId(runtime: ForgeRuntime) {
  if (!runtime.providerRuntimeId) throw new ForgeRuntimeError("UNAVAILABLE", "Le sandbox Daytona n'est pas disponible.");
  return runtime.providerRuntimeId;
}
function repoParts(value: string) {
  const [owner, name, extra] = value.split("/");
  if (!owner || !name || extra || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) throw new ForgeRuntimeError("INVALID_INPUT", "Repository runtime invalide.");
  return { owner, name };
}
function sandboxPath(path: string, allowRoot = false) {
  const normalized = normalizeRuntimePath(path, allowRoot);
  return normalized === "." ? ROOT : ROOT + "/" + normalized;
}
function bound(value: string, max: number) {
  const bytes = Buffer.from(value, "utf8");
  return bytes.length <= max ? { value, bytes: bytes.length, truncated: false } : { value: new TextDecoder().decode(bytes.subarray(0, max)), bytes: max, truncated: true };
}
async function run(sandbox: Sandbox, command: string, cwd = ROOT, timeout = 30) { return sandbox.process.executeCommand(command, cwd, undefined, timeout); }
async function sandboxFor(runtime: ForgeRuntime) {
  try { return await daytona().get(providerId(runtime)); }
  catch (error) {
    if (error instanceof DaytonaNotFoundError) throw new ForgeRuntimeError("UNAVAILABLE", "Le sandbox Daytona n'existe plus.");
    throw new ForgeRuntimeError("UNAVAILABLE", "Daytona est temporairement indisponible.");
  }
}

export const daytonaRuntimeProvider: ForgeRuntimeProvider = {
  name: "daytona",
  provisioningAvailable: Boolean(process.env.DAYTONA_API_KEY?.trim()),
  async createRuntime(runtime, source: ForgeRuntimeSource) {
    if (!source.credential?.password) throw new ForgeRuntimeError("AUTHORIZATION", "Credential GitHub temporaire indisponible.");
    if (!/^[0-9a-f]{40,64}$/.test(source.baseCommitSha)) throw new ForgeRuntimeError("CONFLICT", "SHA de base runtime invalide.");
    const repository = repoParts(source.repository), url = "https://github.com/" + repository.owner + "/" + repository.name + ".git", sdk = daytona();
    let sandbox: Sandbox | null = null;
    try {
      sandbox = await sdk.create({ language: "typescript", public: false, ephemeral: true, ttlMinutes: TTL, autoStopInterval: 0, labels: { application: "noline-forge", runtime: runtime.runtimeId } }, { timeout: 120 });
      await sandbox.git.clone(url, ROOT, source.branch, source.baseCommitSha, source.credential.username, source.credential.password, false);
      await run(sandbox, "git remote set-url origin " + quoteSandboxArgument(url));
      const remote = await run(sandbox, "git remote get-url --all origin");
      const remoteVerbose = await run(sandbox, "git remote -v");
      const config = await run(sandbox, "git config --local --get-regexp 'url\\..*\\.insteadof|http\\..*\\.extraheader|credential\\..*' || true");
      const credentialLeaked = remoteVerbose.result.includes(source.credential.password);
      if (remote.exitCode !== 0 || remote.result.trim() !== url || remote.result.includes("@") || remoteVerbose.exitCode !== 0 || credentialLeaked || !remoteVerbose.result.includes(url) || config.result.trim()) throw new ForgeRuntimeError("CONFLICT", "La configuration Git du sandbox contient un credential.");
      const head = await run(sandbox, "git rev-parse HEAD");
      if (head.exitCode !== 0 || head.result.trim().toLowerCase() !== source.baseCommitSha.toLowerCase()) throw new ForgeRuntimeError("CONFLICT", "Le sandbox ne correspond pas au commit immuable du workspace.");
      const now = new Date();
      return { providerRuntimeId: sandbox.id, status: "READY" as const, readyAt: now.toISOString(), expiresAt: sandbox.autoDestroyAt || new Date(now.getTime() + TTL * 60_000).toISOString() };
    } catch (error) {
      if (sandbox) { try { await sdk.delete(sandbox, 60, true); } catch { /* Best-effort cleanup after failed provisioning. */ } }
      if (error instanceof ForgeRuntimeError) throw error;
      throw new ForgeRuntimeError("UNAVAILABLE", "La creation du sandbox Daytona a echoue.");
    } finally { delete source.credential; }
  },
  async getRuntime(runtime) {
    const sandbox = await sandboxFor(runtime);
    if (sandbox.state === SandboxState.STARTED) return { providerRuntimeId: sandbox.id, status: "READY", readyAt: runtime.readyAt || new Date().toISOString(), expiresAt: sandbox.autoDestroyAt || runtime.expiresAt };
    if ([String(SandboxState.CREATING), String(SandboxState.STARTING), String(SandboxState.RESTORING)].includes(String(sandbox.state))) return { providerRuntimeId: sandbox.id, status: "CREATING", readyAt: null, expiresAt: sandbox.autoDestroyAt || runtime.expiresAt };
    return null;
  },
  async destroyRuntime(runtime) {
    const sdk = daytona();
    try { const sandbox = await sdk.get(providerId(runtime)); await sdk.delete(sandbox, 60, true); }
    catch (error) { if (error instanceof DaytonaNotFoundError) return; throw new ForgeRuntimeError("UNAVAILABLE", "La destruction du sandbox Daytona a echoue."); }
  },
  async readFile(runtime, path) {
    const sandbox = await sandboxFor(runtime), target = sandboxPath(path);
    const measure = await run(sandbox, "wc -c < " + quoteSandboxArgument(target), ".");
    const size = Number.parseInt(measure.result.trim(), 10);
    if (measure.exitCode !== 0 || !Number.isFinite(size)) throw new ForgeRuntimeError("NOT_FOUND", "Fichier runtime introuvable.");
    if (size > FORGE_RUNTIME_LIMITS.maxFileCharacters) throw new ForgeRuntimeError("INVALID_INPUT", "Fichier runtime trop volumineux.");
    try {
      const buffer = await sandbox.fs.downloadFile(target);
      if (buffer.includes(0)) throw new ForgeRuntimeError("INVALID_INPUT", "Les fichiers binaires ne peuvent pas etre lus.");
      return { path, size: buffer.length, content: new TextDecoder("utf-8", { fatal: true }).decode(buffer) };
    } catch (error) { if (error instanceof ForgeRuntimeError) throw error; throw new ForgeRuntimeError("INVALID_INPUT", "Ce fichier runtime n'est pas un texte UTF-8 lisible."); }
  },
  async writeFile(runtime, path, content) {
    const buffer = Buffer.from(content, "utf8");
    if (buffer.length > FORGE_RUNTIME_LIMITS.maxFileCharacters) throw new ForgeRuntimeError("INVALID_INPUT", "Contenu runtime trop volumineux.");
    const sandbox = await sandboxFor(runtime), target = sandboxPath(path), parent = target.slice(0, target.lastIndexOf("/"));
    if (parent && parent !== ROOT) await sandbox.fs.createFolder(parent, "755");
    try { await sandbox.fs.uploadFile(buffer, target); } catch { throw new ForgeRuntimeError("UNAVAILABLE", "L'ecriture du fichier runtime a echoue."); }
    return { path, size: buffer.length, content };
  },
  async deleteFile(runtime, path) {
    const sandbox = await sandboxFor(runtime);
    try { await sandbox.fs.deleteFile(sandboxPath(path), false); }
    catch (error) {
      if (error instanceof DaytonaNotFoundError) return;
      throw new ForgeRuntimeError("UNAVAILABLE", "La suppression du fichier runtime a echoue.");
    }
  },
  async listFiles(runtime, path) {
    const sandbox = await sandboxFor(runtime);
    try {
      const entries = await sandbox.fs.listFiles(sandboxPath(path, true), { depth: 1 });
      return entries.slice(0, FORGE_RUNTIME_LIMITS.maxListEntries).map((entry): ForgeRuntimeFileEntry => {
        const full = (entry.path || entry.name).replace(/^\/+/, "");
        const relative = full.startsWith(ROOT + "/") ? full.slice(ROOT.length + 1) : full === ROOT ? "." : full;
        return { path: relative, type: entry.isDir ? "directory" : "file", size: entry.isDir ? null : entry.size };
      });
    } catch (error) { if (error instanceof DaytonaNotFoundError) throw new ForgeRuntimeError("NOT_FOUND", "Dossier runtime introuvable."); if (error instanceof DaytonaInvalidFilePathError) throw new ForgeRuntimeError("INVALID_INPUT", "Chemin de dossier runtime invalide."); if (error instanceof DaytonaFileAccessDeniedError) throw new ForgeRuntimeError("AUTHORIZATION", "Accès au dossier runtime refusé."); throw new ForgeRuntimeError("UNAVAILABLE", "La lecture du dossier runtime a echoue."); }
  },
  async executeCommand(runtime, command: ForgeRuntimeCommand): Promise<ForgeRuntimeCommandResult> {
    const sandbox = await sandboxFor(runtime), started = Date.now(), session = "forge-" + runtime.runtimeId + "-" + randomUUID();
    try {
      await sandbox.process.createSession(session);
      const request = [command.command, ...command.args].map(quoteSandboxArgument).join(" ");
      const response = await sandbox.process.executeSessionCommand(session, { command: request, runAsync: false, suppressInputEcho: true }, Math.ceil(command.timeoutMs / 1000));
      const stdout = bound(response.stdout || "", command.maxOutputBytes), stderr = bound(response.stderr || "", Math.max(0, command.maxOutputBytes - stdout.bytes));
      return { stdout: stdout.value, stderr: stderr.value, exitCode: response.exitCode ?? null, timedOut: false, truncated: stdout.truncated || stderr.truncated, durationMs: Date.now() - started };
    } catch (error) {
      if (error instanceof DaytonaProcessExecutionTimeoutError) return { stdout: "", stderr: "", exitCode: null, timedOut: true, truncated: false, durationMs: Date.now() - started };
      throw new ForgeRuntimeError("UNAVAILABLE", "La commande Daytona a echoue.");
    } finally { try { await sandbox.process.deleteSession(session); } catch { /* The bounded command has already ended. */ } }
  },
  async getGitStatus(runtime) {
    const result = await run(await sandboxFor(runtime), "git status --porcelain=v1 -z --untracked-files=all | head -c " + STATUS_BYTES);
    if (result.exitCode !== 0) throw new ForgeRuntimeError("UNAVAILABLE", "Git status a echoue dans le sandbox.");
    return parseGitPorcelain(result.result);
  },
  async getGitDiff(runtime, maxPatchCharacters) {
    const sandbox = await sandboxFor(runtime), status = await daytonaRuntimeProvider.getGitStatus(runtime);
    const tracked = await run(sandbox, "git diff --no-ext-diff --no-color HEAD -- . | head -c " + (maxPatchCharacters + 1));
    if (tracked.exitCode !== 0) throw new ForgeRuntimeError("UNAVAILABLE", "Git diff a echoue dans le sandbox.");
    let patch = tracked.result;
    let truncated = patch.length > maxPatchCharacters;
    for (const path of status.added) {
      if (patch.length > maxPatchCharacters) break;
      const remaining = maxPatchCharacters + 1 - patch.length;
      const added = await run(sandbox, "git diff --no-index --no-ext-diff --no-color -- /dev/null " + quoteSandboxArgument(path) + " | head -c " + remaining);
      if (added.exitCode !== 0 && added.exitCode !== 1) throw new ForgeRuntimeError("UNAVAILABLE", "Git diff a echoue dans le sandbox.");
      patch += added.result;
      if (patch.length > maxPatchCharacters) truncated = true;
    }
    return { ...status, patch: patch.slice(0, maxPatchCharacters), truncated };
  },
};
