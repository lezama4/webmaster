/**
 * Rate-limit key: per-account AND per-client within a rolling window
 * (M4, pr2-review, ADR D7). `ipHash` is a truncated/hashed client address —
 * the raw IP never reaches the application layer or storage.
 */
export interface LoginAttemptKey {
  readonly email: string;
  readonly ipHash?: string;
}

/**
 * Brute-force guard port for `login` (M4, pr2-review). The Phase 4 adapter
 * is a Postgres-backed atomic counter/window shared across serverless
 * instances. When `isAllowed` returns false, the caller MUST respond with
 * the SAME generic error used for invalid credentials — no user-existence
 * or lockout oracle.
 */
export interface LoginRateLimiter {
  isAllowed(key: LoginAttemptKey): Promise<boolean>;
  recordFailure(key: LoginAttemptKey): Promise<void>;
  /** A successful login resets the rolling window for the key. */
  recordSuccess(key: LoginAttemptKey): Promise<void>;
}
