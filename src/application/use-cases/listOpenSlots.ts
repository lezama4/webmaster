import type { Clock } from "@domain/shared/Clock";
import type { Actor } from "@application/Actor";
import type {
  OpenSlotListingItem,
  OpenSlotListingQuery,
} from "@application/ports/OpenSlotListingQuery";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface ListOpenSlotsDeps {
  readonly profiles: ProfileRepository;
  readonly openSlotListingQuery: OpenSlotListingQuery;
  readonly clock: Clock;
}

/** Re-exported for call sites that want the item shape by its use-case-local name. */
export type OpenSlotListing = OpenSlotListingItem;

/**
 * Artist-authenticated, internal-facing listing (N2) — only for `open`
 * Slots whose `scheduledAt` is still strictly in the future.
 *
 * pr2a-N3: delegates the join (Slot -> owning Hospital Profile) to the
 * dedicated `OpenSlotListingQuery` port instead of looping over
 * `profiles.findById` once per Slot (the previous N+1 pattern, which also
 * silently substituted `""` for a broken Slot -> Hospital relation). This
 * use case never receives a raw Slot to enrich itself — the adapter is the
 * ONLY place permitted to perform that join, and it fails fast (rejects)
 * on a broken relation rather than returning misleading content.
 */
export async function listOpenSlots(
  actor: Actor,
  deps: ListOpenSlotsDeps,
): Promise<readonly OpenSlotListing[]> {
  assertRole(actor, "artist");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  assertActiveProfile(profile, "artist");

  return deps.openSlotListingQuery.listOpenUpcoming(deps.clock.now());
}
