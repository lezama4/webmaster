import { approveProfile, rejectProfile, type Profile } from "@domain/profile/Profile";
import { DomainValidationError } from "@domain/errors";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

// PR2 wiring handoff (auditable-profile-approval, PR1/domain-only batch):
// approveProfile/rejectProfile now require an attributed ReviewInput and a
// Clock (ADR D21-D24), and return { profile, review } instead of a bare
// Profile. PR2 threads the REAL adminAccountId (actor.accountId), a real
// `basis` on ValidateProfileInput, and deps.idGenerator/deps.clock through
// here, and persists the returned review via ctx.saveReview(...) in the
// same withLockedProfile transaction (D23). Until then this placeholder
// keeps the use case compiling and behaviourally unchanged — the review
// half of the result is discarded, not persisted, exactly as before this
// change (no ProfileReview row is written by this batch).
const PR2_PLACEHOLDER_REVIEW = {
  adminAccountId: "PR2-PENDING-actor.accountId",
  basis: "PR2-PENDING: basis threading lands with saveReview wiring.",
  reviewId: "PR2-PENDING-idGenerator",
};
const PR2_PLACEHOLDER_CLOCK = { now: () => new Date() };

export interface ValidateProfileInput {
  readonly profileId: string;
  readonly decision: "approve" | "reject";
}

export interface ValidateProfileDeps {
  readonly profiles: ProfileRepository;
  readonly profileUnitOfWork: ProfileUnitOfWork;
}

/**
 * Admin-only validation decision on a `pending` Profile (also covers the
 * `rejected -> pending` re-registration queue — M2, task 5.12: the SAME
 * queue, no separate UI/use-case path). The reject branch revokes every
 * live session for the Profile's Account, atomically with the status
 * transition, via `ProfileUnitOfWork.withLockedProfile` (D7/M3) — a failure
 * between the two steps leaves no partial state.
 */
export async function validateProfile(
  actor: Actor,
  input: ValidateProfileInput,
  deps: ValidateProfileDeps,
): Promise<Profile> {
  assertRole(actor, "admin");

  // pr2a-N2: fail CLOSED on any decision other than the two known values.
  // Route-level validation should prevent this before it ever reaches here,
  // but a malformed/unvalidated `decision` must raise a validation error,
  // never silently fall through to the (irreversible) reject branch.
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new DomainValidationError(
      `Invalid Profile validation decision '${String(input.decision)}'`,
    );
  }

  const existing = await deps.profiles.findById(input.profileId);
  if (!existing) {
    throw new NotFoundError(`Profile '${input.profileId}' does not exist`);
  }

  return deps.profileUnitOfWork.withLockedProfile(
    existing.accountId,
    async (ctx) => {
      const profile = ctx.profile;
      if (!profile) {
        throw new NotFoundError(`Profile '${input.profileId}' does not exist`);
      }

      // PR2-PENDING: placeholder review context — see note above imports.
      const { profile: updated } =
        input.decision === "approve"
          ? approveProfile(profile, PR2_PLACEHOLDER_REVIEW, PR2_PLACEHOLDER_CLOCK)
          : rejectProfile(profile, PR2_PLACEHOLDER_REVIEW, PR2_PLACEHOLDER_CLOCK);

      await ctx.saveProfile(updated);

      if (input.decision === "reject") {
        await ctx.sessions.revokeAllForAccount(profile.accountId);
      }

      return updated;
    },
  );
}
