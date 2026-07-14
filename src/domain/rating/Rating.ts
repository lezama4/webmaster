import { DomainValidationError } from "../errors";

/** Inclusive bounds for a star rating (Phase 3, Block 2). */
export const RATING_MIN_STARS = 1;
export const RATING_MAX_STARS = 5;

/**
 * Nominal brand (M1, mirrors `Event`/`Slot`): a unique symbol, never
 * exported, so outer code cannot satisfy the `Rating` type with a
 * structural literal — the ONLY ways to obtain a `Rating` are `createRating`
 * (forces `createdAt === updatedAt`) and `rehydrateRating` (validates
 * persisted data). Type-only, erased at compile time.
 */
declare const RATING_BRAND: unique symbol;

/**
 * Any registered Account's 1-5 star rating of a PUBLISHED Event (Phase 3,
 * Block 2). One Rating per (eventId, raterAccountId) — enforced at the
 * persistence boundary via a unique constraint, not by this type — and
 * editable: an existing Rating is updated in place via `changeRatingStars`,
 * never deleted and recreated. Individual ratings and the rater's identity
 * are NEVER public (only the aggregate average + count are); this type is
 * an internal domain entity, not a public projection field.
 */
export type Rating = {
  readonly id: string;
  readonly eventId: string;
  readonly raterAccountId: string;
  readonly stars: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
} & { readonly [RATING_BRAND]: "Rating" };

export interface CreateRatingInput {
  readonly id: string;
  readonly eventId: string;
  readonly raterAccountId: string;
  readonly stars: number;
  readonly createdAt: Date;
}

export interface RehydrateRatingInput extends CreateRatingInput {
  readonly updatedAt: Date;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Rating ${field} must not be empty`);
  }
}

function assertValidStars(stars: number): void {
  if (
    !Number.isInteger(stars) ||
    stars < RATING_MIN_STARS ||
    stars > RATING_MAX_STARS
  ) {
    throw new DomainValidationError(
      `Rating stars must be an integer between ${RATING_MIN_STARS} and ${RATING_MAX_STARS} (got ${stars})`,
    );
  }
}

function assertFields(input: CreateRatingInput): void {
  assertNonEmpty("id", input.id);
  assertNonEmpty("eventId", input.eventId);
  assertNonEmpty("raterAccountId", input.raterAccountId);
  assertValidStars(input.stars);
}

/**
 * Creates a new Rating. ALWAYS starts with `updatedAt === createdAt` (M1:
 * the initial state is forced by this factory, not left to the caller to
 * fabricate) — a subsequent edit goes through `changeRatingStars`.
 */
export function createRating(input: CreateRatingInput): Rating {
  assertFields(input);

  return {
    id: input.id,
    eventId: input.eventId,
    raterAccountId: input.raterAccountId,
    stars: input.stars,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  } as Rating;
}

/**
 * Rebuilds a Rating from persisted data (M1). Unlike `createRating`, this
 * MAY produce a Rating whose `updatedAt` differs from its `createdAt`
 * (a previously-edited Rating legitimately has one) — every field is still
 * validated, so corrupt persisted data fails fast here.
 */
export function rehydrateRating(input: RehydrateRatingInput): Rating {
  assertFields(input);

  return {
    id: input.id,
    eventId: input.eventId,
    raterAccountId: input.raterAccountId,
    stars: input.stars,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  } as Rating;
}

/**
 * The rater changes their existing Rating's stars (editable — one Rating
 * per user per Event, B2). Returns a NEW Rating value; the original is
 * never mutated.
 */
export function changeRatingStars(
  rating: Rating,
  stars: number,
  updatedAt: Date,
): Rating {
  assertValidStars(stars);
  return { ...rating, stars, updatedAt };
}
