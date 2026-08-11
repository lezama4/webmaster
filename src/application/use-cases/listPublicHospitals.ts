import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import type { PublicHospitalDirectoryQuery } from "@application/ports/PublicHospitalDirectoryQuery";

export interface ListPublicHospitalsDeps {
  readonly publicHospitalDirectoryQuery: PublicHospitalDirectoryQuery;
}

/**
 * Public, unauthenticated hospital directory listing (D9) — depends ONLY
 * on the dedicated `PublicHospitalDirectoryQuery` port. Filtering to
 * ACTIVE Hospital profiles is the port's Prisma implementation's
 * responsibility (Phase 3); this use case never imports a repository or
 * Prisma.
 *
 * pr2a-B1 (defense-in-depth), carried forward from `listPublishedEvents`: a
 * TypeScript interface does NOT strip extra runtime properties — a hostile
 * or accidentally-widened adapter could return an object typed as
 * `PublicHospitalProjection` that also carries `addressLine`, an email, an
 * internal id, or event-derived fields, and JSON serialization would expose
 * them regardless of the static type. This use case therefore does NOT
 * return the port's object unchanged: it rebuilds a FRESH DTO field-by-field
 * via `toPublicHospitalProjection`, discarding every other property the
 * port might have supplied. The Prisma adapter does the same at its own
 * boundary (belt-and-braces, not the sole allow-list boundary).
 *
 * No `Actor`, no authorization — this surface is anonymous by design,
 * exactly like `listPublishedEvents` (D9).
 */
export async function listPublicHospitals(
  deps: ListPublicHospitalsDeps,
): Promise<readonly PublicHospitalProjection[]> {
  const records = await deps.publicHospitalDirectoryQuery.listActive();
  return records.map(toPublicHospitalProjection);
}

function toPublicHospitalProjection(
  record: PublicHospitalProjection,
): PublicHospitalProjection {
  return {
    name: record.name,
    city: record.city,
    postalCode: record.postalCode,
    latitude: record.latitude,
    longitude: record.longitude,
    centreType: record.centreType,
    upcomingEventCount: record.upcomingEventCount,
  };
}
