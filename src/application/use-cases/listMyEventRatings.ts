import type { Actor } from "@application/Actor";
import type { RatingRepository } from "@application/ports/RatingRepository";

export interface ListMyEventRatingsDeps {
  readonly ratings: RatingRepository;
}

/**
 * Returns the authenticated Actor's OWN ratings as an `eventId -> stars`
 * map, used ONLY to pre-fill the interactive star control on `/events`
 * (Phase 3, Block 2). Filters by `actor.accountId` at the port boundary —
 * `RatingRepository.listByRater` never returns another Account's Rating, so
 * this use case can never leak one rater's rating to a different caller.
 */
export async function listMyEventRatings(
  actor: Actor,
  deps: ListMyEventRatingsDeps,
): Promise<Readonly<Record<string, number>>> {
  const ratings = await deps.ratings.listByRater(actor.accountId);
  const map: Record<string, number> = {};
  for (const rating of ratings) {
    map[rating.eventId] = rating.stars;
  }
  return map;
}
