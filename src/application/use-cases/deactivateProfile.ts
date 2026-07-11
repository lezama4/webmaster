import { deactivateProfile as deactivateProfileTransition, type Profile } from "@domain/profile/Profile";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

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
      const updated = deactivateProfileTransition(profile);

      await ctx.saveProfile(updated);
      await ctx.sessions.revokeAllForAccount(profile.accountId);
      return updated;
    },
  );
}
