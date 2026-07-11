import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type { PublicEventProjectionQuery } from "@application/ports/PublicEventProjectionQuery";

export interface ListPublishedEventsDeps {
  readonly publicEventProjectionQuery: PublicEventProjectionQuery;
}

/**
 * Public, unauthenticated Events listing (D6/M6) — depends ONLY on the
 * dedicated `PublicEventProjectionQuery` port. Filtering to `published`
 * Events and building the allow-list shape are BOTH the port's Prisma
 * implementation's responsibility (PR 2b, ADR D6/M6); this use case never
 * imports a repository or Prisma, and never receives a field it did not
 * ask for.
 */
export async function listPublishedEvents(
  deps: ListPublishedEventsDeps,
): Promise<readonly PublicEventProjection[]> {
  return deps.publicEventProjectionQuery.listPublished();
}
