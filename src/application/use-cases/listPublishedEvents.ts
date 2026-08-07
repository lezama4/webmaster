import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type {
  PublicEventFilters,
  PublicEventProjectionQuery,
} from "@application/ports/PublicEventProjectionQuery";

export interface ListPublishedEventsDeps {
  readonly publicEventProjectionQuery: PublicEventProjectionQuery;
}

/**
 * Public, unauthenticated Events listing (D6/M6) — depends ONLY on the
 * dedicated `PublicEventProjectionQuery` port. Filtering to `published`
 * Events is the port's Prisma implementation's responsibility (PR 2b, ADR
 * D6/M6); this use case never imports a repository or Prisma.
 *
 * pr2a-B1 (defense-in-depth): a TypeScript interface does NOT strip extra
 * runtime properties — a hostile or accidentally-widened adapter could
 * return an object typed as `PublicEventProjection` that also carries
 * `location`, `message`, an email, or an internal id, and JSON
 * serialization would expose them regardless of the static type. This use
 * case therefore does NOT return the port's object unchanged: it rebuilds a
 * FRESH DTO field-by-field via `toPublicEventProjection`, discarding every
 * other property the port might have supplied. The Prisma adapter already
 * does the same at its own boundary (belt-and-braces, not the sole
 * allow-list boundary — pr2a-B1 OQ3).
 */
export async function listPublishedEvents(
  deps: ListPublishedEventsDeps,
  filters?: PublicEventFilters,
): Promise<readonly PublicEventProjection[]> {
  const records = await deps.publicEventProjectionQuery.listPublished(filters);
  return records.map(toPublicEventProjection);
}

function toPublicEventProjection(record: PublicEventProjection): PublicEventProjection {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    scheduledAt: record.scheduledAt,
    durationMinutes: record.durationMinutes,
    artistName: record.artistName,
    audience: record.audience,
    centreName: record.centreName,
    centreCity: record.centreCity,
    averageStars: record.averageStars,
    ratingCount: record.ratingCount,
  };
}
