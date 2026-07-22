import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import {
  changeRatingStars,
  createRating,
  rehydrateRating,
  type Rating,
} from "@domain/rating/Rating";

const CREATED_AT = new Date("2026-07-14T12:00:00Z");
const UPDATED_AT = new Date("2026-07-14T13:00:00Z");

function newRating(overrides: Partial<{ stars: number }> = {}): Rating {
  return createRating({
    id: "rating-1",
    eventId: "event-1",
    raterAccountId: "account-1",
    stars: overrides.stars ?? 4,
    createdAt: CREATED_AT,
  });
}

describe("Rating (Phase 3, Block 2 — real event ratings)", () => {
  describe("createRating", () => {
    it("creates a Rating carrying id/eventId/raterAccountId/stars", () => {
      const rating = newRating({ stars: 5 });

      expect(rating.id).toBe("rating-1");
      expect(rating.eventId).toBe("event-1");
      expect(rating.raterAccountId).toBe("account-1");
      expect(rating.stars).toBe(5);
    });

    it("sets createdAt and updatedAt to the same instant at creation", () => {
      const rating = newRating();

      expect(rating.createdAt).toEqual(CREATED_AT);
      expect(rating.updatedAt).toEqual(CREATED_AT);
    });

    it.each([0, 6, -1, 1.5, 4.9])(
      "denies a non-integer or out-of-range stars value (%s)",
      (stars) => {
        expect(() =>
          createRating({
            id: "rating-1",
            eventId: "event-1",
            raterAccountId: "account-1",
            stars,
            createdAt: CREATED_AT,
          }),
        ).toThrow(DomainValidationError);
      },
    );

    it.each([1, 2, 3, 4, 5])("accepts every integer star value 1..5 (%s)", (stars) => {
      const rating = newRating({ stars });

      expect(rating.stars).toBe(stars);
    });

    it("denies an empty id", () => {
      expect(() =>
        createRating({
          id: "  ",
          eventId: "event-1",
          raterAccountId: "account-1",
          stars: 3,
          createdAt: CREATED_AT,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies an empty eventId", () => {
      expect(() =>
        createRating({
          id: "rating-1",
          eventId: "  ",
          raterAccountId: "account-1",
          stars: 3,
          createdAt: CREATED_AT,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies an empty raterAccountId", () => {
      expect(() =>
        createRating({
          id: "rating-1",
          eventId: "event-1",
          raterAccountId: "  ",
          stars: 3,
          createdAt: CREATED_AT,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("rehydrateRating (validated reconstruction from persisted data)", () => {
    it("rehydrates a Rating with independently persisted createdAt/updatedAt", () => {
      const rating = rehydrateRating({
        id: "rating-1",
        eventId: "event-1",
        raterAccountId: "account-1",
        stars: 2,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });

      expect(rating.createdAt).toEqual(CREATED_AT);
      expect(rating.updatedAt).toEqual(UPDATED_AT);
    });

    it("denies rehydrating an invalid stars value", () => {
      expect(() =>
        rehydrateRating({
          id: "rating-1",
          eventId: "event-1",
          raterAccountId: "account-1",
          stars: 7,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("changeRatingStars (editable — one rating per user per event)", () => {
    it("updates stars and updatedAt, leaving id/eventId/raterAccountId/createdAt untouched", () => {
      const original = newRating({ stars: 3 });

      const changed = changeRatingStars(original, 5, UPDATED_AT);

      expect(changed.stars).toBe(5);
      expect(changed.updatedAt).toEqual(UPDATED_AT);
      expect(changed.id).toBe(original.id);
      expect(changed.eventId).toBe(original.eventId);
      expect(changed.raterAccountId).toBe(original.raterAccountId);
      expect(changed.createdAt).toEqual(original.createdAt);
    });

    it("does not mutate the original Rating", () => {
      const original = newRating({ stars: 3 });

      changeRatingStars(original, 5, UPDATED_AT);

      expect(original.stars).toBe(3);
    });

    it("denies changing to an invalid stars value", () => {
      const original = newRating({ stars: 3 });

      expect(() => changeRatingStars(original, 0, UPDATED_AT)).toThrow(
        DomainValidationError,
      );
    });
  });
});
