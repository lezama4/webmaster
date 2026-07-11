import { acceptProposal, type AcceptProposalOutcome } from "@domain/slot/acceptProposal";
import { InvalidTransitionError, NotSlotOwnerError } from "@domain/errors";
import type { Clock } from "@domain/shared/Clock";
import { ConflictError, ForbiddenError, NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import { assertActiveProfile, assertOwnsSlot, assertRole } from "./shared/guards";

export interface ApproveProposalInput {
  readonly slotId: string;
  readonly proposalId: string;
}

export interface ApproveProposalDeps {
  readonly profiles: ProfileRepository;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Owner-Hospital-only Proposal approval, committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` (D4/B2, M1). Ownership, live status,
 * and Proposal/Slot linkage (M6) are re-checked against the LOCKED, live
 * data before the pure `domain.acceptProposal` cascade runs.
 */
export async function approveProposal(
  actor: Actor,
  input: ApproveProposalInput,
  deps: ApproveProposalDeps,
): Promise<AcceptProposalOutcome> {
  assertRole(actor, "hospital");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  const activeProfile = assertActiveProfile(profile);

  return deps.matchingUnitOfWork.withLockedSlot(input.slotId, (lockedSlot, proposals) => {
    assertOwnsSlot(lockedSlot.hospitalProfileId, activeProfile.id);

    const target = proposals.find((p) => p.id === input.proposalId);
    if (!target || target.slotId !== lockedSlot.id) {
      throw new NotFoundError(
        `Proposal '${input.proposalId}' does not belong to slot '${input.slotId}'`,
      );
    }

    let outcome: AcceptProposalOutcome;
    try {
      outcome = acceptProposal({
        slot: lockedSlot,
        proposals,
        proposalId: input.proposalId,
        eventId: deps.idGenerator.next(),
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
        proposals: [outcome.acceptedProposal, ...outcome.rejectedProposals],
        event: outcome.event,
      },
      result: outcome,
    };
  });
}
