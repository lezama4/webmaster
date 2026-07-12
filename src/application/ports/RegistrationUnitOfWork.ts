import type { Account } from "@domain/account/Account";
import type { Profile } from "@domain/profile/Profile";

/** The existing Account + credential hash + Profile (if any) for an email, read LIVE inside the lock. */
export interface ExistingRegistration {
  readonly account: Account;
  readonly passwordHash: string;
  /** `null` when the Account has no Profile yet (unexpected but harmless, D2). */
  readonly profile: Profile | null;
}

/**
 * Transaction-scoped context handed to `work`. Everything done through it
 * commits (or rolls back) atomically with the lock-holding transaction —
 * closes the pr2a-M5 gap where Account creation and Profile creation were
 * two separate, unguarded writes.
 */
export interface LockedRegistrationContext {
  /** The LIVE Account+Profile for the requested email, or `null` if unused. */
  readonly existing: ExistingRegistration | null;
  /** Persists a brand-new Account + Profile pair atomically (fresh registration). */
  createAccountAndProfile(
    account: Account,
    passwordHash: string,
    profile: Profile,
  ): Promise<void>;
  /** Persists a Profile transition/creation for an EXISTING Account atomically (reactivation, or a Profile-less Account backfill). */
  saveProfile(profile: Profile): Promise<void>;
}

export type RegistrationWork<T> = (
  ctx: LockedRegistrationContext,
) => Promise<T> | T;

/**
 * Lock-first registration coordination port (pr2a-M5, mirrors
 * `MatchingUnitOfWork`/`ProfileUnitOfWork`). The adapter MUST: (1) lock on
 * `email` FIRST (e.g. a unique index / advisory lock) before any
 * decision-informing read; (2) load the live Account+credential+Profile for
 * that email inside the lock; (3) invoke `work`; (4) persist whatever
 * `work` did through `ctx`, atomically, before commit. A durable
 * email/Profile uniqueness violation that slips past the application-layer
 * check (a genuine concurrent registration for the same email) MUST surface
 * as `ConflictError`, never a raw persistence error.
 */
export interface RegistrationUnitOfWork {
  withLockedRegistration<T>(
    email: string,
    work: RegistrationWork<T>,
  ): Promise<T>;
}
