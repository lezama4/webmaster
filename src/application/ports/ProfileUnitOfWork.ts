import type { Profile } from "@domain/profile/Profile";
import type { SessionPort } from "./SessionPort";

/**
 * Transaction-scoped context handed to `work`. Everything done through it
 * commits (or rolls back) atomically with the lock-holding transaction.
 */
export interface LockedProfileContext {
  /** The LIVE Profile read INSIDE the lock, or null when the account has none. */
  readonly profile: Profile | null;
  /** Persists a Profile status transition inside the same transaction. */
  saveProfile(profile: Profile): Promise<void>;
  /**
   * Transaction-scoped session operations: a status transition and its
   * `revokeAllForAccount`, or a live-status check and its `create`, are one
   * atomic unit — a failure between the two steps leaves no partial state.
   */
  readonly sessions: SessionPort;
}

export type LockedProfileWork<T> = (
  ctx: LockedProfileContext,
) => Promise<T> | T;

/**
 * Lock-first Profile/session coordination port (M3, pr2-review, ADR D7 —
 * mirrors `MatchingUnitOfWork.withLockedSlot`). The adapter MUST lock the
 * Profile/Account row FIRST, load the live Profile inside that lock, then
 * run `work` and commit its effects atomically. Used by `deactivateProfile`,
 * `validateProfile`, and `login` — so a login racing a concurrent
 * deactivation observes the committed transition and is denied.
 */
export interface ProfileUnitOfWork {
  withLockedProfile<T>(
    accountId: string,
    work: LockedProfileWork<T>,
  ): Promise<T>;
}
