import { closeSlot as closeSlotOperation, type CloseSlotOutcome } from "@domain/slot/closeSlot";
import { InvalidTransitionError, NotSlotOwnerError } from "@domain/errors";
import type { Clock } from "@domain/shared/Clock";
import { ConflictError, ForbiddenError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertActiveProfile, assertOwnsSlot, assertRole } from "./shared/guards";

export interface CloseSlotInput {
  readonly slotId: string;
}

export interface CloseSlotDeps {
  readonly profileUnitOfWork: ProfileUnitOfWork;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly clock: Clock;
}

/**
 * Owner-Hospital-only Slot withdrawal (B2), committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` — same lock-first pattern as
 * submit/approve/reject. `domain.closeSlot` transitions the Slot to
 * `closed` AND cascade-rejects every outstanding `submitted` Proposal in
 * one atomic operation.
 *
 * pr2a-M1/N1: the acting Hospital's LIVE Profile status AND type are
 * re-checked via `ProfileUnitOfWork.withLockedProfile` FROM WITHIN the
 * Slot-lock callback (documented lock order: Slot first, Profile nested —
 * see `submitProposal` for the deadlock-safety rationale).
 */
export async function closeSlot(
  actor: Actor,
  input: CloseSlotInput,
  deps: CloseSlotDeps,
): Promise<CloseSlotOutcome> {
  assertRole(actor, "hospital");

  return deps.matchingUnitOfWork.withLockedSlot(input.slotId, async (lockedSlot, proposals) => {
    const activeProfile = await deps.profileUnitOfWork.withLockedProfile(
      actor.accountId,
      (ctx) => assertActiveProfile(ctx.profile, "hospital"),
    );

    assertOwnsSlot(lockedSlot.hospitalProfileId, activeProfile.id);

    let outcome: CloseSlotOutcome;
    try {
      outcome = closeSlotOperation({
        slot: lockedSlot,
        proposals,
        clock: deps.clock,
        actingHospitalProfileId: activeProfile.id,
      });
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new ConflictError(error.message);
      }
      if (error instanceof NotSlotOwnerError) {
        throw new ForbiddenError(error.message);
      }
      throw error;
    }

    return {
      mutation: {
        slot: outcome.slot,
        proposals: outcome.rejectedProposals,
      },
      result: outcome,
    };
  });
}
