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
 * D10 SECOND REVISION (`centre-event-counts`) — the centre→event direction is
 * now deliberately open, as the event→centre direction already was:
 * `upcomingEventCount` is admitted, an AGGREGATE of how many published,
 * still-upcoming events the centre hosts. This adds no information that was
 * not already public: since the events surface names its hosting centre and
 * offers a centre filter, any visitor could already obtain this exact number
 * from `/events?centre=<name>`. Keeping the directory silent about it made the
 * two surfaces incoherent without protecting anything.
 *
 * What stays forbidden here is unchanged and is where the privacy line sits:
 * NO event titles, dates, `nextEventAt`, or any per-event detail — only the
 * count — and never the Slot's ward/room `location`, a Proposal, an email, or
 * any internal id. If you are here because a test failed after you added a
 * field, you are changing ADR D10 again. Read it before editing this list —
 * see `tests/unit/application/nonCorrelation.test.ts`.
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
  /**
   * How many published events the centre still has ahead of it (D10 second
   * revision). An aggregate only — never a title, a date or any per-event
   * detail. `0` is a legitimate value and means the centre has registered but
   * has nothing scheduled; the UI must not link such a card to a filtered
   * events list, which would land on an empty result.
   */
  readonly upcomingEventCount: number;
}

/**
 * Named fields that must NEVER appear on the public hospital projection
 * (D9/D10). `reviewBasis`, `adminAccountId`, `reviewedBy`, `reviewedAt`,
 * `decision` and `reviews` (D26) are the `ProfileReview` audit trail
 * (`auditable-profile-approval`) — structurally impossible to leak here
 * already, since `ProfileReview` lives on a separate table never joined
 * into `PublicHospitalDirectoryQuery` (see that file), but named explicitly
 * so an accidental future edit that tries to surface "last approved by" or
 * a review basis on this projection fails `tsc` at the interface edit,
 * before any test runs.
 */
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
  // `upcomingEventCount` was on this list until the D10 second revision
  // admitted it as an aggregate (see the interface doc above). `nextEventAt`
  // stays forbidden: a DATE is per-event detail, not an aggregate, and would
  // tell a visitor when to find someone at that centre. `hasUpcomingEvents`
  // stays forbidden as redundant — the count already answers it, and two
  // fields saying the same thing is two things to keep honest.
  | "nextEventAt"
  | "hasUpcomingEvents"
  | "reviewBasis"
  | "adminAccountId"
  | "reviewedBy"
  | "reviewedAt"
  | "decision"
  | "reviews";

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
