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

/**
 * Text bounds for the Artist's free-text pitch (pr1-M2, T-15). `message` was
 * previously unvalidated — an unbounded field is a storage-abuse and
 * rendering vector. Mirrors `Slot.description`: a non-empty required message
 * (an empty pitch is not a proposal), trimmed and capped.
 */
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 2000;

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Proposal ${field} must not be empty`);
  }
}

/**
 * Reads the message once, trims once, validates the trimmed length against the
 * bounds, and returns the trimmed value for storage — the same
 * read-once/normalise-once discipline the Slot and Profile factories use. A
 * blank or over-bound message throws before the Proposal is built.
 */
function normaliseMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length < MESSAGE_MIN_LENGTH || trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new DomainValidationError(
      `Proposal message must be between ${MESSAGE_MIN_LENGTH} and ${MESSAGE_MAX_LENGTH} characters (got ${trimmed.length})`,
    );
  }
  return trimmed;
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
  const message = normaliseMessage(input.message);

  return {
    id: input.id,
    slotId: input.slotId,
    artistProfileId: input.artistProfileId,
    message,
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
  const message = normaliseMessage(input.message);

  return {
    id: input.id,
    slotId: input.slotId,
    artistProfileId: input.artistProfileId,
    message,
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
