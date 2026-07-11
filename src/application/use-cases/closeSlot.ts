import { closeSlot as closeSlotOperation, type CloseSlotOutcome } from "@domain/slot/closeSlot";
import { InvalidTransitionError, NotSlotOwnerError } from "@domain/errors";
import type { Clock } from "@domain/shared/Clock";
import { ConflictError, ForbiddenError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import { assertActiveProfile, assertOwnsSlot, assertRole } from "./shared/guards";

export interface CloseSlotInput {
  readonly slotId: string;
}

export interface CloseSlotDeps {
  readonly profiles: ProfileRepository;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly clock: Clock;
}

/**
 * Owner-Hospital-only Slot withdrawal (B2), committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` — same lock-first pattern as
 * submit/approve/reject. `domain.closeSlot` transitions the Slot to
 * `closed` AND cascade-rejects every outstanding `submitted` Proposal in
 * one atomic operation.
 */
export async function closeSlot(
  actor: Actor,
  input: CloseSlotInput,
  deps: CloseSlotDeps,
): Promise<CloseSlotOutcome> {
  assertRole(actor, "hospital");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  const activeProfile = assertActiveProfile(profile);

  return deps.matchingUnitOfWork.withLockedSlot(input.slotId, (lockedSlot, proposals) => {
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
