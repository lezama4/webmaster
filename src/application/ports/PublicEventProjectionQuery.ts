import type { PublicEventProjection } from "../dto/PublicEventProjection";

/**
 * Dedicated public read-model port (M6, pr2-review, ADR D6). Its Prisma
 * implementation is the ONLY place permitted to join Event → Slot →
 * Proposal → (Artist) Profile, and it returns the finished, already
 * allow-listed shape — never a Prisma model, never a partial entity.
 * `listPublishedEvents` depends only on this port.
 */
export interface PublicEventProjectionQuery {
  /** Only Events in `published` status, already projected to the allow-list. */
  listPublished(): Promise<readonly PublicEventProjection[]>;
}
