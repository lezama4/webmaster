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
 * instances. When `consumeAttempt` returns false, the caller MUST respond
 * with the SAME generic error used for invalid credentials — no
 * user-existence or lockout oracle.
 *
 * pr2b-B1 fix: the previous two-call protocol — a read-only `isAllowed`
 * check BEFORE verifying credentials, followed by a separate
 * `recordFailure` write AFTER a failed verification — let a concurrent
 * credential-stuffing burst observe "allowed" on every request before any
 * of them had recorded a failure, and the write itself (`findUnique` then
 * `upsert`/`update`) could lose counts under real concurrency. Both
 * problems are closed by collapsing the decision and the write into ONE
 * atomic `consumeAttempt` call: it ALWAYS increments-or-resets the rolling
 * window for every scoped key (email, and the client key when present) in
 * one database transaction, and returns whether the limit is now crossed.
 * Callers invoke it ONCE, before verifying credentials — a denial skips
 * verification entirely; an allowed attempt still proceeds to verify, and
 * `recordSuccess` resets the window on a successful login.
 */
export interface LoginRateLimiter {
  /** Atomically consumes one attempt; returns `false` once the limit is crossed (pr2b-B1). */
  consumeAttempt(key: LoginAttemptKey): Promise<boolean>;
  /** A successful login resets the rolling window for the key. */
  recordSuccess(key: LoginAttemptKey): Promise<void>;
}
