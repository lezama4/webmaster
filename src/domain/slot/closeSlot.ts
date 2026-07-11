import { type Proposal, rejectProposal } from "../proposal/Proposal";
import type { Clock } from "../shared/Clock";
import { assertValidSlotAggregate } from "./aggregate";
import { assertSlotOwnedBy, closeSlot as closeSlotTransition, type Slot } from "./Slot";

export interface CloseSlotInput {
  /** The Slot being withdrawn. Must be 'open'. */
  readonly slot: Slot;
  /** Every Proposal currently belonging to the Slot (may be empty). */
  readonly proposals: readonly Proposal[];
  readonly clock: Clock;
  /**
   * The acting Hospital's profile id (M2 — decision: ownership is a domain
   * rule). Denied with `NotSlotOwnerError` when it does not own the Slot.
   */
  readonly actingHospitalProfileId: string;
}

/**
 * The full state change the close decision produces. Persisting this
 * atomically is the MatchingUnitOfWork's job (infrastructure, ADR D4/B2).
 */
export interface CloseSlotOutcome {
  readonly slot: Slot;
  readonly rejectedProposals: readonly Proposal[];
  readonly occurredAt: Date;
}

/**
 * Pure domain operation (B2), mirroring `acceptProposal`'s shape: closing an
 * 'open' Slot transitions it to 'closed' AND explicitly cascade-rejects every
 * 'submitted' Proposal against it — no Proposal is left actionable against a
 * non-open Slot. No IO, no persistence.
 *
 * Ownership (M2) and aggregate consistency (M4) are enforced BEFORE any
 * transition is attempted.
 */
export function closeSlot(input: CloseSlotInput): CloseSlotOutcome {
  assertSlotOwnedBy(input.slot, input.actingHospitalProfileId);
  assertValidSlotAggregate(input.slot, input.proposals);

  const closedSlot = closeSlotTransition(input.slot);
  const rejectedProposals = input.proposals
    .filter((p) => p.status === "submitted")
    .map(rejectProposal);

  return {
    slot: closedSlot,
    rejectedProposals,
    occurredAt: input.clock.now(),
  };
}
