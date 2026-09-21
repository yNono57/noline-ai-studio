import type { OwnershipContext } from "../identity/contracts";
import type { ArtifactId, ProjectId, RunId } from "../shared/ids";
import type { Provenance } from "../shared/provenance";
import type { Instant } from "../shared/time";

export type ArtifactType = string & { readonly __artifactType: unique symbol };
export const artifactType = (value: string): ArtifactType => {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("Artifact type cannot be empty.");
  return normalized as ArtifactType;
};

export interface Artifact {
  readonly id: ArtifactId;
  readonly projectId: ProjectId;
  readonly runId: RunId | null;
  readonly ownership: OwnershipContext;
  readonly type: ArtifactType;
  readonly name: string;
  readonly provenance: Provenance;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Instant;
}
