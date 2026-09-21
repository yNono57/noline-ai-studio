import type { OrganizationId, UserId } from "../shared/ids";

export type OwnershipContext =
  | { readonly kind: "user"; readonly userId: UserId }
  | {
      readonly kind: "organization";
      readonly organizationId: OrganizationId;
      readonly actingUserId: UserId;
    };

export const userOwnership = (userId: UserId): OwnershipContext => ({ kind: "user", userId });

export function ownershipUserId(ownership: OwnershipContext): UserId {
  return ownership.kind === "user" ? ownership.userId : ownership.actingUserId;
}
