import type { ProfileType } from "../profile/Profile";

export type AccountRole = "admin" | "hospital" | "artist" | "patient";

/**
 * Lightweight identity (ADR D2). Credentials (password hash) stay outside
 * the domain — auth is an infrastructure concern (ADR D1).
 */
export interface Account {
  readonly id: string;
  readonly email: string;
  readonly role: AccountRole;
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
