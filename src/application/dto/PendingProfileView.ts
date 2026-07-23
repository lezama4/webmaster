import type { CentreType } from "@domain/profile/Profile";

/**
 * Admin pending-profile queue item (5.3/5.12) — an explicit ALLOW-LIST,
 * mirroring the D6 discipline `PublicEventProjection` establishes: only the
 * fields the admin queue needs to render and act on (`profileId` is what the
 * approve/reject routes key on). Forbidden, always: password hashes, the
 * owning Account's id/email, or any other internal detail not needed here.
 */
export interface PendingProfileView {
  readonly profileId: string;
  readonly type: "centre" | "artist";
  /**
   * The kind of care centre (ADR D16/D18) — present if and only if `type
   * === "centre"`, always absent for `type === "artist"`. This surface is
   * authenticated/authorized (admin-only), unlike the public directory, so
   * it MAY carry `centreType` freely; it lets the admin queue show the
   * specific kind (e.g. "Residencia de mayores") instead of a flat "Centro".
   */
  readonly centreType?: CentreType;
  readonly displayName: string;
  /**
   * When this Profile most recently entered review — `reviewRequestedAt`
   * for a re-registration (`rejected -> pending`, M2), or the Profile's
   * original creation time for a first-time submission. Populated by the
   * query adapter; used to order the queue oldest-first (5.12).
   */
  readonly requestedAt: Date;
}
