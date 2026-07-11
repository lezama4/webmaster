import { DomainValidationError } from "../errors";
import type { ProfileType } from "../profile/Profile";

export type AccountRole = "admin" | "hospital" | "artist" | "patient";

const ACCOUNT_ROLES: readonly AccountRole[] = [
  "admin",
  "hospital",
  "artist",
  "patient",
];

/**
 * Nominal brand (M1): a unique symbol, never exported, so outer code cannot
 * satisfy the `Account` type with a structural literal — the ONLY ways to
 * obtain an `Account` are `createAccount` and `rehydrateAccount` (both
 * validate their input). Type-only, erased at compile time, so `Account`
 * values stay plain, serializable objects.
 */
declare const ACCOUNT_BRAND: unique symbol;

/**
 * Lightweight identity (ADR D2). Credentials (password hash) stay outside
 * the domain — auth is an infrastructure concern (ADR D1).
 */
export type Account = {
  readonly id: string;
  readonly email: string;
  readonly role: AccountRole;
} & { readonly [ACCOUNT_BRAND]: "Account" };

export interface CreateAccountInput {
  readonly id: string;
  readonly email: string;
  readonly role: AccountRole;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Account ${field} must not be empty`);
  }
}

function assertValidRole(role: AccountRole): void {
  if (!ACCOUNT_ROLES.includes(role)) {
    throw new DomainValidationError(`Account role '${role}' is invalid`);
  }
}

/**
 * Creates a new Account. Account has no lifecycle states, but construction
 * still goes exclusively through this factory (M1) so every Account carries
 * a validated id/email/role, never a bare fabricated literal.
 */
export function createAccount(input: CreateAccountInput): Account {
  assertNonEmpty("id", input.id);
  assertNonEmpty("email", input.email);
  assertValidRole(input.role);

  return {
    id: input.id,
    email: input.email,
    role: input.role,
  } as Account;
}

/**
 * Rebuilds an Account from persisted data (M1), validating every field —
 * including the role, since a corrupt/invalid persisted value must fail
 * fast here rather than becoming a silently-accepted in-memory Account.
 */
export function rehydrateAccount(input: CreateAccountInput): Account {
  return createAccount(input);
}

/**
 * Only Hospital and Artist accounts go through Profile validation.
 * Admin governs; Patient browses anonymously-equivalent in Block 1 (D2).
 */
export function canHoldProfile(account: Account): boolean {
  return profileTypeForRole(account.role) !== null;
}

/** The Profile type a role registers as, or null when the role has none. */
export function profileTypeForRole(role: AccountRole): ProfileType | null {
  switch (role) {
    case "hospital":
      return "hospital";
    case "artist":
      return "artist";
    default:
      return null;
  }
}
