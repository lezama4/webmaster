import { describe, expect, it } from "vitest";

import {
  assertPasswordPolicy,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordPolicyError,
} from "@domain/account/Password";
import { DomainValidationError } from "@domain/errors";

describe("assertPasswordPolicy", () => {
  it("accepts the boundary lengths", () => {
    expect(() => assertPasswordPolicy("a".repeat(PASSWORD_MIN_LENGTH))).not.toThrow();
    expect(() => assertPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH))).not.toThrow();
  });

  it("rejects a password one character short, including the empty string", () => {
    for (const pw of ["", "a".repeat(PASSWORD_MIN_LENGTH - 1)]) {
      expect(() => assertPasswordPolicy(pw)).toThrow(PasswordPolicyError);
      try {
        assertPasswordPolicy(pw);
      } catch (e) {
        expect((e as PasswordPolicyError).reason).toBe("too_short");
        expect(e).toBeInstanceOf(DomainValidationError);
      }
    }
  });

  it("rejects a password one character too long", () => {
    expect(() => assertPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1))).toThrow(
      expect.objectContaining({ reason: "too_long" }),
    );
  });

  it("counts characters, not UTF-16 units (emoji are one character)", () => {
    expect(() => assertPasswordPolicy("😀".repeat(PASSWORD_MIN_LENGTH))).not.toThrow();
    expect(() => assertPasswordPolicy("😀".repeat(PASSWORD_MAX_LENGTH))).not.toThrow();
  });
});
