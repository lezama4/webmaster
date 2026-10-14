import { DomainValidationError } from "../errors";

/** Minimum length shown to users in the registration form hint. */
export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound so a hostile client cannot make Argon2 hash a huge input. */
export const PASSWORD_MAX_LENGTH = 128;

/** Why a password was rejected; the HTTP boundary maps it to a localizable code. */
export type PasswordPolicyReason = "too_short" | "too_long";

export class PasswordPolicyError extends DomainValidationError {
  constructor(readonly reason: PasswordPolicyReason) {
    super(`Password violates the policy: ${reason}`);
  }
}

/** Length is counted in characters (code points), not UTF-16 units. */
export function assertPasswordPolicy(password: string): void {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) throw new PasswordPolicyError("too_short");
  if (length > PASSWORD_MAX_LENGTH) throw new PasswordPolicyError("too_long");
}
