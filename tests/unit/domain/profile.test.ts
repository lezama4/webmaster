import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  approveProfile,
  assertValidCentreType,
  CENTRE_TYPES,
  type CreateProfileInput,
  createProfile,
  deactivateProfile,
  type Profile,
  reactivateProfile,
  rehydrateProfile,
  rejectProfile,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";

const NOW = new Date("2026-07-10T12:00:00Z");

const fixedClock: Clock = { now: () => NOW };

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
