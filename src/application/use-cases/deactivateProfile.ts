import { deactivateProfile as deactivateProfileTransition, type Profile } from "@domain/profile/Profile";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

// PR2 wiring handoff (auditable-profile-approval, PR1/domain-only batch):
// the domain deactivateProfile now requires an attributed ReviewInput and a
// Clock (ADR D21-D24) and returns { profile, review }. PR2 threads the REAL
// adminAccountId (actor.accountId), a real `basis` on DeactivateProfileInput,
// and deps.idGenerator/deps.clock through here, and persists the returned
// review via ctx.saveReview(...) in the same withLockedProfile transaction
// (D23). Until then this placeholder keeps the use case compiling and
// behaviourally unchanged — the review half is discarded, not persisted.
const PR2_PLACEHOLDER_REVIEW = {
  adminAccountId: "PR2-PENDING-actor.accountId",
  basis: "PR2-PENDING: basis threading lands with saveReview wiring.",
  reviewId: "PR2-PENDING-idGenerator",
};
const PR2_PLACEHOLDER_CLOCK = { now: () => new Date() };

export interface DeactivateProfileInput {
  readonly profileId: string;
}

export interface DeactivateProfileDeps {
  readonly profiles: ProfileRepository;
  readonly profileUnitOfWork: ProfileUnitOfWork;
}

/**
 * Admin-only Profile deactivation (M3): `active -> deactivated`, cascading
 * `SessionPort.revokeAllForAccount` inside the SAME
 * `ProfileUnitOfWork.withLockedProfile` transaction as the status
 * transition — a failure between the two steps leaves NO partial state
 * (neither the transition nor the revocation is observed alone).
 */
export async function deactivateProfile(
  actor: Actor,
  input: DeactivateProfileInput,
  deps: DeactivateProfileDeps,
): Promise<Profile> {
  assertRole(actor, "admin");

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

      // Propagates InvalidTransitionError as-is on a non-'active' Profile —
      // an Admin precondition violation, not a lock-race outcome (mirrors
      // validateProfile's approve/reject branches).
      // PR2-PENDING: placeholder review context — see note above imports.
      const { profile: updated } = deactivateProfileTransition(
        profile,
        PR2_PLACEHOLDER_REVIEW,
        PR2_PLACEHOLDER_CLOCK,
      );

      await ctx.saveProfile(updated);
      await ctx.sessions.revokeAllForAccount(profile.accountId);
      return updated;
    },
  );
}
