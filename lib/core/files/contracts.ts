import type { OwnershipContext } from "../identity/contracts";
import type { FileId, ProjectId } from "../shared/ids";
import type { Provenance } from "../shared/provenance";
import type { Instant } from "../shared/time";

export type ByteSize = number & { readonly __byteSize: unique symbol };
export function byteSize(value: number): ByteSize {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("File size must be a non-negative safe integer.");
  return value as ByteSize;
}

export interface FileAsset {
  readonly id: FileId;
  readonly projectId: ProjectId;
  readonly ownership: OwnershipContext;
  readonly name: string;
  readonly mimeType: string;
  readonly size: ByteSize;
  readonly provenance: Provenance;
  readonly createdAt: Instant;
}
