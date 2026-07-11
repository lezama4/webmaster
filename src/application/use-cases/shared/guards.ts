import type { AccountRole } from "@domain/account/Account";
import type { Profile } from "@domain/profile/Profile";
import { ForbiddenError } from "@application/errors";
import type { Actor } from "@application/Actor";

/**
 * Role gate (N1). Every mutating use case re-asserts the acting Account's
 * role against the live `Actor` — never trusts a caller-provided role.
 */
export function assertRole(actor: Actor, ...allowed: readonly AccountRole[]): void {
  if (!allowed.includes(actor.role)) {
    throw new ForbiddenError(
      `Actor role '${actor.role}' is not permitted to perform this action`,
    );
  }
}

/**
 * Live-status gate (M6): denies unless the Profile, re-read from the
 * repository at call time, is 'active' — regardless of any session-time
 * snapshot on `Actor`. A Profile that turned `rejected`/`deactivated` after
 * session issuance MUST fail here, not rely on `actor.profileStatus`.
 */
export function assertActiveProfile(profile: Profile | null): Profile {
  if (!profile || profile.status !== "active") {
    throw new ForbiddenError("Actor's profile is not active");
  }
  return profile;
}

/** Ownership gate (M2/M6): only the owning Hospital profile decides on its Slot. */
export function assertOwnsSlot(hospitalProfileId: string, actingProfileId: string): void {
  if (hospitalProfileId !== actingProfileId) {
    throw new ForbiddenError(
      `Profile '${actingProfileId}' does not own this Slot`,
    );
  }
}
