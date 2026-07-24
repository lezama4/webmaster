import type { ActiveProfileView } from "@application/dto/ActiveProfileView";
import type { ActiveProfileQuery } from "@application/ports/ActiveProfileQuery";
import type { Actor } from "@application/Actor";
import { assertRole } from "./shared/guards";

export interface ListActiveProfilesDeps {
  readonly activeProfileQuery: ActiveProfileQuery;
}

/**
 * Admin-only active-profile listing (auditable-profile-approval, PR4/5.6) —
 * depends ONLY on the dedicated `ActiveProfileQuery` port. Closes the scope
 * gap surfaced during Phase 5's read: there was no existing UI trigger for
 * `deactivateProfile` anywhere, only its API route.
 *
 * Mirrors `listPendingProfiles`'s D6 discipline: this use case does NOT
 * return the port's object unchanged — it rebuilds a FRESH DTO field-by-
 * field via `toActiveProfileView`, discarding any other property a hostile
 * or accidentally-widened adapter might have supplied.
 */
export async function listActiveProfiles(
  actor: Actor,
  deps: ListActiveProfilesDeps,
): Promise<readonly ActiveProfileView[]> {
  assertRole(actor, "admin");

  const records = await deps.activeProfileQuery.listActive();
  return records.map(toActiveProfileView);
}

function toActiveProfileView(record: ActiveProfileView): ActiveProfileView {
  return {
    profileId: record.profileId,
    type: record.type,
    ...(record.centreType !== undefined ? { centreType: record.centreType } : {}),
    displayName: record.displayName,
  };
}
