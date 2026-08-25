import { normalizeRuntimePath, type ForgeRuntimeGitStatus } from "./runtime-foundation";

export const DAYTONA_REPOSITORY_ROOT = "repo";

export function resolveDaytonaRepositoryCwd(cwd = ".") {
  const normalized = normalizeRuntimePath(cwd, true);
  return normalized === "." ? DAYTONA_REPOSITORY_ROOT : `${DAYTONA_REPOSITORY_ROOT}/${normalized}`;
}

export function quoteSandboxArgument(value: string) { return "'" + value.replace(/'/g, "'\"'\"'") + "'"; }

export function parseGitPorcelain(output: string): ForgeRuntimeGitStatus {
  const status: ForgeRuntimeGitStatus = { added: [], modified: [], deleted: [] };
  const records = output.split("\0").filter(Boolean);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]; if (record.length < 4) continue;
    const code = record.slice(0, 2), path = record.slice(3);
    if (code.includes("R") || code.includes("C")) index += 1;
    if (code === "??" || code.includes("A")) status.added.push(path);
    else if (code.includes("D")) status.deleted.push(path);
    else status.modified.push(path);
  }
  return status;
}
