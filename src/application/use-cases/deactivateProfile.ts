import {
  deactivateProfile as deactivateProfileTransition,
  type Profile,
  type ReviewInput,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

export interface DeactivateProfileInput {
  readonly profileId: string;
  /**
   * The admin's verification basis (ADR D21-D24) — e.g. "why was this
   * centre pulled". Required, non-blank, bounded; validated authoritatively
   * inside the domain transition, never only here.
   */
  readonly basis: string;
}

export interface DeactivateProfileDeps {
  readonly profiles: ProfileRepository;
  readonly profileUnitOfWork: ProfileUnitOfWork;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Admin-only Profile deactivation (M3): `active -> deactivated`, cascading
 * `SessionPort.revokeAllForAccount` inside the SAME
 * `ProfileUnitOfWork.withLockedProfile` transaction as the status
 * transition and the attributed `ProfileReview` write (ADR D21-D24) — a
 * failure between any of these steps leaves NO partial state (neither the
 * transition, the review, nor the revocation is observed alone, D23). The
 * acting admin's identity is `actor.accountId` — the resolved, live-session
 * identity — never a client-supplied value.
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

      const reviewInput: ReviewInput = {
        adminAccountId: actor.accountId,
        basis: input.basis,
        reviewId: deps.idGenerator.next(),
      };

      // Propagates InvalidTransitionError as-is on a non-'active' Profile —
      // an Admin precondition violation, not a lock-race outcome (mirrors
      // validateProfile's approve/reject branches). A blank/over-long basis
      // throws BEFORE the status flip (domain-enforced, D24).
      const { profile: updated, review } = deactivateProfileTransition(
        profile,
        reviewInput,
        deps.clock,
      );

      await ctx.saveProfile(updated);
      await ctx.saveReview(review);
      await ctx.sessions.revokeAllForAccount(profile.accountId);
      return updated;
    },
  );
}
