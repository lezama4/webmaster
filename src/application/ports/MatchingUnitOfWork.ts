import type { Event } from "@domain/event/Event";
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
 * The decision callback. It receives the LIVE Slot and its COMPLETE Proposal
 * set, both read INSIDE the lock — never a pre-lock snapshot — and MUST
 * recompute every authorization/status guard and the pure domain operation
 * from that locked data (B2/M1, pr2-review, ADR D4). Throwing (or rejecting)
 * aborts the transaction: nothing is persisted.
 *
 * MAY be async (pr2a-M1): a Slot-mutating use case re-checks the acting
 * Profile's LIVE status via `ProfileUnitOfWork.withLockedProfile` FROM
 * WITHIN this callback — inside the SAME transaction that commits the Slot
 * decision — rather than from a separate pre-lock read that a concurrent
 * Admin deactivation/rejection could race.
 */
export type LockedSlotWork<T> = (
  lockedSlot: Slot,
  proposals: readonly Proposal[],
) => LockedSlotOutcome<T> | Promise<LockedSlotOutcome<T>>;

/**
 * Lock-first coordination port (ADR D4, redesigned per review B2). In ONE
 * transaction the adapter MUST: (1) lock the Slot row FIRST (e.g.
 * `SELECT ... FOR UPDATE`) before any decision-informing read; (2) load the
 * live Slot + full Proposal set inside that lock; (3) invoke `work`;
 * (4) persist the returned mutation before commit. A missing Slot rejects
 * with `NotFoundError`; guard failures inside `work` (`ConflictError`,
 * `ForbiddenError`, domain errors) propagate and roll the transaction back.
 *
 * EVERY Slot-resolving use case — submitProposal, approveProposal,
 * rejectProposal, closeSlot — commits exclusively through this port.
 */
export interface MatchingUnitOfWork {
  withLockedSlot<T>(slotId: string, work: LockedSlotWork<T>): Promise<T>;
}
