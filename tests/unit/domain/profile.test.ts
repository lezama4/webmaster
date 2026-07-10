import { describe, expect, it } from "vitest";

import { InvalidTransitionError } from "@domain/errors";
import {
  approveProfile,
  deactivateProfile,
  type Profile,
  reactivateProfile,
  rejectProfile,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

function pendingProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
    accountId: "account-1",
    type: "hospital",
    name: "Hospital San Juan",
    status: "pending",
    ...overrides,
  };
}

describe("Profile state machine", () => {
  describe("approveProfile (pending -> active)", () => {
    it("transitions a pending profile to active", () => {
      const approved = approveProfile(pendingProfile());

      expect(approved.status).toBe("active");
    });

    it("preserves the profile identity and data", () => {
      const approved = approveProfile(pendingProfile({ type: "artist", name: "Clara" }));

      expect(approved.id).toBe("profile-1");
      expect(approved.accountId).toBe("account-1");
      expect(approved.type).toBe("artist");
      expect(approved.name).toBe("Clara");
    });

    it("does not mutate the original profile", () => {
      const original = pendingProfile();

      approveProfile(original);

      expect(original.status).toBe("pending");
    });

    it("denies approving an already active profile", () => {
      const active = approveProfile(pendingProfile());

      expect(() => approveProfile(active)).toThrow(InvalidTransitionError);
    });

    it("denies approving a rejected profile", () => {
      const rejected = rejectProfile(pendingProfile());

      expect(() => approveProfile(rejected)).toThrow(InvalidTransitionError);
    });
  });

  describe("rejectProfile (pending -> rejected)", () => {
    it("transitions a pending profile to rejected", () => {
      const rejected = rejectProfile(pendingProfile());

      expect(rejected.status).toBe("rejected");
    });

    it("denies rejecting an already rejected profile", () => {
      const rejected = rejectProfile(pendingProfile());

      expect(() => rejectProfile(rejected)).toThrow(InvalidTransitionError);
    });

    it("denies rejecting an active profile", () => {
      const active = approveProfile(pendingProfile());

      expect(() => rejectProfile(active)).toThrow(InvalidTransitionError);
    });
  });

  describe("deactivateProfile (active -> deactivated, Admin M3)", () => {
    it("transitions an active profile to deactivated", () => {
      const active = approveProfile(pendingProfile());

      const deactivated = deactivateProfile(active);

      expect(deactivated.status).toBe("deactivated");
    });

    it("denies deactivating a pending profile", () => {
      expect(() => deactivateProfile(pendingProfile())).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies deactivating a rejected profile", () => {
      const rejected = rejectProfile(pendingProfile());

      expect(() => deactivateProfile(rejected)).toThrow(InvalidTransitionError);
    });

    it("denies deactivating an already deactivated profile", () => {
      const deactivated = deactivateProfile(approveProfile(pendingProfile()));

      expect(() => deactivateProfile(deactivated)).toThrow(
        InvalidTransitionError,
      );
    });
  });

  describe("reactivateProfile (rejected -> pending, re-registration M2)", () => {
    it("transitions a rejected profile back to pending", () => {
      const rejected = rejectProfile(pendingProfile());

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.status).toBe("pending");
    });

    it("reactivates the SAME profile (identity preserved, no new profile)", () => {
      const rejected = rejectProfile(pendingProfile());

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.id).toBe(rejected.id);
      expect(reactivated.accountId).toBe(rejected.accountId);
      expect(reactivated.type).toBe(rejected.type);
      expect(reactivated.name).toBe(rejected.name);
    });

    it("records the re-registration as a new review request (fresh timestamp)", () => {
      const rejected = rejectProfile(pendingProfile());

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.reviewRequestedAt).toEqual(NOW);
    });

    it("denies reactivating an active profile", () => {
      const active = approveProfile(pendingProfile());

      expect(() => reactivateProfile(active, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies reactivating a pending profile", () => {
      expect(() => reactivateProfile(pendingProfile(), fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies reactivating a deactivated profile (no reactivation path in Block 1)", () => {
      const deactivated = deactivateProfile(approveProfile(pendingProfile()));

      expect(() => reactivateProfile(deactivated, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("supports the full re-review loop: rejected -> pending -> active", () => {
      const rejected = rejectProfile(pendingProfile());
      const reReviewed = reactivateProfile(rejected, fixedClock);

      const approved = approveProfile(reReviewed);

      expect(approved.status).toBe("active");
    });
  });
});
