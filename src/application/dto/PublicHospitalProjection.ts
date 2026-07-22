/**
 * The public, unauthenticated hospital directory projection — a second,
 * independent public allow-list (ADR D9), separate from
 * `PublicEventProjection` (ADR D6). Exposes EXACTLY `name`, `city`,
 * `postalCode`, `latitude`, `longitude`. `addressLine`, email, any account
 * or internal database id, and every other `Profile` field MUST NOT appear
 * here, in any form (D14).
 *
 * Non-correlation invariant (ADR D10): this projection MUST NOT carry any
 * Slot/Proposal/Event-derived field — no counts, no `nextEventAt`, no
 * `hasUpcomingEvents`, no activity titles. If you are here because a test
 * failed after you added a field, you are changing ADR D10. Read it before
 * editing this list — see `tests/unit/application/nonCorrelation.test.ts`.
 *
 * `Profile.city`, `postalCode`, `latitude`, `longitude` are ALL nullable in
 * the schema — a hospital may register without them. The DTO mirrors that
 * honestly rather than requiring non-null values, which would silently hide
 * a participating hospital from the directory because of an incomplete
 * admin record (D9).
 */
export interface PublicHospitalProjection {
  readonly name: string;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
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
