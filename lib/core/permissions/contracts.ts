export const CAPABILITIES = [
  "project.read", "project.write", "file.read", "file.write", "repo.read", "repo.write",
  "exec.sandbox", "git.write", "external.send", "deploy.preview", "deploy.production", "spend.ai", "admin.*",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export interface PermissionGrant { readonly capability: Capability; readonly effect: "allow" | "deny" }

const known = new Set<string>(CAPABILITIES);

export function isCapability(value: string): value is Capability {
  return known.has(value);
}

export function hasCapability(grants: readonly PermissionGrant[], requested: string): boolean {
  if (!isCapability(requested)) return false;
  const matching = grants.filter((grant) => grant.capability === requested);
  if (matching.some((grant) => grant.effect === "deny")) return false;
  return matching.some((grant) => grant.effect === "allow");
}
