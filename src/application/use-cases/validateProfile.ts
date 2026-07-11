import { approveProfile, rejectProfile, type Profile } from "@domain/profile/Profile";
import { NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import { assertRole } from "./shared/guards";

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

      const updated =
        input.decision === "approve"
          ? approveProfile(profile)
          : rejectProfile(profile);

      await ctx.saveProfile(updated);

      if (input.decision === "reject") {
        await ctx.sessions.revokeAllForAccount(profile.accountId);
      }

      return updated;
    },
  );
}
