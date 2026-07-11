import type { Clock } from "@domain/shared/Clock";
import type { Actor } from "@application/Actor";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { SlotRepository } from "@application/ports/SlotRepository";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface ListOpenSlotsDeps {
  readonly profiles: ProfileRepository;
  readonly slots: SlotRepository;
  readonly clock: Clock;
}

/**
 * Artist-authenticated, internal-facing listing (N2) — richer than the
 * public `PublicEventProjection` (D6): includes exact `location` and the
 * owning Hospital's public name, but only for `open` Slots whose
 * `scheduledAt` is still strictly in the future.
 */
export interface OpenSlotListing {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly hospitalName: string;
}

export async function listOpenSlots(
  actor: Actor,
  deps: ListOpenSlotsDeps,
): Promise<readonly OpenSlotListing[]> {
  assertRole(actor, "artist");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  assertActiveProfile(profile);

  const now = deps.clock.now().getTime();
  const openSlots = await deps.slots.listOpen();
  const upcoming = openSlots.filter((slot) => slot.scheduledAt.getTime() > now);

  const listings: OpenSlotListing[] = [];
  for (const slot of upcoming) {
    const hospital = await deps.profiles.findById(slot.hospitalProfileId);
    listings.push({
      id: slot.id,
      title: slot.title,
      description: slot.description,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes,
      location: slot.location,
      hospitalName: hospital?.name ?? "",
    });
  }
  return listings;
}
