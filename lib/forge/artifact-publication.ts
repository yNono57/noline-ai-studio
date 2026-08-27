import type { ForgeRunArtifact } from "./agent-foundation";
import { FORGE_RUNTIME_LIMITS } from "./runtime-foundation";

const sensitivePath = /(^|\/)(?:\.env(?:\..*)?|\.git|node_modules|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?)(\/|$)/i;

export function getForgeArtifactPublicationBlocker(artifact: ForgeRunArtifact): string | null {
  if (artifact.status !== "READY") return "Publication indisponible : cet artifact ne contient aucun changement Git.";
  if (!/^[^/\s]+\/[^/\s]+$/.test(artifact.repository)) return "Publication indisponible : repository GitHub invalide.";
  if (!/^[0-9a-f]{40,64}$/.test(artifact.baseCommitSha)) return "Publication indisponible : SHA de base manquant ou invalide.";
  if (!artifact.sourceBranch || /[\0\r\n]/.test(artifact.sourceBranch)) return "Publication indisponible : branche de base manquante ou invalide.";
  if (!artifact.patch || artifact.patch.includes("\0")) return "Publication indisponible : patch Git vide ou invalide.";
  if (artifact.patch.length > FORGE_RUNTIME_LIMITS.maxDiffCharacters) return `Publication indisponible : patch supérieur à ${FORGE_RUNTIME_LIMITS.maxDiffCharacters} caractères.`;
  if (artifact.changedFiles.some((path) => !path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..") || sensitivePath.test(path))) return "Publication indisponible : fichier sensible ou hors repository détecté.";
  for (const line of artifact.patch.split("\n")) {
    if (!/^(?:diff --git|--- |\+\+\+ )/.test(line) || /(?:---|\+\+\+) \/dev\/null$/.test(line)) continue;
    if (/ (?:a|b)?\/\.\.\//.test(line) || / (?:a|b)?\/(?:\.env(?:[./]|$)|\.git(?:\/|$)|node_modules(?:\/$)|credentials?(?:[./]|$)|secrets?(?:[./]|$))/i.test(line)) return "Publication indisponible : patch sensible ou hors repository détecté.";
  }
  return null;
}