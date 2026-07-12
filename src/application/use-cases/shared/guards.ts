import type { AccountRole } from "@domain/account/Account";
import type { Profile, ProfileType } from "@domain/profile/Profile";
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
 *
 * `expectedType` (pr2a-N1): defense-in-depth against corrupted/imported
 * data where `Account.role` and the live `Profile.type` have drifted apart
 * (normal registration prevents this, but this gate does not trust that
 * invariant blindly) — e.g. a `hospital`-role Account holding an active
 * `artist` Profile must still be denied a Hospital-only action.
 */
export function assertActiveProfile(
  profile: Profile | null,
  expectedType?: ProfileType,
): Profile {
  if (!profile || profile.status !== "active") {
    throw new ForbiddenError("Actor's profile is not active");
  }
  if (expectedType && profile.type !== expectedType) {
    throw new ForbiddenError(
      `Actor's profile type '${profile.type}' does not match the required type '${expectedType}'`,
    );
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
