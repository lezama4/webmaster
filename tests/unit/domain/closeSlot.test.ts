import { describe, expect, it } from "vitest";

import {
  DomainValidationError,
  InvalidTransitionError,
  NotSlotOwnerError,
} from "@domain/errors";
import {
  acceptProposal as acceptProposalTransition,
  type CreateProposalInput,
  createProposal,
  type Proposal,
  rejectProposal,
} from "@domain/proposal/Proposal";
import { closeSlot } from "@domain/slot/closeSlot";
import {
  assertSlotOwnedBy,
  closeSlot as closeSlotTransition,
  createSlot,
  type CreateSlotInput,
  fillSlot,
  type Slot,
} from "@domain/slot/Slot";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

const OWNER = "hospital-profile-1";
const NON_OWNER = "hospital-profile-2";

function openSlot(overrides: Partial<CreateSlotInput> = {}): Slot {
  return createSlot(
    {
      id: "slot-1",
      hospitalProfileId: OWNER,
      title: "Acoustic guitar afternoon",
      description: "A relaxed acoustic session for the pediatric ward.",
      scheduledAt: new Date("2026-08-01T17:00:00Z"),
      durationMinutes: 60,
      location: "Ward 3, Room 12",
      audience: "all_ages",
      ...overrides,
    },
    fixedClock,
  );
}

function proposal(id: string, overrides: Partial<CreateProposalInput> = {}): Proposal {
  return createProposal({
    id,
    slotId: "slot-1",
    artistProfileId: `artist-of-${id}`,
    message: `Message from ${id}`,
    ...overrides,
  });
}

describe("closeSlot (pure domain cascade, B2)", () => {
  it("closes the slot and cascade-rejects every submitted proposal", () => {
    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [proposal("proposal-1"), proposal("proposal-2")],
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
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
      actingHospitalProfileId: OWNER,
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
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.rejectedProposals.map((p) => p.id)).toEqual(["proposal-1"]);
  });

  it("stamps the decision time from the injected clock", () => {
    const outcome = closeSlot({
      slot: openSlot(),
      proposals: [],
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.occurredAt).toEqual(NOW);
  });

  it("does not mutate its inputs", () => {
    const slot = openSlot();
    const p1 = proposal("proposal-1");

    closeSlot({ slot, proposals: [p1], clock: fixedClock, actingHospitalProfileId: OWNER });

    expect(slot.status).toBe("open");
    expect(p1.status).toBe("submitted");
  });

  it("denies closing a filled slot", () => {
    const filled = fillSlot(openSlot());
    // A filled slot is only a consistent aggregate WITH its one accepted
    // proposal; pass that so the transition guard (not the aggregate check)
    // is what rejects the close.
    const accepted = acceptProposalTransition(proposal("proposal-1"));

    expect(() =>
      closeSlot({
        slot: filled,
        proposals: [accepted],
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies closing an already closed slot", () => {
    const closed = closeSlotTransition(openSlot());

    expect(() =>
      closeSlot({
        slot: closed,
        proposals: [],
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies a cascade over proposals that belong to a different slot", () => {
    const foreign = proposal("proposal-1", { slotId: "slot-2" });

    expect(() =>
      closeSlot({
        slot: openSlot(),
        proposals: [foreign],
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(DomainValidationError);
  });

  describe("ownership enforcement (M2 — decision: ownership is a domain rule)", () => {
    it("allows the owning Hospital to close its slot", () => {
      const outcome = closeSlot({
        slot: openSlot(),
        proposals: [],
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      });

      expect(outcome.slot.status).toBe("closed");
    });

    it("denies a non-owning Hospital from closing the slot", () => {
      expect(() =>
        closeSlot({
          slot: openSlot(),
          proposals: [],
          clock: fixedClock,
          actingHospitalProfileId: NON_OWNER,
        }),
      ).toThrow(NotSlotOwnerError);
    });
  });

  describe("aggregate snapshot validation (M4/Q3 — decision: fail fast)", () => {
    it("denies closing when an already-accepted proposal is present on an 'open' slot", () => {
      const accepted = acceptProposalTransition(proposal("proposal-1"));

      expect(() =>
        closeSlot({
          slot: openSlot(),
          proposals: [accepted],
          clock: fixedClock,
          actingHospitalProfileId: OWNER,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies closing when the proposal set contains a duplicate id", () => {
      const p1 = proposal("proposal-1");
      const p1Duplicate = proposal("proposal-1");

      expect(() =>
        closeSlot({
          slot: openSlot(),
          proposals: [p1, p1Duplicate],
          clock: fixedClock,
          actingHospitalProfileId: OWNER,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});

describe("assertSlotOwnedBy (pure domain ownership guard)", () => {
  it("passes when the acting hospital profile owns the slot", () => {
    expect(() => assertSlotOwnedBy(openSlot(), OWNER)).not.toThrow();
  });

  it("denies a hospital profile that does not own the slot", () => {
    expect(() => assertSlotOwnedBy(openSlot(), NON_OWNER)).toThrow(
      NotSlotOwnerError,
    );
  });
});
