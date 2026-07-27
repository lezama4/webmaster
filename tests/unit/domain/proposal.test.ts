import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  acceptProposal,
  type CreateProposalInput,
  createProposal,
  type Proposal,
  rehydrateProposal,
  rejectProposal,
} from "@domain/proposal/Proposal";

function submittedProposal(
  overrides: Partial<CreateProposalInput> = {},
): Proposal {
  return createProposal({
    id: "proposal-1",
    slotId: "slot-1",
    artistProfileId: "artist-profile-1",
    message: "I would love to play for the kids.",
    ...overrides,
  });
}

describe("Proposal state machine", () => {
  describe("createProposal (M1: forces the initial state)", () => {
    it("always creates a proposal in 'submitted' state", () => {
      const proposal = createProposal({
        id: "proposal-1",
        slotId: "slot-1",
        artistProfileId: "artist-profile-1",
        message: "I would love to play for the kids.",
      });

      expect(proposal.status).toBe("submitted");
    });

    it("denies creating a proposal with an empty slotId", () => {
      expect(() =>
        createProposal({
          id: "proposal-1",
          slotId: "",
          artistProfileId: "artist-profile-1",
          message: "Hi",
        }),
      ).toThrow(DomainValidationError);
    });

    it("MUST NOT be possible to construct a Proposal in a terminal state via a literal (compile-time enforced, M1)", () => {
      // @ts-expect-error - Proposal's brand field is not exported, so a
      // structural literal (even with every visible field, including a
      // terminal 'accepted' status) can never satisfy the Proposal type.
      // The only ways in are createProposal (forces 'submitted') and
      // rehydrateProposal (validates persisted data).
      const fabricated: Proposal = {
        id: "proposal-x",
        slotId: "slot-x",
        artistProfileId: "artist-x",
        message: "fabricated",
        status: "accepted",
      };

      expect(fabricated).toBeDefined();
    });
  });

  describe("message bounds (pr1-M2, T-15)", () => {
    it("rejects an empty message", () => {
      expect(() => submittedProposal({ message: "" })).toThrow(
        DomainValidationError,
      );
    });

    it("rejects a whitespace-only message", () => {
      expect(() => submittedProposal({ message: "   " })).toThrow(
        DomainValidationError,
      );
    });

    it("rejects a message longer than 2000 characters", () => {
      expect(() => submittedProposal({ message: "M".repeat(2001) })).toThrow(
        DomainValidationError,
      );
    });

    it("accepts a message at the 2000-character boundary", () => {
      const proposal = submittedProposal({ message: "M".repeat(2000) });

      expect(proposal.message).toHaveLength(2000);
    });

    it("normalises (trims) the stored message", () => {
      const proposal = submittedProposal({ message: "  Hello ward  " });

      expect(proposal.message).toBe("Hello ward");
    });

    it("rejects an over-bound message on rehydration too", () => {
      expect(() =>
        rehydrateProposal({
          id: "proposal-1",
          slotId: "slot-1",
          artistProfileId: "artist-profile-1",
          message: "M".repeat(2001),
          status: "submitted",
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("rehydrateProposal (M1: validated reconstruction from persisted data)", () => {
    it("rehydrates a proposal in 'accepted' state (a status createProposal can never produce)", () => {
      const proposal = rehydrateProposal({
        id: "proposal-1",
        slotId: "slot-1",
        artistProfileId: "artist-profile-1",
        message: "I would love to play for the kids.",
        status: "accepted",
      });

      expect(proposal.status).toBe("accepted");
    });

    it("rehydrates a proposal in 'rejected' state", () => {
      const proposal = rehydrateProposal({
        id: "proposal-1",
        slotId: "slot-1",
        artistProfileId: "artist-profile-1",
        message: "I would love to play for the kids.",
        status: "rejected",
      });

      expect(proposal.status).toBe("rejected");
    });

    it("denies rehydrating an invalid status", () => {
      expect(() =>
        rehydrateProposal({
          id: "proposal-1",
          slotId: "slot-1",
          artistProfileId: "artist-profile-1",
          message: "hi",
          // @ts-expect-error - deliberately invalid persisted status.
          status: "cancelled",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating an empty artistProfileId", () => {
      expect(() =>
        rehydrateProposal({
          id: "proposal-1",
          slotId: "slot-1",
          artistProfileId: "",
          message: "hi",
          status: "submitted",
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("acceptProposal (submitted -> accepted)", () => {
    it("transitions a submitted proposal to accepted", () => {
      const accepted = acceptProposal(submittedProposal());

      expect(accepted.status).toBe("accepted");
    });

    it("preserves proposal identity and data", () => {
      const accepted = acceptProposal(submittedProposal());

      expect(accepted.id).toBe("proposal-1");
      expect(accepted.slotId).toBe("slot-1");
      expect(accepted.artistProfileId).toBe("artist-profile-1");
      expect(accepted.message).toBe("I would love to play for the kids.");
    });

    it("does not mutate the original proposal", () => {
      const original = submittedProposal();

      acceptProposal(original);

      expect(original.status).toBe("submitted");
    });

    it("denies accepting an already accepted proposal", () => {
      const accepted = acceptProposal(submittedProposal());

      expect(() => acceptProposal(accepted)).toThrow(InvalidTransitionError);
    });

    it("denies accepting a rejected proposal", () => {
      const rejected = rejectProposal(submittedProposal());

      expect(() => acceptProposal(rejected)).toThrow(InvalidTransitionError);
    });
  });

  describe("rejectProposal (submitted -> rejected)", () => {
    it("transitions a submitted proposal to rejected", () => {
      const rejected = rejectProposal(submittedProposal());

      expect(rejected.status).toBe("rejected");
    });

    it("denies rejecting an already rejected proposal", () => {
      const rejected = rejectProposal(submittedProposal());

      expect(() => rejectProposal(rejected)).toThrow(InvalidTransitionError);
    });

    it("denies rejecting an accepted proposal", () => {
      const accepted = acceptProposal(submittedProposal());

      expect(() => rejectProposal(accepted)).toThrow(InvalidTransitionError);
    });
  });
});
