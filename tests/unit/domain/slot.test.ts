import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  closeSlot,
  createSlot,
  type CreateSlotInput,
  fillSlot,
  rehydrateSlot,
  type Slot,
} from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

function slotInput(overrides: Partial<CreateSlotInput> = {}): CreateSlotInput {
  return {
    id: "slot-1",
    hospitalProfileId: "hospital-profile-1",
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    location: "Ward 3, Room 12",
    audience: "all_ages",
    ...overrides,
  };
}

function openSlot(overrides: Partial<CreateSlotInput> = {}): Slot {
  return createSlot(slotInput(overrides), fixedClock);
}

describe("Slot state machine", () => {
  describe("fillSlot (open -> filled)", () => {
    it("transitions an open slot to filled", () => {
      const filled = fillSlot(openSlot());

      expect(filled.status).toBe("filled");
    });

    it("preserves slot identity and data", () => {
      const filled = fillSlot(openSlot());

      expect(filled.id).toBe("slot-1");
      expect(filled.hospitalProfileId).toBe("hospital-profile-1");
      expect(filled.title).toBe("Acoustic guitar afternoon");
    });

    it("does not mutate the original slot", () => {
      const original = openSlot();

      fillSlot(original);

      expect(original.status).toBe("open");
    });

    it("denies filling an already filled slot", () => {
      const filled = fillSlot(openSlot());

      expect(() => fillSlot(filled)).toThrow(InvalidTransitionError);
    });

    it("denies filling a closed slot", () => {
      const closed = closeSlot(openSlot());

      expect(() => fillSlot(closed)).toThrow(InvalidTransitionError);
    });
  });

  describe("closeSlot (open -> closed)", () => {
    it("transitions an open slot to closed", () => {
      const closed = closeSlot(openSlot());

      expect(closed.status).toBe("closed");
    });

    it("denies closing an already closed slot", () => {
      const closed = closeSlot(openSlot());

      expect(() => closeSlot(closed)).toThrow(InvalidTransitionError);
    });

    it("denies closing a filled slot", () => {
      const filled = fillSlot(openSlot());

      expect(() => closeSlot(filled)).toThrow(InvalidTransitionError);
    });
  });

  describe("createSlot invariants (N2)", () => {
    it("creates an open slot when every invariant holds", () => {
      const slot = createSlot(slotInput(), fixedClock);

      expect(slot.status).toBe("open");
      expect(slot.id).toBe("slot-1");
      expect(slot.hospitalProfileId).toBe("hospital-profile-1");
      expect(slot.title).toBe("Acoustic guitar afternoon");
      expect(slot.durationMinutes).toBe(60);
      expect(slot.location).toBe("Ward 3, Room 12");
      expect(slot.audience).toBe("all_ages");
    });

    it("rejects a scheduledAt in the past", () => {
      const past = new Date("2026-07-10T11:59:59Z");

      expect(() =>
        createSlot(slotInput({ scheduledAt: past }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a scheduledAt exactly at the current instant (must be strictly future)", () => {
      expect(() =>
        createSlot(slotInput({ scheduledAt: NOW }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a zero durationMinutes", () => {
      expect(() =>
        createSlot(slotInput({ durationMinutes: 0 }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a negative durationMinutes", () => {
      expect(() =>
        createSlot(slotInput({ durationMinutes: -30 }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a non-integer durationMinutes", () => {
      expect(() =>
        createSlot(slotInput({ durationMinutes: 45.5 }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a title shorter than 3 characters", () => {
      expect(() => createSlot(slotInput({ title: "Ab" }), fixedClock)).toThrow(
        DomainValidationError,
      );
    });

    it("rejects a title longer than 120 characters", () => {
      expect(() =>
        createSlot(slotInput({ title: "A".repeat(121) }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("accepts a title at the 120-character boundary", () => {
      const slot = createSlot(slotInput({ title: "A".repeat(120) }), fixedClock);

      expect(slot.title).toHaveLength(120);
    });

    it("rejects a description longer than 2000 characters", () => {
      expect(() =>
        createSlot(slotInput({ description: "D".repeat(2001) }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("accepts a description at the 2000-character boundary", () => {
      const slot = createSlot(
        slotInput({ description: "D".repeat(2000) }),
        fixedClock,
      );

      expect(slot.description).toHaveLength(2000);
    });

    it("rejects an empty location", () => {
      expect(() => createSlot(slotInput({ location: "" }), fixedClock)).toThrow(
        DomainValidationError,
      );
    });

    it("rejects a whitespace-only location", () => {
      expect(() =>
        createSlot(slotInput({ location: "   " }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a location longer than 200 characters", () => {
      expect(() =>
        createSlot(slotInput({ location: "L".repeat(201) }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("MUST NOT be possible to construct a Slot in 'filled'/'closed' state via a literal (compile-time enforced, M1)", () => {
      // @ts-expect-error - Slot's brand field is not exported, so a
      // structural literal (even with every visible field, including a
      // terminal 'closed' status) can never satisfy the Slot type. The
      // only ways in are createSlot (forces 'open') and rehydrateSlot
      // (validates persisted data).
      const fabricated: Slot = {
        id: "slot-x",
        hospitalProfileId: "hospital-profile-x",
        title: "Fabricated slot",
        description: "",
        scheduledAt: new Date("2026-08-01T17:00:00Z"),
        durationMinutes: 30,
        location: "Nowhere",
        status: "closed",
      };

      expect(fabricated).toBeDefined();
    });
  });

  describe("createSlot audience (Phase 1 — age band)", () => {
    it.each([
      "all_ages",
      "early_childhood",
      "children",
      "teens",
      "adults",
    ] as const)("accepts audience '%s'", (audience) => {
      const slot = createSlot(slotInput({ audience }), fixedClock);

      expect(slot.audience).toBe(audience);
    });

    it("rejects an invalid audience value", () => {
      expect(() =>
        createSlot(
          // @ts-expect-error - deliberately invalid audience.
          slotInput({ audience: "toddlers" }),
          fixedClock,
        ),
      ).toThrow(DomainValidationError);
    });
  });

  describe("createSlot date safety (M3)", () => {
    it("rejects a non-finite scheduledAt (new Date(NaN))", () => {
      expect(() =>
        createSlot(slotInput({ scheduledAt: new Date(NaN) }), fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("mutating the input Date after creation does not affect the Slot", () => {
      const input = new Date("2026-08-01T17:00:00Z");
      const originalMs = input.getTime();

      const slot = createSlot(slotInput({ scheduledAt: input }), fixedClock);
      input.setFullYear(1999);

      expect(slot.scheduledAt.getTime()).toBe(originalMs);
    });

    it("mutating the returned Date does not affect internal state", () => {
      const slot = createSlot(slotInput(), fixedClock);
      const originalMs = slot.scheduledAt.getTime();

      const returned = slot.scheduledAt;
      returned.setFullYear(1999);

      expect(slot.scheduledAt.getTime()).toBe(originalMs);
      expect(slot.scheduledAt).not.toBe(returned);
    });
  });

  describe("rehydrateSlot (M1: validated reconstruction from persisted data)", () => {
    it("rehydrates a slot in 'filled' state with a scheduledAt in the past (legitimate for an already-resolved slot)", () => {
      const past = new Date("2020-01-01T00:00:00Z");

      const slot = rehydrateSlot({
        id: "slot-1",
        hospitalProfileId: "hospital-profile-1",
        title: "Acoustic guitar afternoon",
        description: "A relaxed acoustic session for the pediatric ward.",
        scheduledAt: past,
        durationMinutes: 60,
        location: "Ward 3, Room 12",
        status: "filled",
        audience: "all_ages",
      });

      expect(slot.status).toBe("filled");
      expect(slot.scheduledAt).toEqual(past);
    });

    it("rehydrates a slot in 'closed' state", () => {
      const slot = rehydrateSlot({
        id: "slot-1",
        hospitalProfileId: "hospital-profile-1",
        title: "Acoustic guitar afternoon",
        description: "A relaxed acoustic session for the pediatric ward.",
        scheduledAt: new Date("2020-01-01T00:00:00Z"),
        durationMinutes: 60,
        location: "Ward 3, Room 12",
        status: "closed",
        audience: "all_ages",
      });

      expect(slot.status).toBe("closed");
    });

    it("rehydrates the persisted audience", () => {
      const slot = rehydrateSlot({
        id: "slot-1",
        hospitalProfileId: "hospital-profile-1",
        title: "Acoustic guitar afternoon",
        description: "A relaxed acoustic session for the pediatric ward.",
        scheduledAt: new Date("2020-01-01T00:00:00Z"),
        durationMinutes: 60,
        location: "Ward 3, Room 12",
        status: "closed",
        audience: "teens",
      });

      expect(slot.audience).toBe("teens");
    });

    it("does not leak the caller's Date reference (M3 applies to rehydration too)", () => {
      const input = new Date("2020-01-01T00:00:00Z");
      const originalMs = input.getTime();

      const slot = rehydrateSlot({
        id: "slot-1",
        hospitalProfileId: "hospital-profile-1",
        title: "Acoustic guitar afternoon",
        description: "A relaxed acoustic session for the pediatric ward.",
        scheduledAt: input,
        durationMinutes: 60,
        location: "Ward 3, Room 12",
        status: "closed",
        audience: "all_ages",
      });
      input.setFullYear(1999);

      expect(slot.scheduledAt.getTime()).toBe(originalMs);
    });

    it("denies rehydrating an invalid status", () => {
      expect(() =>
        rehydrateSlot({
          id: "slot-1",
          hospitalProfileId: "hospital-profile-1",
          title: "Acoustic guitar afternoon",
          description: "A relaxed acoustic session for the pediatric ward.",
          scheduledAt: new Date("2020-01-01T00:00:00Z"),
          durationMinutes: 60,
          location: "Ward 3, Room 12",
          // @ts-expect-error - deliberately invalid persisted status.
          status: "cancelled",
          audience: "all_ages",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating a non-finite scheduledAt", () => {
      expect(() =>
        rehydrateSlot({
          id: "slot-1",
          hospitalProfileId: "hospital-profile-1",
          title: "Acoustic guitar afternoon",
          description: "A relaxed acoustic session for the pediatric ward.",
          scheduledAt: new Date(NaN),
          durationMinutes: 60,
          location: "Ward 3, Room 12",
          status: "open",
          audience: "all_ages",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating an invalid audience", () => {
      expect(() =>
        rehydrateSlot({
          id: "slot-1",
          hospitalProfileId: "hospital-profile-1",
          title: "Acoustic guitar afternoon",
          description: "A relaxed acoustic session for the pediatric ward.",
          scheduledAt: new Date("2020-01-01T00:00:00Z"),
          durationMinutes: 60,
          location: "Ward 3, Room 12",
          status: "open",
          // @ts-expect-error - deliberately invalid persisted audience.
          audience: "toddlers",
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
