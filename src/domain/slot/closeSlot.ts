import { type Proposal, rejectProposal } from "../proposal/Proposal";
import type { Clock } from "../shared/Clock";
import { assertProposalsBelongToSlot } from "./linkage";
import { closeSlot as closeSlotTransition, type Slot } from "./Slot";

export interface CloseSlotInput {
  /** The Slot being withdrawn. Must be 'open'. */
  readonly slot: Slot;
  /** Every Proposal currently belonging to the Slot (may be empty). */
  readonly proposals: readonly Proposal[];
  readonly clock: Clock;
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
 */
export function closeSlot(input: CloseSlotInput): CloseSlotOutcome {
  assertProposalsBelongToSlot(input.slot, input.proposals);

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
