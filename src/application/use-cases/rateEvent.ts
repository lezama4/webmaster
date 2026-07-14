import { changeRatingStars, createRating, type Rating } from "@domain/rating/Rating";
import { ConflictError, NotFoundError } from "@application/errors";
import type { Actor } from "@application/Actor";
import type { Clock } from "@domain/shared/Clock";
import type { EventRepository } from "@application/ports/EventRepository";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type {
  RatingAggregate,
  RatingRepository,
} from "@application/ports/RatingRepository";

export interface RateEventInput {
  readonly eventId: string;
  readonly stars: number;
}

export interface RateEventDeps {
  readonly events: EventRepository;
  readonly ratings: RatingRepository;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

export interface RateEventResult {
  readonly rating: Rating;
  readonly aggregate: RatingAggregate;
}

/**
 * Any REGISTERED (authenticated) Account may rate a PUBLISHED Event 1-5
 * stars (Phase 3, Block 2). Unlike the Hospital/Artist/Admin-gated use
 * cases elsewhere in this file, there is deliberately NO `assertRole` call
 * here — the feature is open to every Account role.
 *
 * One editable Rating per (eventId, actor.accountId): an existing Rating is
 * found and updated via `changeRatingStars`; a first-time rater gets a
 * fresh Rating via `createRating`. Both paths go through the SAME
 * `ratings.upsert` call, which persists on the (eventId, raterAccountId)
 * unique key (create-or-update, DB-atomic — see `RatingRepository`'s
 * docstring for why this doesn't need a locking unit-of-work).
 *
 * A non-existent Event is a `NotFoundError` (404); an Event that exists but
 * is not `published` (still `created`, or already `completed`) is a
 * `ConflictError` (409) — ratings only ever apply to the Events currently
 * shown on the public `/events` listing.
 */
export async function rateEvent(
  actor: Actor,
  input: RateEventInput,
  deps: RateEventDeps,
): Promise<RateEventResult> {
  const event = await deps.events.findById(input.eventId);
  if (!event) {
    throw new NotFoundError(`Event '${input.eventId}' does not exist`);
  }
  if (event.status !== "published") {
    throw new ConflictError(`Event '${input.eventId}' is not published`);
  }

  const existing = await deps.ratings.findByEventAndRater(
    input.eventId,
    actor.accountId,
  );

  const now = deps.clock.now();
  const rating = existing
    ? changeRatingStars(existing, input.stars, now)
    : createRating({
        id: deps.idGenerator.next(),
        eventId: input.eventId,
        raterAccountId: actor.accountId,
        stars: input.stars,
        createdAt: now,
      });

  await deps.ratings.upsert(rating);
  const aggregate = await deps.ratings.aggregateForEvent(input.eventId);

  return { rating, aggregate };
}
