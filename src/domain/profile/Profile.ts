import { InvalidTransitionError } from "../errors";
import type { Clock } from "../shared/Clock";

export type ProfileType = "hospital" | "artist";

export type ProfileStatus = "pending" | "active" | "rejected" | "deactivated";

/**
 * Hospital/Artist profile awaiting or holding Admin validation.
 * State machine: pending -> active | rejected;
 *                active -> deactivated (Admin, M3);
 *                rejected -> pending (re-registration, same profile, M2).
 */
export interface Profile {
  readonly id: string;
  readonly accountId: string;
  readonly type: ProfileType;
  readonly name: string;
  readonly status: ProfileStatus;
  /** Set when a re-registration re-enters review (auditable, M2). */
  readonly reviewRequestedAt?: Date;
}

function assertStatus(
  profile: Profile,
  expected: ProfileStatus,
  transition: string,
): void {
  if (profile.status !== expected) {
    throw new InvalidTransitionError(
      `Cannot ${transition} a profile in '${profile.status}' state (requires '${expected}')`,
    );
  }
}

/** Admin approval: pending -> active. */
export function approveProfile(profile: Profile): Profile {
  assertStatus(profile, "pending", "approve");
  return { ...profile, status: "active" };
}

/** Admin rejection: pending -> rejected. */
export function rejectProfile(profile: Profile): Profile {
  assertStatus(profile, "pending", "reject");
  return { ...profile, status: "rejected" };
}

/** Admin deactivation (M3): active -> deactivated. Terminal in Block 1. */
export function deactivateProfile(profile: Profile): Profile {
  assertStatus(profile, "active", "deactivate");
  return { ...profile, status: "deactivated" };
}

/**
 * Re-registration (M2): rejected -> pending, reactivating the SAME profile
 * as a new, timestamped review request — never a second Profile row.
 */
export function reactivateProfile(profile: Profile, clock: Clock): Profile {
  assertStatus(profile, "rejected", "reactivate");
  return { ...profile, status: "pending", reviewRequestedAt: clock.now() };
}
