import { InvalidTransitionError } from "../errors";

export type ProposalStatus = "submitted" | "accepted" | "rejected";

/**
 * An Artist's Proposal against a Hospital Slot.
 * State machine: submitted -> accepted | rejected (both terminal).
 */
export interface Proposal {
  readonly id: string;
  readonly slotId: string;
  readonly artistProfileId: string;
  readonly message: string;
  readonly status: ProposalStatus;
}

function assertSubmitted(proposal: Proposal, transition: string): void {
  if (proposal.status !== "submitted") {
    throw new InvalidTransitionError(
      `Cannot ${transition} a proposal in '${proposal.status}' state (requires 'submitted')`,
    );
  }
}

/** The owning Hospital accepts the proposal: submitted -> accepted. */
export function acceptProposal(proposal: Proposal): Proposal {
  assertSubmitted(proposal, "accept");
  return { ...proposal, status: "accepted" };
}

/** The proposal is rejected (by decision or cascade): submitted -> rejected. */
export function rejectProposal(proposal: Proposal): Proposal {
  assertSubmitted(proposal, "reject");
  return { ...proposal, status: "rejected" };
}
