import type { Account } from "@domain/account/Account";
import { UnauthenticatedError } from "@application/errors";
import type { AccountRepository } from "@application/ports/AccountRepository";
import type { LoginRateLimiter } from "@application/ports/LoginRateLimiter";
import type { PasswordHasher } from "@application/ports/PasswordHasher";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import type { Session } from "@application/ports/SessionPort";

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Delivery-boundary context for a single login attempt (pr2a-M2). `ipHash`
 * is a trusted, PRE-HASHED client key supplied by the route handler — never
 * the raw IP, and never derived inside this use case. Kept separate from
 * `LoginCredentials` (which is purely the user-supplied email/password) so
 * the boundary's job (hashing the client address) stays out of the
 * application layer's trust boundary for user input.
 */
export interface LoginContext {
  readonly ipHash?: string;
}

export interface LoginDeps {
  readonly accounts: AccountRepository;
  readonly passwordHasher: PasswordHasher;
  readonly rateLimiter: LoginRateLimiter;
  readonly profileUnitOfWork: ProfileUnitOfWork;
}

export interface LoginResult {
  readonly account: Account;
  readonly session: Session;
}

/**
 * Generic denial message (M4) — identical for an unknown account, invalid
 * credentials, a locked-out account, and a live-status denial (rejected /
 * deactivated Profile). No user-existence or lockout oracle.
 */
const GENERIC_LOGIN_DENIAL = "Invalid email or password";

/**
 * A fixed dummy password whose hash is computed ONCE (pr2a-M2) and reused
 * for every unknown-email login attempt, so that path performs the SAME
 * `passwordHasher.verify` work as the known-account/wrong-password path —
 * closing the timing oracle where an unknown email previously returned
 * immediately after a repository lookup, with no verification at all.
 */
const DUMMY_PASSWORD_FOR_TIMING_PARITY = "dummy-password-for-timing-parity-only";
let dummyHashPromise: Promise<string> | undefined;

function getDummyHash(hasher: PasswordHasher): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hasher.hash(DUMMY_PASSWORD_FOR_TIMING_PARITY);
  }
  return dummyHashPromise;
}

/**
 * Rate-limited (M4), session-rotating (D7) login. The live Profile status
 * check and the session issuance happen inside the SAME
 * `ProfileUnitOfWork.withLockedProfile` transaction (M3) — a login racing a
 * concurrent Admin deactivation/rejection observes the committed transition
 * and is denied, never issues a session from a stale read.
 *
 * pr2a-M2: every rate-limiter call is keyed by BOTH the email AND the
 * caller-supplied `context.ipHash` (when present) — the per-client half of
 * the brute-force control was previously unreachable because
 * `LoginCredentials` carried no client key. An unknown email now performs
 * an equivalent-cost `passwordHasher.verify` against a fixed dummy hash
 * before the generic denial, instead of returning immediately after the
 * repository miss — closing the account-existence timing oracle.
 *
 * pr2a-M3 (linearization DECISION): a login that reaches
 * `withLockedProfile` and commits BEFORE a racing deactivation's
 * transaction may resolve SUCCESSFULLY — but `revokeAllForAccount`
 * (deactivation's own atomic cascade) still revokes that just-issued
 * session immediately afterward. The caller receives a `LoginResult` in
 * that ordering, but the session is already invalid the moment the
 * deactivation commits. A login that reaches the lock AFTER the
 * deactivation committed observes the live `deactivated`/`rejected` status
 * and is denied outright. Both orderings are covered by
 * `tests/unit/application/login.test.ts`.
 */
export async function login(
  credentials: LoginCredentials,
  deps: LoginDeps,
  context: LoginContext = {},
): Promise<LoginResult> {
  const attemptKey = { email: credentials.email, ipHash: context.ipHash };

  // pr2b-B1: ONE atomic call — it ALWAYS records this attempt against the
  // rolling window (increment-or-reset) and returns whether the limit is
  // now crossed, in the SAME database operation. This replaces the former
  // isAllowed()-then-later-recordFailure() split, which let a concurrent
  // burst all observe "allowed" before any of them had recorded a failure,
  // and whose separate write could lose counts under real concurrency.
  const allowed = await deps.rateLimiter.consumeAttempt(attemptKey);
  if (!allowed) {
    // Denied BEFORE verifying credentials — no session issued, no oracle.
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
  }

  const record = await deps.accounts.findByEmail(credentials.email);
  if (!record) {
    // pr2a-M2: burn the SAME verification cost as a wrong-password denial
    // on a known account — no account-existence timing oracle. The
    // attempt was already recorded by consumeAttempt above.
    await deps.passwordHasher.verify(
      credentials.password,
      await getDummyHash(deps.passwordHasher),
    );
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
  }

  const validCredentials = await deps.passwordHasher.verify(
    credentials.password,
    record.passwordHash,
  );
  if (!validCredentials) {
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
  }

  if (deps.passwordHasher.needsRehash(record.passwordHash)) {
    // pr2b-M2 (upgrade-on-login): re-hash at the current baseline and
    // persist it — no forced password reset, no dedicated migration.
    const upgradedHash = await deps.passwordHasher.hash(credentials.password);
    await deps.accounts.save({
      account: record.account,
      passwordHash: upgradedHash,
    });
  }

  const session = await deps.profileUnitOfWork.withLockedProfile(
    record.account.id,
    async (ctx) => {
      // Accounts with no Profile (Admin, Patient — D2) always pass.
      if (
        ctx.profile &&
        (ctx.profile.status === "rejected" ||
          ctx.profile.status === "deactivated")
      ) {
        throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
      }
      return ctx.sessions.create(record.account.id);
    },
  );

  await deps.rateLimiter.recordSuccess(attemptKey);
  return { account: record.account, session };
}
