import { DomainValidationError } from "../errors";
import type { Proposal } from "../proposal/Proposal";
import type { Slot } from "./Slot";

/**
 * Shared guard for the Slot-resolving cascades (`acceptProposal`,
 * `closeSlot`): every Proposal in a cascade MUST belong to the Slot being
 * resolved — a foreign Proposal in the working set is a caller bug (M6).
 */
export function assertProposalsBelongToSlot(
  slot: Slot,
  proposals: readonly Proposal[],
): void {
  const foreign = proposals.find((p) => p.slotId !== slot.id);
  if (foreign) {
    throw new DomainValidationError(
      `Proposal '${foreign.id}' belongs to slot '${foreign.slotId}', not slot '${slot.id}'`,
    );
  }
}
