/**
 * Artist-authenticated, internal-facing Slot listing item (N2) — richer
 * than the public `PublicEventProjection` (D6): includes exact `location`
 * and the owning Hospital's public name.
 */
export interface OpenSlotListingItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly hospitalName: string;
}

/**
 * Dedicated listing read-model port (pr2a-N3) — replaces the previous N+1
 * per-Slot Profile lookup inside `listOpenSlots`. The adapter joins Slot ->
 * (owning Hospital) Profile in ONE query and returns the finished,
 * already-joined shape. It MUST fail fast (reject) when a Slot's owning
 * Hospital Profile relation is broken or missing — never silently
 * substitute an empty/placeholder name, which would hide a data-integrity
 * problem behind misleading content.
 */
export interface OpenSlotListingQuery {
  /** Every `open` Slot with `scheduledAt` strictly after `now`. */
  listOpenUpcoming(now: Date): Promise<readonly OpenSlotListingItem[]>;
}
