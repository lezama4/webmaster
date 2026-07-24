import type { Profile, ProfileReview } from "@domain/profile/Profile";
import type { SlotRepository } from "@application/ports/SlotRepository";
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
   * Persists an append-only `ProfileReview` row inside the SAME transaction
   * as `saveProfile` (ADR D23) — a status change without its attributed
   * review, or vice versa, must be impossible. No update/delete counterpart
   * exists: the only operation is appending a new row (ADR D21).
   */
  saveReview(review: ProfileReview): Promise<void>;
  /**
   * Transaction-scoped session operations: a status transition and its
   * `revokeAllForAccount`, or a live-status check and its `create`, are one
   * atomic unit — a failure between the two steps leaves no partial state.
   */
  readonly sessions: SessionPort;
  /**
   * Transaction-scoped Slot persistence. A Hospital authorization check and
   * its Slot publication commit (or roll back) in the same Account-locked
   * transaction, so deactivation cannot land between them.
   */
  readonly slots: SlotRepository;
}

export type LockedProfileWork<T> = (
  ctx: LockedProfileContext,
) => Promise<T> | T;

/**
 * Lock-first Profile/session/Slot coordination port (M3, pr2-review, ADR D7
 * — mirrors `MatchingUnitOfWork.withLockedSlot`). The adapter MUST lock the
 * Profile/Account row FIRST, load the live Profile inside that lock, then run
 * `work` and commit its Profile, Session, and Slot effects atomically. Used by
 * `deactivateProfile`, `validateProfile`, `login`, and `publishSlot` — so a
 * concurrent deactivation cannot land between authorization and a protected
 * side effect.
 */
export interface ProfileUnitOfWork {
  withLockedProfile<T>(
    accountId: string,
    work: LockedProfileWork<T>,
  ): Promise<T>;
}
