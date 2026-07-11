import type { AccountRole } from "@domain/account/Account";
import type { ProfileStatus } from "@domain/profile/Profile";

/**
 * The authenticated caller of a use case (N1, pr2-review).
 *
 * Sourced from the resolved, live session — NEVER from client-supplied
 * input. `profileId`/`profileStatus` are session-time snapshots for
 * convenience only: every mutating use case MUST re-check the live Profile
 * status against the repository (M6) — a Profile that turned `rejected` or
 * `deactivated` after session issuance is denied regardless of snapshot.
 */
export interface Actor {
  readonly accountId: string;
  readonly role: AccountRole;
  readonly profileId?: string;
  /** Snapshot only — untrusted; use cases re-check live status (M6). */
  readonly profileStatus?: ProfileStatus;
}
