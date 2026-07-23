import type { CentreType } from "@domain/profile/Profile";

/**
 * The public, unauthenticated centre directory projection — a second,
 * independent public allow-list (ADR D9), separate from
 * `PublicEventProjection` (ADR D6). "Hospital" in this file's names
 * (`PublicHospitalProjection`, `listPublicHospitals`, `/api/hospitals`) now
 * means "any of the six `CentreType` kinds", not literally a hospital — the
 * rename is deliberately DEFERRED (ADR D19, design "Rename deferral 3b"):
 * `/api/hospitals` and the `/encuentra-tu-momento` slug are shipped surfaces
 * and must not break.
 *
 * Exposes EXACTLY `name`, `city`, `postalCode`, `latitude`, `longitude`,
 * `centreType`. `addressLine`, email, any account or internal database id,
 * the internal `type` (ProfileType/role) field, and every other `Profile`
 * field MUST NOT appear here, in any form (D14).
 *
 * `centreType` (ADR D19) is the COARSE public category — one of the six
 * known `CentreType` values (e.g. `"nursing_home"`, `"day_centre"`). It is
 * NOT the same axis as `type`: `type` is the internal ProfileType/role
 * field (always `"centre"` for every row on this surface) and stays
 * forbidden below even though `centreType` is newly admitted — they are
 * different fields on different axes (D16/D19), and only one of them is
 * public.
 *
 * Non-correlation invariant (ADR D10): this projection MUST NOT carry any
 * Slot/Proposal/Event-derived field — no counts, no `nextEventAt`, no
 * `hasUpcomingEvents`, no activity titles. If you are here because a test
 * failed after you added a field, you are changing ADR D10. Read it before
 * editing this list — see `tests/unit/application/nonCorrelation.test.ts`.
 *
 * `Profile.city`, `postalCode`, `latitude`, `longitude` are ALL nullable in
 * the schema — a centre may register without them. The DTO mirrors that
 * honestly rather than requiring non-null values, which would silently hide
 * a participating centre from the directory because of an incomplete admin
 * record (D9).
 */
export interface PublicHospitalProjection {
  readonly name: string;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly centreType: CentreType;
}

/** Named fields that must NEVER appear on the public hospital projection (D9/D10). */
type ForbiddenPublicHospitalKey =
  | "addressLine"
  | "id"
  | "accountId"
  | "email"
  | "status"
  | "type"
  | "reviewRequestedAt"
  | "createdAt"
  | "updatedAt"
  | "slots"
  | "slotId"
  | "proposalId"
  | "eventId"
  | "upcomingEventCount"
  | "nextEventAt"
  | "hasUpcomingEvents";

type AssertNever<T extends never> = T;

/**
 * Compile error if `PublicHospitalProjection` ever gains one of the named
 * forbidden keys above (D14). Deliberately unused at runtime — its entire
 * job is to fail `tsc` on the line directly below an interface edit that
 * introduces `addressLine` (or any other forbidden key), before any test
 * runs, before commit.
 */
export type _NoForbiddenFields = AssertNever<
  Extract<keyof PublicHospitalProjection, ForbiddenPublicHospitalKey>
>;
