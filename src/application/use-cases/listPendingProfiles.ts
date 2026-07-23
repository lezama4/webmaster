import type { PendingProfileView } from "@application/dto/PendingProfileView";
import type { PendingProfileQuery } from "@application/ports/PendingProfileQuery";
import type { Actor } from "@application/Actor";
import { assertRole } from "./shared/guards";

export interface ListPendingProfilesDeps {
  readonly pendingProfileQuery: PendingProfileQuery;
}

/**
 * Admin-only pending-profile queue (5.3/5.12) — depends ONLY on the
 * dedicated `PendingProfileQuery` port. This INCLUDES re-registered
 * (`rejected -> pending`) Profiles: the SAME queue, no separate path (5.12,
 * confirmed by `registerProfile`'s existing reactivation branch and the
 * approve/reject routes operating uniformly on Profile ids). Ordering
 * (oldest-first by `requestedAt`) is the port/adapter's responsibility.
 *
 * Mirrors `listPublishedEvents`'s D6/pr2a-B1 discipline: this use case does
 * NOT return the port's object unchanged — it rebuilds a FRESH DTO
 * field-by-field via `toPendingProfileView`, discarding any other property
 * a hostile or accidentally-widened adapter might have supplied (e.g. an
 * Account id, email, or password hash), so a TypeScript-only allow-list
 * cannot be bypassed at the JSON-serialization boundary.
 */
export async function listPendingProfiles(
  actor: Actor,
  deps: ListPendingProfilesDeps,
): Promise<readonly PendingProfileView[]> {
  assertRole(actor, "admin");

  const records = await deps.pendingProfileQuery.listPending();
  return records.map(toPendingProfileView);
}

function toPendingProfileView(record: PendingProfileView): PendingProfileView {
  return {
    profileId: record.profileId,
    type: record.type,
    ...(record.centreType !== undefined ? { centreType: record.centreType } : {}),
    displayName: record.displayName,
    requestedAt: record.requestedAt,
  };
}
