import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  approveProfile,
  assertValidCentreType,
  assertValidReviewDecision,
  CENTRE_TYPES,
  type CreateProfileInput,
  createProfile,
  deactivateProfile,
  MAX_REVIEW_BASIS_LENGTH,
  type Profile,
  reactivateProfile,
  rehydrateProfile,
  rejectProfile,
  REVIEW_DECISIONS,
  type ReviewInput,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

/**
 * A valid `ReviewInput` for the three admin transitions (D21-D24). Tests
 * that only care about the resulting Profile status use this as-is; tests
 * that assert on the review's fields override individual keys.
 */
const REVIEW: ReviewInput = {
  adminAccountId: "admin-1",
  basis: "Convenio VTT-2026-014 confirmed by phone with the centre's named contact.",
  reviewId: "review-1",
};

function pendingProfile(overrides: Partial<CreateProfileInput> = {}): Profile {
  const type = overrides.type ?? "centre";
  return createProfile({
    id: "profile-1",
    accountId: "account-1",
    name: "Hospital San Juan",
    ...(type === "centre" ? { centreType: "hospital" } : {}),
    type,
    ...overrides,
  });
}

describe("Profile state machine", () => {
  describe("createProfile (M1: forces the initial state)", () => {
    it("always creates a profile in 'pending' state", () => {
      const profile = createProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
      });

      expect(profile.status).toBe("pending");
    });

    it("denies creating a profile with an empty id", () => {
      expect(() =>
        createProfile({
          id: "",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies creating a profile with an empty name", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "   ",
        }),
      ).toThrow(DomainValidationError);
    });

    it("MUST NOT be possible to construct a Profile in a privileged or terminal state via a literal (compile-time enforced, M1)", () => {
      // @ts-expect-error - Profile's brand field is not exported, so a
      // structural literal (even with every visible field, including a
      // privileged 'active' status) can never satisfy the Profile type.
      // The only ways in are createProfile (forces 'pending') and
      // rehydrateProfile (validates persisted data).
      const fabricated: Profile = {
        id: "profile-x",
        accountId: "account-x",
        type: "centre",
        centreType: "hospital",
        name: "Fabricated Hospital",
        status: "active",
      };

      expect(fabricated).toBeDefined();
    });
  });

  describe("centreType invariant (D16, widen-beyond-hospitals): type and centreType are coupled at exactly one point", () => {
    it("createProfile denies a 'centre' Profile with no centreType", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          name: "Residencia Aranzazu",
        }),
      ).toThrow(DomainValidationError);
    });

    it("createProfile accepts a 'centre' Profile with each of the six known centreType values", () => {
      const centreTypes = [
        "hospital",
        "nursing_home",
        "day_centre",
        "day_hospital",
        "occupational_centre",
        "palliative_unit",
      ] as const;

      for (const centreType of centreTypes) {
        const profile = createProfile({
          id: `profile-${centreType}`,
          accountId: "account-1",
          type: "centre",
          centreType,
          name: "A Centre",
        });
        expect(profile.centreType).toBe(centreType);
      }
    });

    it("createProfile denies a 'centre' Profile with an unknown centreType string", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          // @ts-expect-error - deliberately invalid centreType.
          centreType: "prison",
          name: "Residencia Aranzazu",
        }),
      ).toThrow(DomainValidationError);
    });

    it("createProfile denies an 'artist' Profile that carries a centreType", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "artist",
          centreType: "hospital",
          name: "Clara Romero",
        }),
      ).toThrow(DomainValidationError);
    });

    it("createProfile leaves centreType undefined for an 'artist' Profile", () => {
      const profile = createProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "artist",
        name: "Clara Romero",
      });

      expect(profile.centreType).toBeUndefined();
    });

    it("rehydrateProfile enforces the same invariant on persisted data", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          name: "Residencia Aranzazu",
          status: "active",
        }),
      ).toThrow(DomainValidationError);
    });

    it("rehydrateProfile round-trips a valid centreType", () => {
      const profile = rehydrateProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "palliative_unit",
        name: "UCP Ría",
        status: "active",
      });

      expect(profile.centreType).toBe("palliative_unit");
    });
  });

  describe("assertValidCentreType (D16)", () => {
    it("accepts each of the six known CentreType values", () => {
      for (const centreType of CENTRE_TYPES) {
        expect(() => assertValidCentreType(centreType)).not.toThrow();
      }
    });

    it("rejects an unknown string", () => {
      expect(() => assertValidCentreType("prison")).toThrow(DomainValidationError);
    });

    it("rejects an empty string", () => {
      expect(() => assertValidCentreType("")).toThrow(DomainValidationError);
    });
  });

  describe("rehydrateProfile (M1: validated reconstruction from persisted data)", () => {
    it("rehydrates a profile in 'active' state (a status createProfile can never produce)", () => {
      const profile = rehydrateProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        status: "active",
      });

      expect(profile.status).toBe("active");
    });

    it("rehydrates a profile in 'deactivated' state", () => {
      const profile = rehydrateProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        status: "deactivated",
      });

      expect(profile.status).toBe("deactivated");
    });

    it("rehydrates a profile with a reviewRequestedAt timestamp, cloning it", () => {
      const original = new Date("2026-01-01T00:00:00Z");

      const profile = rehydrateProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        status: "pending",
        reviewRequestedAt: original,
      });

      expect(profile.reviewRequestedAt).toEqual(original);
      expect(profile.reviewRequestedAt).not.toBe(original);
    });

    it("denies rehydrating an invalid status", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          // @ts-expect-error - deliberately invalid persisted status.
          status: "banned",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating an invalid type", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "account-1",
          // @ts-expect-error - deliberately invalid persisted type.
          type: "patient",
          name: "Hospital San Juan",
          status: "pending",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating an empty accountId", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          status: "pending",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating a non-finite reviewRequestedAt", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          status: "pending",
          reviewRequestedAt: new Date(NaN),
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe("approveProfile (pending -> active)", () => {
    it("transitions a pending profile to active", () => {
      const { profile: approved } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(approved.status).toBe("active");
    });

    it("preserves the profile identity and data", () => {
      const { profile: approved } = approveProfile(
        pendingProfile({ type: "artist", name: "Clara" }),
        REVIEW,
        fixedClock,
      );

      expect(approved.id).toBe("profile-1");
      expect(approved.accountId).toBe("account-1");
      expect(approved.type).toBe("artist");
      expect(approved.name).toBe("Clara");
    });

    it("does not mutate the original profile", () => {
      const original = pendingProfile();

      approveProfile(original, REVIEW, fixedClock);

      expect(original.status).toBe("pending");
    });

    it("denies approving an already active profile", () => {
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(() => approveProfile(active, REVIEW, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies approving a rejected profile", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(() => approveProfile(rejected, REVIEW, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });
  });

  describe("rejectProfile (pending -> rejected)", () => {
    it("transitions a pending profile to rejected", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(rejected.status).toBe("rejected");
    });

    it("denies rejecting an already rejected profile", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(() => rejectProfile(rejected, REVIEW, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies rejecting an active profile", () => {
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(() => rejectProfile(active, REVIEW, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });
  });

  describe("deactivateProfile (active -> deactivated, Admin M3)", () => {
    it("transitions an active profile to deactivated", () => {
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      const { profile: deactivated } = deactivateProfile(
        active,
        REVIEW,
        fixedClock,
      );

      expect(deactivated.status).toBe("deactivated");
    });

    it("denies deactivating a pending profile", () => {
      expect(() =>
        deactivateProfile(pendingProfile(), REVIEW, fixedClock),
      ).toThrow(InvalidTransitionError);
    });

    it("denies deactivating a rejected profile", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      expect(() => deactivateProfile(rejected, REVIEW, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("denies deactivating an already deactivated profile", () => {
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );
      const { profile: deactivated } = deactivateProfile(
        active,
        REVIEW,
        fixedClock,
      );

      expect(() =>
        deactivateProfile(deactivated, REVIEW, fixedClock),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("reactivateProfile (rejected -> pending, re-registration M2)", () => {
    it("transitions a rejected profile back to pending", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.status).toBe("pending");
    });

    it("reactivates the SAME profile (identity preserved, no new profile)", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.id).toBe(rejected.id);
      expect(reactivated.accountId).toBe(rejected.accountId);
      expect(reactivated.type).toBe(rejected.type);
      expect(reactivated.name).toBe(rejected.name);
    });

    it("records the re-registration as a new review request (fresh timestamp)", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.reviewRequestedAt).toEqual(NOW);
    });

    it("denies reactivating an active profile", () => {
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

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
      const { profile: active } = approveProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );
      const { profile: deactivated } = deactivateProfile(
        active,
        REVIEW,
        fixedClock,
      );

      expect(() => reactivateProfile(deactivated, fixedClock)).toThrow(
        InvalidTransitionError,
      );
    });

    it("supports the full re-review loop: rejected -> pending -> active", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );
      const reReviewed = reactivateProfile(rejected, fixedClock);

      const { profile: approved } = approveProfile(
        reReviewed,
        REVIEW,
        fixedClock,
      );

      expect(approved.status).toBe("active");
    });

    it("(D22 regression pin) takes only (profile, clock) and returns a bare Profile — no third argument, no 'review' in its return", () => {
      const { profile: rejected } = rejectProfile(
        pendingProfile(),
        REVIEW,
        fixedClock,
      );

      const reactivated = reactivateProfile(rejected, fixedClock);

      expect(reactivated.status).toBe("pending");
      expect((reactivated as unknown as { review?: unknown }).review).toBeUndefined();
    });
  });

  describe("ProfileReview (D21-D24): approve/reject/deactivate require and record an attributed basis", () => {
    function activeProfile(): Profile {
      return approveProfile(pendingProfile(), REVIEW, fixedClock).profile;
    }

    describe("a blank or whitespace-only basis is denied BEFORE any status change", () => {
      it.each(["", "   "])("approveProfile denies basis %j", (basis) => {
        const profile = pendingProfile();

        expect(() =>
          approveProfile(profile, { ...REVIEW, basis }, fixedClock),
        ).toThrow(DomainValidationError);
        expect(profile.status).toBe("pending");
      });

      it.each(["", "   "])("rejectProfile denies basis %j", (basis) => {
        const profile = pendingProfile();

        expect(() =>
          rejectProfile(profile, { ...REVIEW, basis }, fixedClock),
        ).toThrow(DomainValidationError);
        expect(profile.status).toBe("pending");
      });

      it.each(["", "   "])("deactivateProfile denies basis %j", (basis) => {
        const profile = activeProfile();

        expect(() =>
          deactivateProfile(profile, { ...REVIEW, basis }, fixedClock),
        ).toThrow(DomainValidationError);
        expect(profile.status).toBe("active");
      });
    });

    it("(scripted-request scenario) a direct domain call with an empty basis is denied identically — the domain, not the UI, is the authoritative gate", () => {
      const profile = pendingProfile();

      expect(() =>
        approveProfile(profile, { ...REVIEW, basis: "" }, fixedClock),
      ).toThrow(DomainValidationError);
    });

    it("rejects a basis whose trimmed length exceeds MAX_REVIEW_BASIS_LENGTH", () => {
      const profile = pendingProfile();
      const overLong = "a".repeat(MAX_REVIEW_BASIS_LENGTH + 1);

      expect(() =>
        approveProfile(profile, { ...REVIEW, basis: overLong }, fixedClock),
      ).toThrow(DomainValidationError);
      expect(profile.status).toBe("pending");
    });

    it("accepts a basis exactly at the MAX_REVIEW_BASIS_LENGTH bound", () => {
      const profile = pendingProfile();
      const maxBasis = "a".repeat(MAX_REVIEW_BASIS_LENGTH);

      const { review } = approveProfile(
        profile,
        { ...REVIEW, basis: maxBasis },
        fixedClock,
      );

      expect(review.basis).toBe(maxBasis);
    });

    it("the basis is trimmed once, validated trimmed, and stored trimmed", () => {
      const profile = pendingProfile();

      const { review } = approveProfile(
        profile,
        { ...REVIEW, basis: `  ${REVIEW.basis}  ` },
        fixedClock,
      );

      expect(review.basis).toBe(REVIEW.basis);
    });

    it("approveProfile returns both the transitioned profile and an attributed 'approve' review", () => {
      const profile = pendingProfile();

      const { profile: updated, review } = approveProfile(
        profile,
        REVIEW,
        fixedClock,
      );

      expect(updated.status).toBe("active");
      expect(review.profileId).toBe(profile.id);
      expect(review.adminAccountId).toBe(REVIEW.adminAccountId);
      expect(review.basis).toBe(REVIEW.basis);
      expect(review.at).toEqual(NOW);
      expect(review.decision).toBe("approve");
    });

    it("rejectProfile returns both the transitioned profile and an attributed 'reject' review", () => {
      const profile = pendingProfile();

      const { profile: updated, review } = rejectProfile(
        profile,
        REVIEW,
        fixedClock,
      );

      expect(updated.status).toBe("rejected");
      expect(review.adminAccountId).toBe(REVIEW.adminAccountId);
      expect(review.basis).toBe(REVIEW.basis);
      expect(review.at).toEqual(NOW);
      expect(review.decision).toBe("reject");
    });

    it("deactivateProfile returns both the transitioned profile and an attributed 'deactivate' review", () => {
      const profile = activeProfile();

      const { profile: updated, review } = deactivateProfile(
        profile,
        REVIEW,
        fixedClock,
      );

      expect(updated.status).toBe("deactivated");
      expect(review.adminAccountId).toBe(REVIEW.adminAccountId);
      expect(review.basis).toBe(REVIEW.basis);
      expect(review.at).toEqual(NOW);
      expect(review.decision).toBe("deactivate");
    });

    it("a client-supplied admin id has no bearing on anything but the argument passed — the recorded id is whatever the caller (the resolved session, per D23) supplied", () => {
      const profile = pendingProfile();

      const { review } = approveProfile(
        profile,
        { ...REVIEW, adminAccountId: "admin-live-session-id" },
        fixedClock,
      );

      expect(review.adminAccountId).toBe("admin-live-session-id");
    });
  });

  describe("assertValidReviewDecision (D21)", () => {
    it("accepts each of the three known ReviewDecision values", () => {
      for (const decision of REVIEW_DECISIONS) {
        expect(() => assertValidReviewDecision(decision)).not.toThrow();
      }
    });

    it("rejects an unknown string", () => {
      expect(() => assertValidReviewDecision("revoke")).toThrow(
        DomainValidationError,
      );
    });

    it("rejects an empty string", () => {
      expect(() => assertValidReviewDecision("")).toThrow(
        DomainValidationError,
      );
    });
  });

  describe("public location (Phase 2 — hospital public location)", () => {
    it("createProfile without any location fields leaves them all undefined", () => {
      const profile = pendingProfile();

      expect(profile.city).toBeUndefined();
      expect(profile.postalCode).toBeUndefined();
      expect(profile.addressLine).toBeUndefined();
      expect(profile.latitude).toBeUndefined();
      expect(profile.longitude).toBeUndefined();
    });

    it("createProfile accepts a full, valid public location for a hospital", () => {
      const profile = createProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        city: "Bilbao",
        postalCode: "48013",
        addressLine: "Plaza de Cruces, 12",
        latitude: 43.263,
        longitude: -2.935,
      });

      expect(profile.city).toBe("Bilbao");
      expect(profile.postalCode).toBe("48013");
      expect(profile.addressLine).toBe("Plaza de Cruces, 12");
      expect(profile.latitude).toBe(43.263);
      expect(profile.longitude).toBe(-2.935);
    });

    it("createProfile accepts a partial location (e.g. city only, no coordinates yet)", () => {
      const profile = createProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        city: "Bilbao",
      });

      expect(profile.city).toBe("Bilbao");
      expect(profile.latitude).toBeUndefined();
      expect(profile.longitude).toBeUndefined();
    });

    it("denies a latitude above the valid range (> 90)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: 90.5,
          longitude: 0,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies a latitude below the valid range (< -90)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: -90.5,
          longitude: 0,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies a longitude above the valid range (> 180)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: 0,
          longitude: 180.5,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies a longitude below the valid range (< -180)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: 0,
          longitude: -180.5,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies a non-finite latitude (NaN)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: Number.NaN,
          longitude: 0,
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies a non-finite longitude (Infinity)", () => {
      expect(() =>
        createProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          latitude: 0,
          longitude: Number.POSITIVE_INFINITY,
        }),
      ).toThrow(DomainValidationError);
    });

    it("accepts the boundary values -90/-180 and 90/180", () => {
      const south = createProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        latitude: -90,
        longitude: -180,
      });
      const north = createProfile({
        id: "profile-2",
        accountId: "account-2",
        type: "centre",
        centreType: "hospital",
        name: "Hospital Esperanza",
        latitude: 90,
        longitude: 180,
      });

      expect(south.latitude).toBe(-90);
      expect(south.longitude).toBe(-180);
      expect(north.latitude).toBe(90);
      expect(north.longitude).toBe(180);
    });

    it("rehydrateProfile round-trips every location field", () => {
      const profile = rehydrateProfile({
        id: "profile-1",
        accountId: "account-1",
        type: "centre",
        centreType: "hospital",
        name: "Hospital San Juan",
        status: "active",
        city: "Bilbao",
        postalCode: "48013",
        addressLine: "Plaza de Cruces, 12",
        latitude: 43.263,
        longitude: -2.935,
      });

      expect(profile.city).toBe("Bilbao");
      expect(profile.postalCode).toBe("48013");
      expect(profile.addressLine).toBe("Plaza de Cruces, 12");
      expect(profile.latitude).toBe(43.263);
      expect(profile.longitude).toBe(-2.935);
    });

    it("rehydrateProfile denies an invalid persisted latitude", () => {
      expect(() =>
        rehydrateProfile({
          id: "profile-1",
          accountId: "account-1",
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan",
          status: "active",
          latitude: 200,
          longitude: 0,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
