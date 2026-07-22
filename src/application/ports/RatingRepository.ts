import type { Rating } from "@domain/rating/Rating";

/**
 * The average + count aggregate for one Event's ratings (Phase 3, Block 2).
 * `averageStars` is `null` when `ratingCount` is 0 — never `0` or `NaN` —
 * so callers can distinguish "no ratings yet" from a genuine low average.
 */
export interface RatingAggregate {
  readonly averageStars: number | null;
  readonly ratingCount: number;
}

/**
 * Rating persistence port (Phase 3, Block 2). A plain repository — not a
 * locking unit-of-work — because the one-Rating-per-(event,rater) invariant
 * is enforced by a DB-level unique constraint and `upsert` is a single
 * atomic INSERT ... ON CONFLICT DO UPDATE (mirrors `EventRepository`'s
 * non-locking shape; no multi-entity cascade like `MatchingUnitOfWork`
 * needs here).
 */
export interface RatingRepository {
  /** The acting rater's own Rating for one Event, or `null` if they haven't rated it. */
  findByEventAndRater(
    eventId: string,
    raterAccountId: string,
  ): Promise<Rating | null>;
  /** Create-or-update on the (eventId, raterAccountId) unique key. */
  upsert(rating: Rating): Promise<void>;
  /** Every Rating the given Account has made — used ONLY to pre-fill that SAME Account's own star control, never exposed to anyone else. */
  listByRater(raterAccountId: string): Promise<readonly Rating[]>;
  /** Average + count for one Event — the ONLY rating data ever surfaced publicly. */
  aggregateForEvent(eventId: string): Promise<RatingAggregate>;
}
