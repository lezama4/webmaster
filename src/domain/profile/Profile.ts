import { DomainValidationError, InvalidTransitionError } from "../errors";
import type { Clock } from "../shared/Clock";

export type ProfileType = "centre" | "artist";

export type ProfileStatus = "pending" | "active" | "rejected" | "deactivated";

/**
 * The six kinds of care centre (ADR D16, `widen-beyond-hospitals`) — an
 * independent, orthogonal axis from `ProfileType`/`AccountRole`. A `centre`
 * Profile ALWAYS carries exactly one `CentreType`; an `artist` Profile NEVER
 * does (invariant enforced in `createProfile`/`rehydrateProfile` below).
 * "The seventh centre type is data, not code": adding a kind is one enum
 * value + one migration + one i18n label, never a change to authorization.
 */
export type CentreType =
  | "hospital"
  | "nursing_home"
  | "day_centre"
  | "day_hospital"
  | "occupational_centre"
  | "palliative_unit";

export const CENTRE_TYPES: readonly CentreType[] = [
  "hospital",
  "nursing_home",
  "day_centre",
  "day_hospital",
  "occupational_centre",
  "palliative_unit",
];

/** Rejects any string that is not one of the six known `CentreType` values (ADR D16). */
export function assertValidCentreType(
  centreType: string,
): asserts centreType is CentreType {
  if (!CENTRE_TYPES.includes(centreType as CentreType)) {
    throw new DomainValidationError(`Centre type '${centreType}' is invalid`);
  }
}

const PROFILE_TYPES: readonly ProfileType[] = ["centre", "artist"];
const PROFILE_STATUSES: readonly ProfileStatus[] = [
  "pending",
  "active",
  "rejected",
  "deactivated",
];

/**
 * Nominal brand (M1): a unique symbol, never exported, so outer code cannot
 * satisfy the `Profile` type with a structural literal — the ONLY ways to
 * obtain a `Profile` are `createProfile` (forces `pending`) and
 * `rehydrateProfile` (validates persisted data). The brand is type-only
 * (erased at compile time), so `Profile` values stay plain, JSON-serializable
 * objects at runtime.
 */
declare const PROFILE_BRAND: unique symbol;

/**
 * Centre/Artist profile awaiting or holding Admin validation.
 * State machine: pending -> active | rejected;
 *                active -> deactivated (Admin, M3);
 *                rejected -> pending (re-registration, same profile, M2).
 */
export type Profile = {
  readonly id: string;
  readonly accountId: string;
  readonly type: ProfileType;
  readonly name: string;
  readonly status: ProfileStatus;
  /**
   * The kind of care centre (ADR D16) — set if and only if `type ===
   * "centre"`; always `undefined` for `type === "artist"`. Orthogonal to
   * `type`/`AccountRole`: authorization never reads this field.
   */
  readonly centreType?: CentreType;
  /** Set when a re-registration re-enters review (auditable, M2). */
  readonly reviewRequestedAt?: Date;
  // PUBLIC centre location (Phase 2, ADR D6-adjacent — NOT the same
  // surface as Slot.location, which stays PRIVATE/ward-level). All optional:
  // a centre may register without them and add them later; artists never
  // populate them. Only meaningful for `type: "centre"`, but not
  // type-restricted here — nothing prevents leaving them unset for artists.
  readonly city?: string;
  readonly postalCode?: string;
  readonly addressLine?: string;
  readonly latitude?: number;
  readonly longitude?: number;
} & { readonly [PROFILE_BRAND]: "Profile" };

// `prisma/schema.prisma` carries `ProfileStatus.DEACTIVATED` and
// `Profile.reviewRequestedAt` (D8/B3, PR 2b) — the persistence adapter
// (`src/infrastructure/persistence/prisma/ProfileRepository.ts`) maps both
// fields; no further schema work is pending for this type.

/** Optional public-location fields shared by `CreateProfileInput`/`RehydrateProfileInput` (Phase 2). */
export interface ProfileLocationInput {
  readonly city?: string;
  readonly postalCode?: string;
  readonly addressLine?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface CreateProfileInput extends ProfileLocationInput {
  readonly id: string;
  readonly accountId: string;
  readonly type: ProfileType;
  readonly centreType?: CentreType;
  readonly name: string;
}

export interface RehydrateProfileInput extends ProfileLocationInput {
  readonly id: string;
  readonly accountId: string;
  readonly type: ProfileType;
  readonly centreType?: CentreType;
  readonly name: string;
  readonly status: ProfileStatus;
  readonly reviewRequestedAt?: Date;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Profile ${field} must not be empty`);
  }
}

function assertValidType(type: ProfileType): void {
  if (!PROFILE_TYPES.includes(type)) {
    throw new DomainValidationError(`Profile type '${type}' is invalid`);
  }
}

/**
 * Enforces the D16/D18 biconditional: `type === "centre"` REQUIRES a valid
 * `centreType`; `type === "artist"` FORBIDS one. This is the single point
 * where the role axis (`type`) and the kind axis (`centreType`) are coupled
 * — everywhere else they stay independent.
 */
function assertCentreTypeInvariant(
  type: ProfileType,
  centreType: CentreType | undefined,
): void {
  if (type === "centre") {
    if (centreType === undefined) {
      throw new DomainValidationError(
        "Profile centreType is required when type is 'centre'",
      );
    }
    assertValidCentreType(centreType);
  } else if (centreType !== undefined) {
    throw new DomainValidationError(
      `Profile centreType must not be set when type is '${type}'`,
    );
  }
}

function assertValidStatus(status: ProfileStatus): void {
  if (!PROFILE_STATUSES.includes(status)) {
    throw new DomainValidationError(`Profile status '${status}' is invalid`);
  }
}

function assertValidReviewRequestedAt(reviewRequestedAt: Date | undefined): void {
  if (
    reviewRequestedAt !== undefined &&
    !Number.isFinite(reviewRequestedAt.getTime())
  ) {
    throw new DomainValidationError(
      "Profile reviewRequestedAt must be a valid date",
    );
  }
}

/**
 * Validates the OPTIONAL public-location fields (Phase 2). Every field is
 * optional — a hospital may register without a location and add it later —
 * but when `latitude`/`longitude` ARE present they must be finite numbers
 * within the standard WGS84 ranges. `city`/`postalCode`/`addressLine` are
 * free text (no format enforced here; geocoding validation is a later phase).
 */
function assertValidLocation(location: ProfileLocationInput): void {
  if (location.latitude !== undefined) {
    if (
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90
    ) {
      throw new DomainValidationError(
        "Profile latitude must be a finite number between -90 and 90",
      );
    }
  }
  if (location.longitude !== undefined) {
    if (
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new DomainValidationError(
        "Profile longitude must be a finite number between -180 and 180",
      );
    }
  }
}

function locationFields(location: ProfileLocationInput): ProfileLocationInput {
  return {
    ...(location.city !== undefined ? { city: location.city } : {}),
    ...(location.postalCode !== undefined
      ? { postalCode: location.postalCode }
      : {}),
    ...(location.addressLine !== undefined
      ? { addressLine: location.addressLine }
      : {}),
    ...(location.latitude !== undefined ? { latitude: location.latitude } : {}),
    ...(location.longitude !== undefined
      ? { longitude: location.longitude }
      : {}),
  };
}

/**
 * Creates a new Profile. ALWAYS starts in 'pending' (M1: the initial state
 * is forced by this factory, not left to the caller to fabricate).
 */
export function createProfile(input: CreateProfileInput): Profile {
  assertNonEmpty("id", input.id);
  assertNonEmpty("accountId", input.accountId);
  assertValidType(input.type);
  assertCentreTypeInvariant(input.type, input.centreType);
  assertNonEmpty("name", input.name);
  assertValidLocation(input);

  return {
    id: input.id,
    accountId: input.accountId,
    type: input.type,
    name: input.name,
    status: "pending",
    ...(input.centreType !== undefined ? { centreType: input.centreType } : {}),
    ...locationFields(input),
  } as Profile;
}

/**
 * Rebuilds a Profile from persisted data (M1). Unlike `createProfile`, this
 * MAY produce a Profile in any valid status (including `active` or
 * `deactivated`) because it represents state that already went through a
 * legitimate transition before being persisted — but every field is
 * validated, so corrupt/invalid persisted data fails fast here rather than
 * silently becoming a fabricated in-memory Profile.
 */
export function rehydrateProfile(input: RehydrateProfileInput): Profile {
  assertNonEmpty("id", input.id);
  assertNonEmpty("accountId", input.accountId);
  assertValidType(input.type);
  assertCentreTypeInvariant(input.type, input.centreType);
  assertNonEmpty("name", input.name);
  assertValidStatus(input.status);
  assertValidReviewRequestedAt(input.reviewRequestedAt);
  assertValidLocation(input);

  return {
    id: input.id,
    accountId: input.accountId,
    type: input.type,
    name: input.name,
    status: input.status,
    ...(input.centreType !== undefined ? { centreType: input.centreType } : {}),
    ...(input.reviewRequestedAt !== undefined
      ? { reviewRequestedAt: new Date(input.reviewRequestedAt.getTime()) }
      : {}),
    ...locationFields(input),
  } as Profile;
}

function assertStatus(
  profile: Profile,
  expected: ProfileStatus,
  transition: string,
): void {
  if (profile.status !== expected) {
    throw new InvalidTransitionError(
      `Cannot ${transition} a profile in '${profile.status}' state (requires '${expected}')`,
    );
  }
}

/**
 * The three closed decisions an Admin can attach to a `ProfileReview`
 * (ADR D21). Deliberately distinct from `ProfileStatus`: a `ReviewDecision`
 * is the recorded ACT, a `ProfileStatus` is the resulting STATE.
 */
export type ReviewDecision = "approve" | "reject" | "deactivate";

export const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  "approve",
  "reject",
  "deactivate",
];

/** Rejects any string that is not one of the three known `ReviewDecision` values (ADR D21). */
export function assertValidReviewDecision(
  decision: string,
): asserts decision is ReviewDecision {
  if (!REVIEW_DECISIONS.includes(decision as ReviewDecision)) {
    throw new DomainValidationError(`Review decision '${decision}' is invalid`);
  }
}

/**
 * An append-only audit record of a single admin decision on a Profile (ADR
 * D21). Immutable after creation: this module exposes no mutator and no
 * bare constructor for it — the ONLY way to obtain one is as the `review`
 * half of `approveProfile`/`rejectProfile`/`deactivateProfile`'s return
 * value, so a `ProfileReview` can never exist without the transition it
 * documents having actually happened.
 */
export interface ProfileReview {
  readonly id: string;
  readonly profileId: string;
  readonly adminAccountId: string;
  readonly decision: ReviewDecision;
  readonly basis: string;
  readonly at: Date;
}

/**
 * The caller-supplied half of a `ProfileReview` (ADR D23): the acting
 * admin's identity (sourced by the caller from the resolved, live session —
 * NEVER from client input, see `Actor.accountId`), the verification basis,
 * and the id to stamp the resulting review row with (from the caller's
 * `IdGenerator` port). The domain does not generate either the id or the
 * timestamp itself — `reviewId` is a parameter (mirrors `Profile.id`'s
 * origin) and `at` comes from the `clock` parameter, exactly like
 * `reactivateProfile`'s existing `Clock` parameter.
 */
export interface ReviewInput {
  readonly adminAccountId: string;
  readonly basis: string;
  readonly reviewId: string;
}

/**
 * The maximum TRIMMED length of a `ProfileReview.basis` (ADR D24, T-15):
 * long enough for a real verification note, short enough to not be a
 * storage-abuse or rendering vector for an unbounded audit field.
 */
export const MAX_REVIEW_BASIS_LENGTH = 1000;

/**
 * Reads the raw basis ONCE, trims ONCE, validates the trimmed value, and
 * returns exactly that trimmed value for storage — the same
 * read-once/field-by-field discipline `createProfile` uses (ADR D24). A
 * blank/whitespace-only or over-bound basis throws `DomainValidationError`
 * BEFORE any status change, so this MUST run before `assertStatus` (or, if
 * called after, only after that flip already threw — either order and the
 * profile's input value is unaffected either way, but ordering it first
 * keeps every transition consistent).
 */
function assertValidBasis(basis: string): string {
  const trimmed = basis.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError("Profile review basis must not be empty");
  }
  if (trimmed.length > MAX_REVIEW_BASIS_LENGTH) {
    throw new DomainValidationError(
      `Profile review basis must not exceed ${MAX_REVIEW_BASIS_LENGTH} characters`,
    );
  }
  return trimmed;
}

/**
 * Builds the `ProfileReview` half of a transition's result. Never exported:
 * the ONLY callers are the three admin transitions below, so a
 * `ProfileReview` can never be fabricated outside a transition that also
 * produced the matching status change.
 */
function buildReview(
  profileId: string,
  decision: ReviewDecision,
  input: ReviewInput,
  basis: string,
  clock: Clock,
): ProfileReview {
  assertNonEmpty("review adminAccountId", input.adminAccountId);
  assertNonEmpty("review id", input.reviewId);
  return {
    id: input.reviewId,
    profileId,
    adminAccountId: input.adminAccountId,
    decision,
    basis,
    at: clock.now(),
  };
}

/** Admin approval: pending -> active. Requires and records an attributed basis (ADR D21-D24). */
export function approveProfile(
  profile: Profile,
  review: ReviewInput,
  clock: Clock,
): { profile: Profile; review: ProfileReview } {
  const basis = assertValidBasis(review.basis);
  assertStatus(profile, "pending", "approve");
  const updated: Profile = { ...profile, status: "active" };
  return {
    profile: updated,
    review: buildReview(updated.id, "approve", review, basis, clock),
  };
}

/** Admin rejection: pending -> rejected. Requires and records an attributed basis (ADR D21-D24). */
export function rejectProfile(
  profile: Profile,
  review: ReviewInput,
  clock: Clock,
): { profile: Profile; review: ProfileReview } {
  const basis = assertValidBasis(review.basis);
  assertStatus(profile, "pending", "reject");
  const updated: Profile = { ...profile, status: "rejected" };
  return {
    profile: updated,
    review: buildReview(updated.id, "reject", review, basis, clock),
  };
}

/**
 * Admin deactivation (M3): active -> deactivated. Terminal in Block 1.
 * Requires and records an attributed basis (ADR D21-D24) — arguably the
 * highest-stakes decision, revoking an already-trusted node.
 */
export function deactivateProfile(
  profile: Profile,
  review: ReviewInput,
  clock: Clock,
): { profile: Profile; review: ProfileReview } {
  const basis = assertValidBasis(review.basis);
  assertStatus(profile, "active", "deactivate");
  const updated: Profile = { ...profile, status: "deactivated" };
  return {
    profile: updated,
    review: buildReview(updated.id, "deactivate", review, basis, clock),
  };
}

/**
 * Re-registration (M2): rejected -> pending, reactivating the SAME profile
 * as a new, timestamped review request — never a second Profile row.
 */
export function reactivateProfile(profile: Profile, clock: Clock): Profile {
  assertStatus(profile, "rejected", "reactivate");
  return { ...profile, status: "pending", reviewRequestedAt: clock.now() };
}
