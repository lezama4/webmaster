import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError, NotSlotOwnerError } from "@domain/errors";
import {
  acceptProposal as acceptProposalTransition,
  type CreateProposalInput,
  createProposal,
  type Proposal,
  rejectProposal,
} from "@domain/proposal/Proposal";
import { acceptProposal } from "@domain/slot/acceptProposal";
import { closeSlot, createSlot, type CreateSlotInput, fillSlot, type Slot } from "@domain/slot/Slot";
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

describe("acceptProposal (pure domain invariant, ADR D4)", () => {
  it("accepts the target, rejects rivals, fills the slot, and publishes an event", () => {
    const slot = openSlot();
    const p1 = proposal("proposal-1");
    const p2 = proposal("proposal-2");
    const p3 = proposal("proposal-3");

    const outcome = acceptProposal({
      slot,
      proposals: [p1, p2, p3],
      proposalId: "proposal-1",
      eventId: "event-1",
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.acceptedProposal.id).toBe("proposal-1");
    expect(outcome.acceptedProposal.status).toBe("accepted");
    expect(outcome.rejectedProposals.map((p) => p.id)).toEqual([
      "proposal-2",
      "proposal-3",
    ]);
    expect(
      outcome.rejectedProposals.every((p) => p.status === "rejected"),
    ).toBe(true);
    expect(outcome.slot.status).toBe("filled");
    expect(outcome.event.status).toBe("published");
  });

  it("builds the event from the accepted proposal's origin", () => {
    const outcome = acceptProposal({
      slot: openSlot(),
      proposals: [proposal("proposal-1")],
      proposalId: "proposal-1",
      eventId: "event-1",
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.event.id).toBe("event-1");
    expect(outcome.event.slotId).toBe("slot-1");
    expect(outcome.event.proposalId).toBe("proposal-1");
    expect(outcome.event.title).toBe("Acoustic guitar afternoon");
  });

  it("stamps the decision time from the injected clock", () => {
    const outcome = acceptProposal({
      slot: openSlot(),
      proposals: [proposal("proposal-1")],
      proposalId: "proposal-1",
      eventId: "event-1",
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.occurredAt).toEqual(NOW);
  });

  it("leaves already-rejected rivals untouched (not re-rejected)", () => {
    const alreadyRejected = rejectProposal(proposal("proposal-2"));

    const outcome = acceptProposal({
      slot: openSlot(),
      proposals: [proposal("proposal-1"), alreadyRejected],
      proposalId: "proposal-1",
      eventId: "event-1",
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(outcome.rejectedProposals).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const slot = openSlot();
    const p1 = proposal("proposal-1");
    const p2 = proposal("proposal-2");

    acceptProposal({
      slot,
      proposals: [p1, p2],
      proposalId: "proposal-1",
      eventId: "event-1",
      clock: fixedClock,
      actingHospitalProfileId: OWNER,
    });

    expect(slot.status).toBe("open");
    expect(p1.status).toBe("submitted");
    expect(p2.status).toBe("submitted");
  });

  it("denies accepting on a filled slot", () => {
    const filled = fillSlot(openSlot());

    expect(() =>
      acceptProposal({
        slot: filled,
        proposals: [proposal("proposal-1")],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies accepting on a closed slot", () => {
    const closed = closeSlot(openSlot());

    expect(() =>
      acceptProposal({
        slot: closed,
        proposals: [proposal("proposal-1")],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it("denies accepting a proposal that is not among the slot's proposals", () => {
    expect(() =>
      acceptProposal({
        slot: openSlot(),
        proposals: [proposal("proposal-1")],
        proposalId: "proposal-99",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies accepting a proposal that belongs to a different slot (M6 mismatch)", () => {
    const foreign = proposal("proposal-1", { slotId: "slot-2" });

    expect(() =>
      acceptProposal({
        slot: openSlot(),
        proposals: [foreign],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies a cascade over rival proposals that belong to a different slot", () => {
    const foreignRival = proposal("proposal-2", { slotId: "slot-2" });

    expect(() =>
      acceptProposal({
        slot: openSlot(),
        proposals: [proposal("proposal-1"), foreignRival],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies re-accepting a proposal already in a terminal state", () => {
    const alreadyRejected = rejectProposal(proposal("proposal-1"));

    expect(() =>
      acceptProposal({
        slot: openSlot(),
        proposals: [alreadyRejected],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      }),
    ).toThrow(InvalidTransitionError);
  });

  describe("ownership enforcement (M2 — decision: ownership is a domain rule)", () => {
    it("allows the owning Hospital to accept a proposal", () => {
      const outcome = acceptProposal({
        slot: openSlot(),
        proposals: [proposal("proposal-1")],
        proposalId: "proposal-1",
        eventId: "event-1",
        clock: fixedClock,
        actingHospitalProfileId: OWNER,
      });

      expect(outcome.acceptedProposal.status).toBe("accepted");
    });

    it("denies a non-owning Hospital from accepting a proposal", () => {
      expect(() =>
        acceptProposal({
          slot: openSlot(),
          proposals: [proposal("proposal-1")],
          proposalId: "proposal-1",
          eventId: "event-1",
          clock: fixedClock,
          actingHospitalProfileId: NON_OWNER,
        }),
      ).toThrow(NotSlotOwnerError);
    });
  });

  describe("aggregate snapshot validation (M4/Q3 — decision: fail fast)", () => {
    it("denies accepting when an already-accepted rival is present on an 'open' slot", () => {
      const acceptedRival = acceptProposalTransition(proposal("proposal-2"));

      expect(() =>
        acceptProposal({
          slot: openSlot(),
          proposals: [proposal("proposal-1"), acceptedRival],
          proposalId: "proposal-1",
          eventId: "event-1",
          clock: fixedClock,
          actingHospitalProfileId: OWNER,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies accepting when the target proposal set contains a duplicate id", () => {
      const p1 = proposal("proposal-1");
      const p1Duplicate = proposal("proposal-1");

      expect(() =>
        acceptProposal({
          slot: openSlot(),
          proposals: [p1, p1Duplicate],
          proposalId: "proposal-1",
          eventId: "event-1",
          clock: fixedClock,
          actingHospitalProfileId: OWNER,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
