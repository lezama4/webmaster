import { describe, expect, it } from "vitest";

import { createRating } from "@domain/rating/Rating";
import { listMyEventRatings } from "@application/use-cases/listMyEventRatings";
import { InMemoryRatingRepository, fixedClock } from "./support/fakes";
import { actorFor, anAccount } from "./support/builders";

function makeDeps() {
  return { ratings: new InMemoryRatingRepository() };
}

describe("listMyEventRatings (Phase 3, Block 2 — pre-fills the caller's OWN star control, never exposes anyone else's)", () => {
  it("returns an empty map when the actor has not rated anything", async () => {
    const deps = makeDeps();
    const actor = actorFor(anAccount("patient"));

    const result = await listMyEventRatings(actor, deps);

    expect(result).toEqual({});
  });

  it("returns the actor's own ratings as an eventId -> stars map", async () => {
    const deps = makeDeps();
    const actor = actorFor(anAccount("patient"));
    await deps.ratings.upsert(
      createRating({
        id: "rating-1",
        eventId: "event-1",
        raterAccountId: actor.accountId,
        stars: 4,
        createdAt: fixedClock.now(),
      }),
    );
    await deps.ratings.upsert(
      createRating({
        id: "rating-2",
        eventId: "event-2",
        raterAccountId: actor.accountId,
        stars: 2,
        createdAt: fixedClock.now(),
      }),
    );

    const result = await listMyEventRatings(actor, deps);

    expect(result).toEqual({ "event-1": 4, "event-2": 2 });
  });

  it("NEVER includes another rater's rating for the same event", async () => {
    const deps = makeDeps();
    const me = actorFor(anAccount("patient"));
    const someoneElse = actorFor(anAccount("artist"));
    await deps.ratings.upsert(
      createRating({
        id: "rating-1",
        eventId: "event-1",
        raterAccountId: someoneElse.accountId,
        stars: 5,
        createdAt: fixedClock.now(),
      }),
    );

    const result = await listMyEventRatings(me, deps);

    expect(result).toEqual({});
  });
});
