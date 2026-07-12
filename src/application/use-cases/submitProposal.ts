import { createProposal, type Proposal } from "@domain/proposal/Proposal";
import { ConflictError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface SubmitProposalInput {
  readonly slotId: string;
  readonly message: string;
}

export interface SubmitProposalDeps {
  readonly profileUnitOfWork: ProfileUnitOfWork;
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly idGenerator: IdGenerator;
}

/**
 * Artist-only Proposal submission, committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` (D4/B2/M2). The Slot row is locked
 * FIRST; the open-Slot guard and the same-Artist-duplicate guard are both
 * re-checked against the LIVE, locked Proposal set — never a pre-lock read.
 *
 * pr2a-M1/N1: the acting Artist's LIVE Profile status AND type are
 * re-checked via `ProfileUnitOfWork.withLockedProfile` FROM WITHIN the
 * Slot-lock callback — never before the Slot lock is taken. Documented lock
 * order: Slot lock first, Profile lock nested inside it. This is safe from
 * deadlock because no operation in this codebase acquires the Profile lock
 * and subsequently attempts to acquire a Slot lock (Admin's
 * deactivate/validate operations only ever lock a Profile).
 */
export async function submitProposal(
  actor: Actor,
  input: SubmitProposalInput,
  deps: SubmitProposalDeps,
): Promise<Proposal> {
  assertRole(actor, "artist");

  return deps.matchingUnitOfWork.withLockedSlot(input.slotId, async (lockedSlot, proposals) => {
    const activeProfile = await deps.profileUnitOfWork.withLockedProfile(
      actor.accountId,
      (ctx) => assertActiveProfile(ctx.profile, "artist"),
    );

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
