import type { Audience } from "@domain/slot/Slot";

/**
 * The public, unauthenticated Event projection — an explicit ALLOW-LIST
 * (ADR D6, revised D10). These fields are the ONLY data the public endpoint
 * may expose.
 *
 * D10 revision: an event now names its HOSTING CENTRE (`centreName`, and
 * `centreCity` when set). Those two fields are already public — the centre
 * appears in the public directory — and a family cannot find events for their
 * relative's centre without them. The privacy line therefore moved: it is
 * about the INDIVIDUAL and the exact place, not the institution. Forbidden,
 * always: the Slot `location` (ward/room — the sensitive "where within"), the
 * centre's postal code / street address, the accepted Proposal's `message`,
 * any email, and any internal database identifier OTHER than the Event's own
 * id (see `id` below, Phase 3/Block 2).
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
   * The Slot's optional max attendee capacity ("aforo máximo"), or `null` when
   * the centre did not set one. A logistics figure about the activity, not
   * about any individual — safe to show publicly on the Events page.
   */
  readonly capacity: number | null;
  /**
   * The hosting centre's public name (Profile.name) — a public institution,
   * shown so a family can find events at their relative's centre (D10
   * revision). NEVER the internal ward/room (`Slot.location` stays private).
   */
  readonly centreName: string;
  /**
   * The hosting centre's public city (Profile.city), or `null` when the centre
   * has not set one. The postal code and street address are NOT exposed.
   */
  readonly centreCity: string | null;
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
