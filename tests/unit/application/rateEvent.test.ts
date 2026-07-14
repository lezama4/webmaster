import { describe, expect, it } from "vitest";

import { createEvent, publishEvent, type Event } from "@domain/event/Event";
import { DomainValidationError } from "@domain/errors";
import { ConflictError, NotFoundError } from "@application/errors";
import { rateEvent } from "@application/use-cases/rateEvent";
import {
  InMemoryEventRepository,
  InMemoryRatingRepository,
  SequentialIdGenerator,
  fixedClock,
} from "./support/fakes";
import { actorFor, anAccount } from "./support/builders";

function makeDeps() {
  const events = new InMemoryEventRepository();
  const ratings = new InMemoryRatingRepository();
  return {
    events,
    ratings,
    idGenerator: new SequentialIdGenerator("rating"),
    clock: fixedClock,
  };
}

function aPublishedEvent(overrides: Partial<{ id: string }> = {}): Event {
  return publishEvent(
    createEvent({
      id: overrides.id ?? "event-1",
      slotId: "slot-1",
      proposalId: "proposal-1",
      title: "Acoustic guitar afternoon",
    }),
  );
}

describe("rateEvent (any REGISTERED account, PUBLISHED events only, one editable Rating per user per event — Phase 3, Block 2)", () => {
  it("creates a new Rating for a PUBLISHED event, any registered role", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    await deps.events.save(event);
    const actor = actorFor(anAccount("patient"));

    const result = await rateEvent(actor, { eventId: event.id, stars: 4 }, deps);

    expect(result.rating.stars).toBe(4);
    expect(result.rating.eventId).toBe(event.id);
    expect(result.rating.raterAccountId).toBe(actor.accountId);
    expect(result.aggregate).toEqual({ averageStars: 4, ratingCount: 1 });
  });

  it.each(["hospital", "artist", "patient", "admin"] as const)(
    "allows any role (%s) — no role restriction",
    async (role) => {
      const deps = makeDeps();
      const event = aPublishedEvent();
      await deps.events.save(event);
      const actor = actorFor(anAccount(role));

      await expect(
        rateEvent(actor, { eventId: event.id, stars: 3 }, deps),
      ).resolves.toMatchObject({ rating: { stars: 3 } });
    },
  );

  it("UPSERTs: a second rating from the SAME rater for the SAME event updates the existing Rating instead of creating a second one", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    await deps.events.save(event);
    const actor = actorFor(anAccount("patient"));

    const first = await rateEvent(actor, { eventId: event.id, stars: 2 }, deps);
    const second = await rateEvent(actor, { eventId: event.id, stars: 5 }, deps);

    expect(second.rating.id).toBe(first.rating.id);
    expect(second.rating.stars).toBe(5);
    expect(second.aggregate).toEqual({ averageStars: 5, ratingCount: 1 });
  });

  it("computes the average across multiple distinct raters", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    await deps.events.save(event);

    await rateEvent(actorFor(anAccount("patient")), { eventId: event.id, stars: 2 }, deps);
    const result = await rateEvent(
      actorFor(anAccount("artist")),
      { eventId: event.id, stars: 4 },
      deps,
    );

    expect(result.aggregate).toEqual({ averageStars: 3, ratingCount: 2 });
  });

  it("denies rating a non-existent event with NotFoundError", async () => {
    const deps = makeDeps();
    const actor = actorFor(anAccount("patient"));

    await expect(
      rateEvent(actor, { eventId: "missing-event", stars: 3 }, deps),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies rating a 'created' (not yet published) event with ConflictError", async () => {
    const deps = makeDeps();
    const event = createEvent({
      id: "event-unpublished",
      slotId: "slot-1",
      proposalId: "proposal-1",
      title: "Not yet public",
    });
    await deps.events.save(event);
    const actor = actorFor(anAccount("patient"));

    await expect(
      rateEvent(actor, { eventId: event.id, stars: 3 }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies rating a 'completed' event with ConflictError (published-only per spec)", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    // Force to 'completed' via rehydrate-through-domain semantics.
    const { completeEvent } = await import("@domain/event/Event");
    await deps.events.save(completeEvent(event));
    const actor = actorFor(anAccount("patient"));

    await expect(
      rateEvent(actor, { eventId: event.id, stars: 3 }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("propagates a DomainValidationError for an out-of-range stars value", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    await deps.events.save(event);
    const actor = actorFor(anAccount("patient"));

    await expect(
      rateEvent(actor, { eventId: event.id, stars: 6 }, deps),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("does not leak one rater's Rating id/identity into another rater's aggregate result", async () => {
    const deps = makeDeps();
    const event = aPublishedEvent();
    await deps.events.save(event);
    const first = actorFor(anAccount("patient"));
    const second = actorFor(anAccount("artist"));

    await rateEvent(first, { eventId: event.id, stars: 1 }, deps);
    const result = await rateEvent(second, { eventId: event.id, stars: 5 }, deps);

    expect(result.rating.raterAccountId).toBe(second.accountId);
    expect(result.rating.raterAccountId).not.toBe(first.accountId);
  });
});
