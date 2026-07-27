import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import {
  assertValidSlotAggregate,
  rehydrateSlotAggregate,
} from "@domain/slot/aggregate";
import { type Proposal, rehydrateProposal } from "@domain/proposal/Proposal";
import { rehydrateSlot, type Slot, type SlotStatus } from "@domain/slot/Slot";

function slot(status: SlotStatus, overrides: Partial<{ id: string }> = {}): Slot {
  return rehydrateSlot({
    id: overrides.id ?? "slot-1",
    hospitalProfileId: "hospital-profile-1",
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    location: "Ward 3, Room 12",
    status,
    audience: "all_ages",
  });
}

function proposal(
  id: string,
  status: Proposal["status"],
  slotId = "slot-1",
): Proposal {
  return rehydrateProposal({
    id,
    slotId,
    artistProfileId: "artist-profile-1",
    message: "I would love to play for the kids.",
    status,
  });
}

describe("assertValidSlotAggregate — status matrix (pr1-M1)", () => {
  describe("valid snapshots", () => {
    it("accepts an open slot with only submitted/rejected proposals", () => {
      expect(() =>
        assertValidSlotAggregate(slot("open"), [
          proposal("p1", "submitted"),
          proposal("p2", "rejected"),
        ]),
      ).not.toThrow();
    });

    it("accepts an open slot with no proposals", () => {
      expect(() => assertValidSlotAggregate(slot("open"), [])).not.toThrow();
    });

    it("accepts a filled slot with exactly one accepted and the rest rejected", () => {
      expect(() =>
        assertValidSlotAggregate(slot("filled"), [
          proposal("p1", "accepted"),
          proposal("p2", "rejected"),
        ]),
      ).not.toThrow();
    });

    it("accepts a closed slot with only rejected proposals", () => {
      expect(() =>
        assertValidSlotAggregate(slot("closed"), [
          proposal("p1", "rejected"),
          proposal("p2", "rejected"),
        ]),
      ).not.toThrow();
    });
  });

  describe("accepted-count matrix", () => {
    it("rejects an open slot containing an accepted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("open"), [proposal("p1", "accepted")]),
      ).toThrow(DomainValidationError);
    });

    it("rejects a closed slot containing an accepted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("closed"), [proposal("p1", "accepted")]),
      ).toThrow(DomainValidationError);
    });

    it("rejects a filled slot with no accepted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("filled"), [
          proposal("p1", "rejected"),
        ]),
      ).toThrow(DomainValidationError);
    });

    it("rejects a filled slot with more than one accepted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("filled"), [
          proposal("p1", "accepted"),
          proposal("p2", "accepted"),
        ]),
      ).toThrow(DomainValidationError);
    });
  });

  describe("submitted-only-while-open matrix", () => {
    it("rejects a filled slot that still has a submitted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("filled"), [
          proposal("p1", "accepted"),
          proposal("p2", "submitted"),
        ]),
      ).toThrow(DomainValidationError);
    });

    it("rejects a closed slot that still has a submitted proposal", () => {
      expect(() =>
        assertValidSlotAggregate(slot("closed"), [
          proposal("p1", "submitted"),
        ]),
      ).toThrow(DomainValidationError);
    });
  });

  describe("structural rules still enforced", () => {
    it("rejects a proposal that does not belong to the slot", () => {
      expect(() =>
        assertValidSlotAggregate(slot("open"), [
          proposal("p1", "submitted", "some-other-slot"),
        ]),
      ).toThrow(DomainValidationError);
    });

    it("rejects a duplicate proposal id", () => {
      expect(() =>
        assertValidSlotAggregate(slot("open"), [
          proposal("dup", "submitted"),
          proposal("dup", "rejected"),
        ]),
      ).toThrow(DomainValidationError);
    });
  });

  describe("rehydrateSlotAggregate", () => {
    it("returns the snapshot unchanged when consistent", () => {
      const s = slot("filled");
      const proposals = [proposal("p1", "accepted"), proposal("p2", "rejected")];

      const result = rehydrateSlotAggregate(s, proposals);

      expect(result.slot).toBe(s);
      expect(result.proposals).toBe(proposals);
    });

    it("throws on an inconsistent snapshot before returning", () => {
      expect(() =>
        rehydrateSlotAggregate(slot("filled"), [proposal("p1", "submitted")]),
      ).toThrow(DomainValidationError);
    });
  });
});
