import { createProposal, type Proposal } from "@domain/proposal/Proposal";
import { ConflictError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface SubmitProposalInput {
  readonly slotId: string;
  readonly message: string;
}

export interface SubmitProposalDeps {
  readonly profiles: ProfileRepository;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly idGenerator: IdGenerator;
}

/**
 * Artist-only Proposal submission, committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` (D4/B2/M2). The Slot row is locked
 * FIRST; the open-Slot guard and the same-Artist-duplicate guard are both
 * re-checked against the LIVE, locked Proposal set — never a pre-lock read.
 */
export async function submitProposal(
  actor: Actor,
  input: SubmitProposalInput,
  deps: SubmitProposalDeps,
): Promise<Proposal> {
  assertRole(actor, "artist");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  const activeProfile = assertActiveProfile(profile);

  return deps.matchingUnitOfWork.withLockedSlot(input.slotId, (lockedSlot, proposals) => {
    if (lockedSlot.status !== "open") {
      throw new ConflictError(`Slot '${lockedSlot.id}' is not open`);
    }

    const duplicate = proposals.find(
      (p) => p.artistProfileId === activeProfile.id && p.status === "submitted",
    );
    if (duplicate) {
      throw new ConflictError(
        `Artist '${activeProfile.id}' already has an open Proposal for slot '${lockedSlot.id}'`,
      );
    }

    const proposal = createProposal({
      id: deps.idGenerator.next(),
      slotId: lockedSlot.id,
      artistProfileId: activeProfile.id,
      message: input.message,
    });

    return { mutation: { proposals: [proposal] }, result: proposal };
  });
}
