import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import {
  type Account,
  canHoldProfile,
  createAccount,
  profileTypeForRole,
  rehydrateAccount,
} from "@domain/account/Account";

function account(role: Account["role"]): Account {
  return createAccount({ id: "account-1", email: "someone@vtt.test", role });
}

describe("Account", () => {
  describe("createAccount (M1: construction only through the factory)", () => {
    it("creates an account with the given fields", () => {
      const created = createAccount({
        id: "account-1",
        email: "someone@vtt.test",
        role: "hospital",
      });

      expect(created.id).toBe("account-1");
      expect(created.email).toBe("someone@vtt.test");
      expect(created.role).toBe("hospital");
    });

    it("denies creating an account with an empty email", () => {
      expect(() =>
        createAccount({ id: "account-1", email: "  ", role: "hospital" }),
      ).toThrow(DomainValidationError);
    });

    it("MUST NOT be possible to construct an Account via a literal (compile-time enforced, M1)", () => {
      // @ts-expect-error - Account's brand field is not exported, so a
      // structural literal can never satisfy the Account type. The only
      // ways in are createAccount and rehydrateAccount.
      const fabricated: Account = {
        id: "account-x",
        email: "fabricated@vtt.test",
        role: "admin",
      };

      expect(fabricated).toBeDefined();
    });
  });

  describe("rehydrateAccount (M1: validated reconstruction from persisted data)", () => {
    it("rehydrates a valid account", () => {
      const rehydrated = rehydrateAccount({
        id: "account-1",
        email: "someone@vtt.test",
        role: "artist",
      });

      expect(rehydrated.role).toBe("artist");
    });

    it("denies rehydrating an invalid role", () => {
      expect(() =>
        rehydrateAccount({
          id: "account-1",
          email: "someone@vtt.test",
          // @ts-expect-error - deliberately invalid persisted role.
          role: "superadmin",
        }),
      ).toThrow(DomainValidationError);
    });

    it("denies rehydrating an empty id", () => {
      expect(() =>
        rehydrateAccount({ id: "", email: "someone@vtt.test", role: "admin" }),
      ).toThrow(DomainValidationError);
    });
  });

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
