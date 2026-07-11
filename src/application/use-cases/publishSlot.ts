import { createSlot, type Slot } from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { SlotRepository } from "@application/ports/SlotRepository";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface PublishSlotInput {
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
}

export interface PublishSlotDeps {
  readonly profiles: ProfileRepository;
  readonly slots: SlotRepository;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Hospital-only Slot publication, gated on the acting Hospital's LIVE
 * Profile status (M6) — never the session-time snapshot. Domain invariants
 * (N2: future `scheduledAt`, positive duration, text bounds) are enforced by
 * `createSlot` and propagate as `DomainValidationError`.
 */
export async function publishSlot(
  actor: Actor,
  input: PublishSlotInput,
  deps: PublishSlotDeps,
): Promise<Slot> {
  assertRole(actor, "hospital");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  const activeProfile = assertActiveProfile(profile);

  const slot = createSlot(
    {
      id: deps.idGenerator.next(),
      hospitalProfileId: activeProfile.id,
      title: input.title,
      description: input.description,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      location: input.location,
    },
    deps.clock,
  );

  await deps.slots.save(slot);
  return slot;
}
