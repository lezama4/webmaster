import { describe, expect, it } from "vitest";

import {
  DomainValidationError,
  InvalidTransitionError,
  NotSlotOwnerError,
} from "@domain/errors";
import { type Proposal, rejectProposal } from "@domain/proposal/Proposal";
import { closeSlot } from "@domain/slot/closeSlot";
import {
  assertSlotOwnedBy,
  closeSlot as closeSlotTransition,
  fillSlot,
  type Slot,
} from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

function openSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: "slot-1",
    hospitalProfileId: "hospital-profile-1",
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    location: "Ward 3, Room 12",
    status: "open",
    ...overrides,
  };
}

function proposal(id: string, overrides: Partial<Proposal> = {}): Proposal {
  return {
    id,
    slotId: "slot-1",
    artistProfileId: `artist-of-${id}`,
    message: `Message from ${id}`,
    status: "submitted",
    ...overrides,
  };
}

describe("closeSlot (pure domain cascade, B2)", () => {
  it("closes the slot and cascade-rejects every submitted proposal", () => {
    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [proposal("proposal-1"), proposal("proposal-2")],
      clock: fixedClock,
    });

    expect(outcome.slot.status).toBe("closed");
    expect(outcome.rejectedProposals.map((p) => p.id)).toEqual([
      "proposal-1",
      "proposal-2",
    ]);
    expect(
      outcome.rejectedProposals.every((p) => p.status === "rejected"),
    ).toBe(true);
  });

  it("closes a slot with no proposals, yielding an empty cascade", () => {
    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [],
      clock: fixedClock,
    });

    expect(outcome.slot.status).toBe("closed");
    expect(outcome.rejectedProposals).toEqual([]);
  });

  it("leaves already-rejected proposals untouched (not re-rejected)", () => {
    const alreadyRejected = rejectProposal(proposal("proposal-2"));

    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [proposal("proposal-1"), alreadyRejected],
      clock: fixedClock,
    });

    expect(outcome.rejectedProposals.map((p) => p.id)).toEqual(["proposal-1"]);
  });

  it("stamps the decision time from the injected clock", () => {
    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [],
      clock: fixedClock,
    });

    expect(outcome.occurredAt).toEqual(NOW);
  });

  it("does not mutate its inputs", () => {
    const slot = openSlot();
    const p1 = proposal("proposal-1");

    closeSlot({ slot, proposals: [p1], clock: fixedClock });

    expect(slot.status).toBe("open");
    expect(p1.status).toBe("submitted");
  });

  it("denies closing a filled slot", () => {
    const filled = fillSlot(openSlot());

    expect(() =>
      closeSlot({ slot: filled, proposals: [], clock: fixedClock }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies closing an already closed slot", () => {
    const closed = closeSlotTransition(openSlot());

    expect(() =>
      closeSlot({ slot: closed, proposals: [], clock: fixedClock }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies a cascade over proposals that belong to a different slot", () => {
    const foreign = proposal("proposal-1", { slotId: "slot-2" });

    expect(() =>
      closeSlot({ slot: openSlot(), proposals: [foreign], clock: fixedClock }),
    ).toThrow(DomainValidationError);
  });
});

describe("assertSlotOwnedBy (pure domain ownership guard)", () => {
  it("passes when the acting hospital profile owns the slot", () => {
    expect(() =>
      assertSlotOwnedBy(openSlot(), "hospital-profile-1"),
    ).not.toThrow();
  });

  it("denies a hospital profile that does not own the slot", () => {
    expect(() => assertSlotOwnedBy(openSlot(), "hospital-profile-2")).toThrow(
      NotSlotOwnerError,
    );
  });
});
