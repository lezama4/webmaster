import type { Audience } from "@domain/slot/Slot";
import type { PublicEventProjection } from "../dto/PublicEventProjection";

/**
 * Optional, PUBLIC-SAFE filters for the events listing. Both axes are already
 * part of the public projection (`audience`, `scheduledAt`), so filtering by
 * them exposes nothing new and does NOT touch the D10 non-correlation
 * invariant — there is deliberately NO centre/location filter, because the
 * public projection carries no centre identity to filter on.
 */
export interface PublicEventFilters {
  /** Restrict to a single hospital-set age band. */
  readonly audience?: Audience;
  /** Inclusive lower bound on the event's scheduled time. */
  readonly from?: Date;
  /** Inclusive upper bound on the event's scheduled time. */
  readonly to?: Date;
}

/**
 * Dedicated public read-model port (M6, pr2-review, ADR D6). Its Prisma
 * implementation is the ONLY place permitted to join Event → Slot →
 * Proposal → (Artist) Profile, and it returns the finished, already
 * allow-listed shape — never a Prisma model, never a partial entity.
 * `listPublishedEvents` depends only on this port.
 */
export interface PublicEventProjectionQuery {
  /**
   * Only Events in `published` status, already projected to the allow-list.
   * Optional public-safe filters narrow the result set (date range, audience).
   */
  listPublished(
    filters?: PublicEventFilters,
  ): Promise<readonly PublicEventProjection[]>;
}
