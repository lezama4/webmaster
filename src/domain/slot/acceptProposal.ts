import { DomainValidationError } from "../errors";
import { createEvent, type Event, publishEvent } from "../event/Event";
import {
  acceptProposal as acceptProposalTransition,
  type Proposal,
  rejectProposal,
} from "../proposal/Proposal";
import type { Clock } from "../shared/Clock";
import { assertProposalsBelongToSlot } from "./linkage";
import { fillSlot, type Slot } from "./Slot";

export interface AcceptProposalInput {
  /** The Slot being resolved. Must be 'open'. */
  readonly slot: Slot;
  /** Every Proposal currently belonging to the Slot. */
  readonly proposals: readonly Proposal[];
  /** The Proposal the owning Hospital accepts. */
  readonly proposalId: string;
  /** Pre-generated id for the Event to create (IdGenerator is a port). */
  readonly eventId: string;
  readonly clock: Clock;
}

/**
 * The full state change the accept decision produces. Persisting this
 * atomically is the MatchingUnitOfWork's job (infrastructure, ADR D4).
 */
export interface AcceptProposalOutcome {
  readonly slot: Slot;
  readonly acceptedProposal: Proposal;
  readonly rejectedProposals: readonly Proposal[];
  readonly event: Event;
  readonly occurredAt: Date;
}

function findTargetProposal(input: AcceptProposalInput): Proposal {
  const target = input.proposals.find((p) => p.id === input.proposalId);
  if (!target) {
    throw new DomainValidationError(
      `Proposal '${input.proposalId}' is not among slot '${input.slot.id}' proposals`,
    );
  }
  return target;
}

/**
 * Pure domain invariant (ADR D4): accepting one 'submitted' Proposal on an
 * 'open' Slot accepts it, auto-rejects every other 'submitted' Proposal on
 * that Slot, fills the Slot, and creates + publishes an Event — as one
 * deterministic decision. No IO, no persistence.
 */
export function acceptProposal(
  input: AcceptProposalInput,
): AcceptProposalOutcome {
  assertProposalsBelongToSlot(input.slot, input.proposals);
  const target = findTargetProposal(input);

  const acceptedProposal = acceptProposalTransition(target);
  const filledSlot = fillSlot(input.slot);
  const rejectedProposals = input.proposals
    .filter((p) => p.id !== target.id && p.status === "submitted")
    .map(rejectProposal);

  const event = publishEvent(
    createEvent({
      id: input.eventId,
      slotId: input.slot.id,
      proposalId: acceptedProposal.id,
      title: input.slot.title,
    }),
  );

  return {
    slot: filledSlot,
    acceptedProposal,
    rejectedProposals,
    event,
    occurredAt: input.clock.now(),
  };
}
