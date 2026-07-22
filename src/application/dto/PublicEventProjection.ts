import type { Audience } from "@domain/slot/Slot";

/**
 * The public, unauthenticated Event projection — an explicit ALLOW-LIST
 * (ADR D6). These fields are the ONLY data the public endpoint may
 * expose. Forbidden, always: Slot `location` (ward/room), the accepted
 * Proposal's `message`, any email, and any internal database identifier
 * OTHER than the Event's own id (see `id` below, Phase 3/Block 2).
 */
export interface PublicEventProjection {
  /**
   * The Event's OWN id (Phase 3, Block 2) — needed so a client can
   * `POST /api/events/[id]/rate`. Deliberately NOT the Slot id, Proposal
   * id, artist Profile id, or any Account id — those stay forbidden, exactly
   * as before this field was added.
   */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  /** The accepted Proposal's Artist public display name (Profile.name). */
  readonly artistName: string;
  /** The Slot's hospital-set age band (Phase 1 — audience). */
  readonly audience: Audience;
  /**
   * The Event's average star rating (Phase 3, Block 2), rounded to 1
   * decimal, or `null` when no one has rated it yet — never `0`, so
   * "unrated" and "rated low" are distinguishable. Individual ratings and
   * rater identity are NEVER part of this projection.
   */
  readonly averageStars: number | null;
  /** How many ratings make up `averageStars` (Phase 3, Block 2). */
  readonly ratingCount: number;
}
