import { describe, expect, it } from "vitest";

import {
  type Account,
  canHoldProfile,
  profileTypeForRole,
} from "@domain/account/Account";

function account(role: Account["role"]): Account {
  return { id: "account-1", email: "someone@vtt.test", role };
}

describe("Account", () => {
  describe("canHoldProfile", () => {
    it("allows a hospital account to hold a profile", () => {
      expect(canHoldProfile(account("hospital"))).toBe(true);
    });

    it("allows an artist account to hold a profile", () => {
      expect(canHoldProfile(account("artist"))).toBe(true);
    });

    it("denies an admin account a profile", () => {
      expect(canHoldProfile(account("admin"))).toBe(false);
    });

    it("denies a patient account a profile (Block 1: anonymous-equivalent browsing)", () => {
      expect(canHoldProfile(account("patient"))).toBe(false);
    });
  });

  describe("profileTypeForRole", () => {
    it("maps the hospital role to the hospital profile type", () => {
      expect(profileTypeForRole("hospital")).toBe("hospital");
    });

    it("maps the artist role to the artist profile type", () => {
      expect(profileTypeForRole("artist")).toBe("artist");
    });

    it("yields no profile type for admin or patient roles", () => {
      expect(profileTypeForRole("admin")).toBeNull();
      expect(profileTypeForRole("patient")).toBeNull();
    });
  });
});
