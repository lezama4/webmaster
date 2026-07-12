import { createSlot, type Slot } from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
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
  readonly profileUnitOfWork: ProfileUnitOfWork;
  readonly slots: SlotRepository;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Hospital-only Slot publication, gated on the acting Hospital's LIVE
 * Profile status and type (pr2a-M6/N1) — never the session-time snapshot.
 * Domain invariants (N2: future `scheduledAt`, positive duration, text
 * bounds) are enforced by `createSlot` and propagate as
 * `DomainValidationError`.
 *
 * pr2a-M1: the live-status check and the Slot creation both happen INSIDE
 * `ProfileUnitOfWork.withLockedProfile(actor.accountId, ...)` — never a
 * plain pre-lock read followed later by an unguarded `slots.save`. A
 * concurrent Admin deactivation targeting the SAME Account shares this
 * port's queue/row-lock and therefore cannot commit in the gap between this
 * use case's read and its write: either the deactivation's transaction
 * commits first (this call then observes `deactivated` and is denied) or
 * this call's entire check-and-create runs first while the deactivation is
 * blocked on the same lock. Documented lock order: Slot-mutating use cases
 * take the Slot lock BEFORE nesting the Profile lock (see
 * `submitProposal`/`approveProposal`/`rejectProposal`/`closeSlot`);
 * `publishSlot` has no existing Slot row to lock, so it takes the Profile
 * lock alone. No operation in this codebase acquires the Profile lock and
 * subsequently attempts to acquire a Slot lock, so these two orders never
 * nest into each other and no deadlock cycle exists.
 */
export async function publishSlot(
  actor: Actor,
  input: PublishSlotInput,
  deps: PublishSlotDeps,
): Promise<Slot> {
  assertRole(actor, "hospital");

  return deps.profileUnitOfWork.withLockedProfile(actor.accountId, async (ctx) => {
    const activeProfile = assertActiveProfile(ctx.profile, "hospital");

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
  });
}
