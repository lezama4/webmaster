import { DomainValidationError } from "../errors";
import type { Proposal } from "../proposal/Proposal";
import { assertProposalsBelongToSlot } from "./linkage";
import type { Slot } from "./Slot";

/**
 * Validates that a Slot + its (complete) Proposal set is an internally
 * consistent aggregate snapshot (M4/Q3 — decision: fail fast, whether the
 * snapshot is a live cascade input or freshly rehydrated persisted data):
 *
 * - every Proposal belongs to the Slot (linkage, M6);
 * - no two Proposals in the set share an id;
 * - an `open` Slot MUST NOT contain an already-`accepted` Proposal (an
 *   `accepted` Proposal always implies its Slot is `filled`).
 *
 * The caller MUST pass the COMPLETE Proposal set for the Slot — a partial
 * set defeats the uniqueness/consistency checks.
 */
export function assertValidSlotAggregate(
  slot: Slot,
  proposals: readonly Proposal[],
): void {
  assertProposalsBelongToSlot(slot, proposals);

  const seenIds = new Set<string>();
  for (const proposal of proposals) {
    if (seenIds.has(proposal.id)) {
      throw new DomainValidationError(
        `Proposal id '${proposal.id}' appears more than once in slot '${slot.id}' proposal set`,
      );
    }
    seenIds.add(proposal.id);
  }

  if (slot.status === "open") {
    const acceptedProposal = proposals.find((p) => p.status === "accepted");
    if (acceptedProposal) {
      throw new DomainValidationError(
        `Slot '${slot.id}' is 'open' but proposal '${acceptedProposal.id}' is already 'accepted' — inconsistent aggregate snapshot`,
      );
    }
  }
}

/**
 * Rehydration entry point (Q3): validates a persisted Slot + Proposal set
 * fails fast on load, before any resolver (`acceptProposal`, `closeSlot`)
 * gets a chance to act on stale or corrupt data.
 */
export function rehydrateSlotAggregate(
  slot: Slot,
  proposals: readonly Proposal[],
): { readonly slot: Slot; readonly proposals: readonly Proposal[] } {
  assertValidSlotAggregate(slot, proposals);
  return { slot, proposals };
}
