import type { CentreType } from "@domain/profile/Profile";

/**
 * Admin active-profile listing item (auditable-profile-approval, PR4/5.6) —
 * an explicit ALLOW-LIST, mirroring `PendingProfileView`'s D6 discipline:
 * only the fields the admin surface needs to render an ACTIVE profile and
 * offer a deactivate control (`profileId` is what the deactivate route keys
 * on). Forbidden, always: password hashes, the owning Account's id/email, or
 * any other internal detail not needed here.
 *
 * Deliberately minimal (no `requestedAt`/review-history field) — this is the
 * smallest read shape needed to close the "no deactivate UI exists" scope
 * gap (tasks.md Phase 5, 5.6). A richer active-profile management surface
 * (search, review history, pagination) is explicitly out of this change's
 * scope.
 */
export interface ActiveProfileView {
  readonly profileId: string;
  readonly type: "centre" | "artist";
  /** Present if and only if `type === "centre"` (ADR D16/D18), mirrors `PendingProfileView`. */
  readonly centreType?: CentreType;
  readonly displayName: string;
}
