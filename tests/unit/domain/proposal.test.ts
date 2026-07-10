import { describe, expect, it } from "vitest";

import { InvalidTransitionError } from "@domain/errors";
import {
  acceptProposal,
  type Proposal,
  rejectProposal,
} from "@domain/proposal/Proposal";

function submittedProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-1",
    slotId: "slot-1",
    artistProfileId: "artist-profile-1",
    message: "I would love to play for the kids.",
    status: "submitted",
    ...overrides,
  };
}

describe("Proposal state machine", () => {
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
