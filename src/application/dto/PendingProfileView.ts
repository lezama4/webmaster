/**
 * Admin pending-profile queue item (5.3/5.12) — an explicit ALLOW-LIST,
 * mirroring the D6 discipline `PublicEventProjection` establishes: only the
 * fields the admin queue needs to render and act on (`profileId` is what the
 * approve/reject routes key on). Forbidden, always: password hashes, the
 * owning Account's id/email, or any other internal detail not needed here.
 */
export interface PendingProfileView {
  readonly profileId: string;
  readonly type: "hospital" | "artist";
  readonly displayName: string;
  /**
   * When this Profile most recently entered review — `reviewRequestedAt`
   * for a re-registration (`rejected -> pending`, M2), or the Profile's
   * original creation time for a first-time submission. Populated by the
   * query adapter; used to order the queue oldest-first (5.12).
   */
  readonly requestedAt: Date;
}
