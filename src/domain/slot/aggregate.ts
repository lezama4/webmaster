import { DomainValidationError } from "../errors";
import type { Proposal } from "../proposal/Proposal";
import { assertProposalsBelongToSlot } from "./linkage";
import type { Slot } from "./Slot";

/**
 * Validates that a Slot + its (complete) Proposal set is an internally
 * consistent aggregate snapshot (M4/Q3 — decision: fail fast, whether the
 * snapshot is a live cascade input or freshly rehydrated persisted data).
 *
 * Structural rules:
 * - every Proposal belongs to the Slot (linkage, M6);
 * - no two Proposals in the set share an id.
 *
 * Status-matrix rules (pr1-M1 — the full matrix, not just `open + accepted`).
 * The Slot state machine (`open -> filled | closed`) and the accept-cascade
 * (accept exactly one, reject the rest, fill the Slot) together imply:
 * - `filled`   => EXACTLY ONE `accepted` Proposal, and NO `submitted` ones
 *                 (the cascade rejects every rival at fill time);
 * - `open`     => ZERO `accepted` Proposals (`accepted` implies `filled`);
 * - `closed`   => ZERO `accepted` (a Slot can only be closed while `open`)
 *                 and NO `submitted` (close cascade-rejects every rival);
 *   i.e. a `submitted` Proposal may exist ONLY while the Slot is `open`.
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

  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const submittedCount = proposals.filter(
    (p) => p.status === "submitted",
  ).length;

  if (slot.status === "filled") {
    if (acceptedCount !== 1) {
      throw new DomainValidationError(
        `Slot '${slot.id}' is 'filled' but has ${acceptedCount} accepted proposals (exactly 1 required) — inconsistent aggregate snapshot`,
      );
    }
  } else if (acceptedCount > 0) {
    throw new DomainValidationError(
      `Slot '${slot.id}' is '${slot.status}' but has ${acceptedCount} accepted proposal(s) — an accepted proposal requires a 'filled' slot`,
    );
  }

  if (slot.status !== "open" && submittedCount > 0) {
    throw new DomainValidationError(
      `Slot '${slot.id}' is '${slot.status}' but has ${submittedCount} still-'submitted' proposal(s) — a non-open slot must have none`,
    );
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
