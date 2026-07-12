/**
 * A live authenticated session (DB-backed, ADR D1/D7/D8). The id is an
 * opaque, CSPRNG-generated value; the persisted row stores only its hash.
 */
export interface Session {
  readonly id: string;
  readonly accountId: string;
  readonly createdAt: Date;
  /** Idle-expiry basis — bumped by `touch` on every authenticated request. */
  readonly lastActiveAt: Date;
  readonly absoluteExpiresAt: Date;
}

/**
 * Session lifecycle port (M3, pr2-review, ADR D7).
 *
 * - `create` ALWAYS issues a fresh id (rotation on login — never reuses or
 *   extends a pre-auth session id, mitigating fixation).
 * - `resolveValid` returns null on absolute expiry, idle expiry, or
 *   not-found; callers MUST treat null as unauthenticated.
 * - `touch` (pr2b-M1) is conditional on BOTH absolute AND idle validity —
 *   never on absolute expiry alone — and returns `false` on a zero-row
 *   update (not found, or expired by either clock), which callers MUST
 *   treat as unauthenticated, identically to a null `resolveValid`.
 * - `revokeOne` (logout) and `revokeAllForAccount` (Admin deactivation /
 *   rejection) DELETE rows — revocation is immediate, not cookie-clearing.
 */
export interface SessionPort {
  create(accountId: string): Promise<Session>;
  resolveValid(sessionId: string): Promise<Session | null>;
  /** Returns `true` if the session was live (both absolute- and idle-valid) and its idle clock was reset; `false` (unauthenticated) otherwise. */
  touch(sessionId: string): Promise<boolean>;
  revokeOne(sessionId: string): Promise<void>;
  revokeAllForAccount(accountId: string): Promise<void>;
}
