import {
  approveProfile,
  rejectProfile,
  type Profile,
  type ReviewInput,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";
import { DomainValidationError } from "@domain/errors";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

export interface ValidateProfileInput {
  readonly profileId: string;
  readonly decision: "approve" | "reject";
  /**
   * The admin's verification basis (ADR D21-D24): required, non-blank,
   * bounded — validated authoritatively inside the domain transition, never
   * only here. Route-level parsing supplies this from the request body
   * (PR4); the use case does not trust it beyond passing it through.
   */
  readonly basis: string;
}

export interface ValidateProfileDeps {
  readonly profiles: ProfileRepository;
  readonly profileUnitOfWork: ProfileUnitOfWork;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Admin-only validation decision on a `pending` Profile (also covers the
 * `rejected -> pending` re-registration queue — M2, task 5.12: the SAME
 * queue, no separate UI/use-case path). Each decision requires and records
 * an attributed `ProfileReview` (ADR D21-D24): the acting admin's identity
 * comes from `actor.accountId` — the resolved, live-session identity, NEVER
 * a client-supplied value (ADR D23) — and the review is persisted via
 * `ctx.saveReview` INSIDE the SAME `ProfileUnitOfWork.withLockedProfile`
 * transaction as the status transition and, on reject, the session
 * revocation — a failure between any of these steps leaves NO partial state
 * (D23 atomicity).
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

      // D23: the acting admin's identity is ALWAYS actor.accountId — the
      // resolved, live-session identity — never any input-supplied field.
      const reviewInput: ReviewInput = {
        adminAccountId: actor.accountId,
        basis: input.basis,
        reviewId: deps.idGenerator.next(),
      };

      const { profile: updated, review } =
        input.decision === "approve"
          ? approveProfile(profile, reviewInput, deps.clock)
          : rejectProfile(profile, reviewInput, deps.clock);

      await ctx.saveProfile(updated);
      await ctx.saveReview(review);

      if (input.decision === "reject") {
        await ctx.sessions.revokeAllForAccount(profile.accountId);
      }

      return updated;
    },
  );
}
