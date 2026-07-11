import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  completeEvent,
  createEvent,
  type Event,
  publishEvent,
  rehydrateEvent,
} from "@domain/event/Event";

function newEvent(): Event {
  return createEvent({
    id: "event-1",
    slotId: "slot-1",
    proposalId: "proposal-1",
    title: "Acoustic guitar afternoon",
  });
}

describe("Event lifecycle", () => {
  describe("createEvent", () => {
    it("creates an event in 'created' state", () => {
      const event = newEvent();

      expect(event.status).toBe("created");
    });

    it("carries the originating slot, proposal, and title", () => {
      const event = newEvent();

      expect(event.id).toBe("event-1");
      expect(event.slotId).toBe("slot-1");
      expect(event.proposalId).toBe("proposal-1");
      expect(event.title).toBe("Acoustic guitar afternoon");
    });

    it("denies creating an event with an empty title", () => {
      expect(() =>
        createEvent({
          id: "event-1",
          slotId: "slot-1",
          proposalId: "proposal-1",
          title: "  ",
        }),
      ).toThrow(DomainValidationError);
    });

    it("MUST NOT be possible to construct an Event in a later-lifecycle state via a literal (compile-time enforced, M1)", () => {
      // @ts-expect-error - Event's brand field is not exported, so a
      // structural literal (even with every visible field, including a
      // 'completed' status) can never satisfy the Event type. The only
      // ways in are createEvent (forces 'created') and rehydrateEvent
      // (validates persisted data).
      const fabricated: Event = {
        id: "event-x",
        slotId: "slot-x",
        proposalId: "proposal-x",
        title: "fabricated",
        status: "completed",
      };

      expect(fabricated).toBeDefined();
    });
  });

  describe("rehydrateEvent (M1: validated reconstruction from persisted data)", () => {
    it("rehydrates an event in 'published' state (a status createEvent can never produce)", () => {
      const event = rehydrateEvent({
        id: "event-1",
        slotId: "slot-1",
        proposalId: "proposal-1",
        title: "Acoustic guitar afternoon",
        status: "published",
      });

      expect(event.status).toBe("published");
    });

    it("rehydrates an event in 'completed' state", () => {
      const event = rehydrateEvent({
        id: "event-1",
        slotId: "slot-1",
        proposalId: "proposal-1",
        title: "Acoustic guitar afternoon",
        status: "completed",
      });

      expect(event.status).toBe("completed");
    });

    it("denies rehydrating an invalid status", () => {
      expect(() =>
        rehydrateEvent({
          id: "event-1",
          slotId: "slot-1",
          proposalId: "proposal-1",
          title: "Acoustic guitar afternoon",
          // @ts-expect-error - deliberately invalid persisted status.
          status: "cancelled",
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("publishEvent (created -> published)", () => {
    it("transitions a created event to published", () => {
      const published = publishEvent(newEvent());

      expect(published.status).toBe("published");
    });

    it("does not mutate the original event", () => {
      const original = newEvent();

      publishEvent(original);

      expect(original.status).toBe("created");
    });

    it("denies publishing an already published event", () => {
      const published = publishEvent(newEvent());

      expect(() => publishEvent(published)).toThrow(InvalidTransitionError);
    });

    it("denies publishing a completed event", () => {
      const completed = completeEvent(publishEvent(newEvent()));

      expect(() => publishEvent(completed)).toThrow(InvalidTransitionError);
    });
  });

  describe("completeEvent (published -> completed)", () => {
    it("transitions a published event to completed", () => {
      const completed = completeEvent(publishEvent(newEvent()));

      expect(completed.status).toBe("completed");
    });

    it("denies completing an event that was never published", () => {
      expect(() => completeEvent(newEvent())).toThrow(InvalidTransitionError);
    });

    it("denies completing an already completed event", () => {
      const completed = completeEvent(publishEvent(newEvent()));

      expect(() => completeEvent(completed)).toThrow(InvalidTransitionError);
    });
  });
});
