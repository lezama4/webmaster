import { DomainValidationError, InvalidTransitionError } from "../errors";

export type ProposalStatus = "submitted" | "accepted" | "rejected";

const PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  "submitted",
  "accepted",
  "rejected",
];

/**
 * Nominal brand (M1): a unique symbol, never exported, so outer code cannot
 * satisfy the `Proposal` type with a structural literal — the ONLY ways to
 * obtain a `Proposal` are `createProposal` (forces `submitted`) and
 * `rehydrateProposal` (validates persisted data). Type-only, erased at
 * compile time, so `Proposal` values stay plain, serializable objects.
 */
declare const PROPOSAL_BRAND: unique symbol;

/**
 * An Artist's Proposal against a Hospital Slot.
 * State machine: submitted -> accepted | rejected (both terminal).
 */
export type Proposal = {
  readonly id: string;
  readonly slotId: string;
  readonly artistProfileId: string;
  readonly message: string;
  readonly status: ProposalStatus;
} & { readonly [PROPOSAL_BRAND]: "Proposal" };

export interface CreateProposalInput {
  readonly id: string;
  readonly slotId: string;
  readonly artistProfileId: string;
  readonly message: string;
}

export interface RehydrateProposalInput extends CreateProposalInput {
  readonly status: ProposalStatus;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Proposal ${field} must not be empty`);
  }
}

function assertValidStatus(status: ProposalStatus): void {
  if (!PROPOSAL_STATUSES.includes(status)) {
    throw new DomainValidationError(`Proposal status '${status}' is invalid`);
  }
}

function assertFields(input: CreateProposalInput): void {
  assertNonEmpty("id", input.id);
  assertNonEmpty("slotId", input.slotId);
  assertNonEmpty("artistProfileId", input.artistProfileId);
}

/**
 * Creates a new Proposal. ALWAYS starts in 'submitted' (M1: the initial
 * state is forced by this factory, not left to the caller to fabricate).
 */
export function createProposal(input: CreateProposalInput): Proposal {
  assertFields(input);

  return {
    id: input.id,
    slotId: input.slotId,
    artistProfileId: input.artistProfileId,
    message: input.message,
    status: "submitted",
  } as Proposal;
}

/**
 * Rebuilds a Proposal from persisted data (M1). Unlike `createProposal`,
 * this MAY produce a Proposal in any valid status (including `accepted` or
 * `rejected`) because it represents state that already went through a
 * legitimate transition before being persisted — every field is validated,
 * so corrupt/invalid persisted data fails fast here.
 */
export function rehydrateProposal(input: RehydrateProposalInput): Proposal {
  assertFields(input);
  assertValidStatus(input.status);

  return {
    id: input.id,
    slotId: input.slotId,
    artistProfileId: input.artistProfileId,
    message: input.message,
    status: input.status,
  } as Proposal;
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
