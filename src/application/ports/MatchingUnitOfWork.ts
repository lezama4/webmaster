import type { Event } from "@domain/event/Event";
import type { Profile } from "@domain/profile/Profile";
import type { Proposal } from "@domain/proposal/Proposal";
import type { Slot } from "@domain/slot/Slot";

/**
 * The state changes `work` asks the unit of work to persist before commit.
 * Everything here is written inside the SAME transaction that took the lock.
 */
export interface SlotMutation {
  /** Updated Slot to persist (state transition), if any. */
  readonly slot?: Slot;
  /** Proposals to upsert by id — new inserts and transitions alike. */
  readonly proposals?: readonly Proposal[];
  /** Event to insert (approve cascade), if any. */
  readonly event?: Event;
}

export interface LockedSlotOutcome<T> {
  readonly mutation: SlotMutation;
  /** What `withLockedSlot` resolves with after a successful commit. */
  readonly result: T;
}

/**
 * The decision callback. It receives the LIVE Slot, its COMPLETE Proposal
 * set, and the acting Account's LIVE Profile (or `null` if it has none) —
 * all three read INSIDE the same lock — never a pre-lock snapshot — and
 * MUST recompute every authorization/status guard and the pure domain
 * operation from that locked data (B2/M1, pr2-review, ADR D4). Throwing (or
 * rejecting) aborts the transaction: nothing is persisted, including the
 * Account/Profile lock, which is released on rollback.
 *
 * MAY be async: the callback typically calls `assertActiveProfile` on
 * `actorProfile` directly — the Profile authorization check and the Slot
 * persistence commit as ONE atomic unit (recheck-pr2a-verify-M2), so a
 * concurrent Admin deactivation of the SAME Account cannot land in between.
 */
export type LockedSlotWork<T> = (
  lockedSlot: Slot,
  proposals: readonly Proposal[],
  actorProfile: Profile | null,
) => LockedSlotOutcome<T> | Promise<LockedSlotOutcome<T>>;

/**
 * Lock-first coordination port (ADR D4, redesigned per review B2, unified
 * per recheck-pr2a-verify-M2). In ONE transaction the adapter MUST:
 * (1) lock the Slot row FIRST (e.g. `SELECT ... FOR UPDATE`) before any
 * decision-informing read; (2) load the live Slot + full Proposal set
 * inside that lock; (3) lock the acting Account row (`SELECT ... FOR
 * UPDATE`) and load its live Profile — SAME transaction, so the actor's
 * authorization is read under the same lock that guards the Slot mutation;
 * (4) invoke `work` with the locked Slot, the Proposal set, and the actor's
 * Profile; (5) persist the returned mutation before commit. A missing Slot
 * rejects with `NotFoundError`; guard failures inside `work`
 * (`ConflictError`, `ForbiddenError`, domain errors) propagate and roll the
 * whole transaction back — including the Account lock.
 *
 * Global lock order (deadlock-safety invariant): Slot FIRST, then Account.
 * `deactivateProfile`/`validateProfile`/`login` (via `ProfileUnitOfWork`)
 * only ever lock an Account, never a Slot afterward, so no operation in this
 * codebase acquires the reverse order (Account, then Slot) — no cycle is
 * possible between this port and `ProfileUnitOfWork`.
 *
 * This closes the gap the previous design left open: authorization
 * (reading the actor's Profile) and persistence (writing the Slot mutation)
 * used to run in TWO SEPARATE transactions — a nested
 * `ProfileUnitOfWork.withLockedProfile` call that committed and released
 * the Account lock BEFORE this port persisted the Slot mutation — letting a
 * concurrent Admin deactivation commit in that window and be missed by an
 * already-authorized-but-not-yet-persisted mutation. There is no such
 * window anymore: the Account lock is held for the Profile read AND for the
 * remainder of the transaction, through the final Slot/Proposal/Event
 * write.
 *
 * EVERY Slot-resolving use case that mutates an existing Slot —
 * submitProposal, approveProposal, rejectProposal, closeSlot — commits
 * exclusively through this port. (`publishSlot` has no existing Slot row to
 * lock and continues to coordinate solely through `ProfileUnitOfWork`.)
 */
export interface MatchingUnitOfWork {
  withLockedSlot<T>(
    slotId: string,
    actorAccountId: string,
    work: LockedSlotWork<T>,
  ): Promise<T>;
}
