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
 * Rate-limited (M4), session-rotating (D7) login. The live Profile status
 * check and the session issuance happen inside the SAME
 * `ProfileUnitOfWork.withLockedProfile` transaction (M3) — a login racing a
 * concurrent Admin deactivation/rejection observes the committed transition
 * and is denied, never issues a session from a stale read.
 */
export async function login(
  credentials: LoginCredentials,
  deps: LoginDeps,
): Promise<LoginResult> {
  const attemptKey = { email: credentials.email };

  const allowed = await deps.rateLimiter.isAllowed(attemptKey);
  if (!allowed) {
    // Denied BEFORE verifying credentials — no session issued, no oracle.
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
  }

  const record = await deps.accounts.findByEmail(credentials.email);
  if (!record) {
    await deps.rateLimiter.recordFailure(attemptKey);
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
  }

  const validCredentials = await deps.passwordHasher.verify(
    credentials.password,
    record.passwordHash,
  );
  if (!validCredentials) {
    await deps.rateLimiter.recordFailure(attemptKey);
    throw new UnauthenticatedError(GENERIC_LOGIN_DENIAL);
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
