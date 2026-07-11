import { rejectProposal as rejectProposalTransition, type Proposal } from "@domain/proposal/Proposal";
import { ConflictError, NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import { assertActiveProfile, assertOwnsSlot, assertRole } from "./shared/guards";

export interface RejectProposalInput {
  readonly slotId: string;
  readonly proposalId: string;
}

export interface RejectProposalDeps {
  readonly profiles: ProfileRepository;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
}

/**
 * Owner-Hospital-only manual Proposal rejection (M1) — NOT exempt from the
 * lock-first protocol: committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot`, re-loads the live Proposal set inside
 * the lock, and guards the transition — a 0-row result (already terminal,
 * or a concurrent approve/close on the same Slot committed first) aborts
 * with `ConflictError`, never a silent no-op.
 */
export async function rejectProposal(
  actor: Actor,
  input: RejectProposalInput,
  deps: RejectProposalDeps,
): Promise<Proposal> {
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

    if (target.status !== "submitted") {
      throw new ConflictError(
        `Proposal '${target.id}' is already '${target.status}' — cannot reject`,
      );
    }

    const rejected = rejectProposalTransition(target);
    return { mutation: { proposals: [rejected] }, result: rejected };
  });
}
