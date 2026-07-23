import { createSlot, type Audience, type Slot } from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface PublishSlotInput {
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly audience: Audience;
}

export interface PublishSlotDeps {
  readonly profileUnitOfWork: ProfileUnitOfWork;
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
 * The live-status check and Slot persistence share ONE
 * `ProfileUnitOfWork.withLockedProfile(actor.accountId, ...)` transaction.
 * `ctx.slots` is transaction-scoped, so an Admin deactivation targeting the
 * same Account cannot commit after authorization but before the Slot write:
 * either deactivation commits first and this use case observes `deactivated`,
 * or publication commits first while deactivation waits on the Account lock.
 * `publishSlot` has no pre-existing Slot to lock, so it uses the Account lock
 * alone and never creates a reverse Account-then-Slot lock cycle.
 */
export async function publishSlot(
  actor: Actor,
  input: PublishSlotInput,
  deps: PublishSlotDeps,
): Promise<Slot> {
  assertRole(actor, "centre");

  return deps.profileUnitOfWork.withLockedProfile(actor.accountId, async (ctx) => {
    const activeProfile = assertActiveProfile(ctx.profile, "centre");

    const slot = createSlot(
      {
        id: deps.idGenerator.next(),
        hospitalProfileId: activeProfile.id,
        title: input.title,
        description: input.description,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        location: input.location,
        audience: input.audience,
      },
      deps.clock,
    );

    await ctx.slots.save(slot);
    return slot;
  });
}
