import type { Audience } from "@domain/slot/Slot";
import type { PublicEventProjection } from "../dto/PublicEventProjection";

/**
 * Optional, PUBLIC-SAFE filters for the events listing. Every axis filters on
 * a value ALREADY in the public projection (`audience`, `scheduledAt`, and —
 * since the D10 events-show-centre revision — the hosting centre's public
 * `name`), so filtering exposes nothing the listing does not already show.
 *
 * The `centre` filter matches the centre's PUBLIC name (never an id or the
 * ward/room `location`). It navigates the event→centre link that D10 was
 * deliberately relaxed to make public; the hospital→event direction (the
 * public directory revealing a centre's events) is untouched — this filter
 * lives only on the events surface.
 */
export interface PublicEventFilters {
  /** Restrict to a single hospital-set age band. */
  readonly audience?: Audience;
  /** Inclusive lower bound on the event's scheduled time. */
  readonly from?: Date;
  /** Inclusive upper bound on the event's scheduled time. */
  readonly to?: Date;
  /** Restrict to events hosted by the centre with this exact PUBLIC name. */
  readonly centre?: string;
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
