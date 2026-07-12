import { createProposal, type Proposal } from "@domain/proposal/Proposal";
import { ConflictError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface SubmitProposalInput {
  readonly slotId: string;
  readonly message: string;
}

export interface SubmitProposalDeps {
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly idGenerator: IdGenerator;
}

/**
 * Artist-only Proposal submission, committed exclusively through
 * `MatchingUnitOfWork.withLockedSlot` (D4/B2/M2, unified per
 * recheck-pr2a-verify-M2). The Slot row is locked FIRST; the open-Slot
 * guard and the same-Artist-duplicate guard are both re-checked against the
 * LIVE, locked Proposal set — never a pre-lock read.
 *
 * recheck-pr2a-verify-M2: the acting Artist's LIVE Profile status AND type
 * are re-checked against `actorProfile`, read by `withLockedSlot` itself
 * INSIDE the SAME transaction that also locks the Slot and persists the
 * mutation. Documented global lock order: Slot FIRST, then Account (see
 * `MatchingUnitOfWork`'s port docstring). This is safe from deadlock
 * because no operation in this codebase acquires the Account lock and
 * subsequently attempts to acquire a Slot lock — `deactivateProfile`/
 * `validateProfile`/`login` only ever lock an Account, never a Slot
 * afterward.
 */
export async function submitProposal(
  actor: Actor,
  input: SubmitProposalInput,
  deps: SubmitProposalDeps,
): Promise<Proposal> {
  assertRole(actor, "artist");

  return deps.matchingUnitOfWork.withLockedSlot(
    input.slotId,
    actor.accountId,
    async (lockedSlot, proposals, actorProfile) => {
      const activeProfile = assertActiveProfile(actorProfile, "artist");

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
    },
  );
}
