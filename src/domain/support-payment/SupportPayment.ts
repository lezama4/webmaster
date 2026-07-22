import { DomainValidationError, InvalidTransitionError } from "../errors";

export type SupportPayerKind =
  | "individual"
  | "private_patron"
  | "institution"
  | "corporate_sponsor";

/** Labels for a demo only. None represents a live payment integration. */
export type SimulatedPaymentMethod = "card" | "bizum" | "bank_transfer";

export type SupportPaymentStatus =
  | "pending"
  | "succeeded"
  | "declined"
  | "cancelled";

/** Every status a payment can hold once it has left `pending`. */
export type SupportPaymentTerminalStatus = Exclude<
  SupportPaymentStatus,
  "pending"
>;

export type SimulatedSettlementOutcome = "succeeded" | "declined";

export const MAX_SIMULATED_SUPPORT_AMOUNT_CENTS = 100_000_000;
export const MAX_SUPPORT_PAYMENT_ID_LENGTH = 128;

/**
 * The complete set of system-issued campaign identifiers a simulated payment
 * may reference. This is deliberately a closed enumeration and NOT a charset
 * rule: a charset cannot keep financial data out of a free-text field, because
 * an IBAN starts with an ISO 3166 country code and a caller can always prefix
 * a PAN or a phone number with letters (`card-4111111111111111`,
 * `es9121000418450200051332`). With a closed set there is no field a donor can
 * type into at all, so the channel is removed by construction rather than
 * filtered. A new campaign is added here, by the system, never by a caller.
 */
export const SUPPORT_CAMPAIGN_REFERENCES = Object.freeze([
  "campaign-music-ward",
  "campaign-artist-residency",
  "campaign-hospital-outreach",
  "campaign-general-fund",
] as const);

export type SupportCampaignReference =
  (typeof SUPPORT_CAMPAIGN_REFERENCES)[number];

/**
 * An `id` is an opaque identifier, never text. It is forwarded verbatim to the
 * gateway as `SimulatedGatewayRequest.paymentId`, so without an explicit
 * charset it would accept an IBAN, PAN, NUL byte, newline, bidi-override
 * glyph, or raw markup exactly like an unconstrained free-text field.
 */
const SUPPORT_PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const PAYER_KINDS: readonly SupportPayerKind[] = [
  "individual",
  "private_patron",
  "institution",
  "corporate_sponsor",
];

const PAYMENT_METHODS: readonly SimulatedPaymentMethod[] = [
  "card",
  "bizum",
  "bank_transfer",
];

const TERMINAL_STATUSES: readonly SupportPaymentTerminalStatus[] = [
  "succeeded",
  "declined",
  "cancelled",
];

const SETTLEMENT_OUTCOMES: readonly SimulatedSettlementOutcome[] = [
  "succeeded",
  "declined",
];

declare const SUPPORT_PAYMENT_BRAND: unique symbol;

/**
 * A demonstration-only support-payment state machine. This aggregate is NOT
 * a ledger entry, donation certificate, charge, bank transfer, or payout.
 * It intentionally contains no card, phone, IBAN, provider, or identity data,
 * and it has no free-text field at all: `campaignReference` is a system-issued
 * enumerated identifier and `id` is an opaque identifier.
 */
export type SupportPayment = {
  readonly id: string;
  readonly campaignReference: SupportCampaignReference;
  readonly amountCents: number;
  readonly currency: "EUR";
  /** Every serializable payment value is explicitly demonstration-only. */
  readonly simulated: true;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
  readonly status: SupportPaymentStatus;
} & { readonly [SUPPORT_PAYMENT_BRAND]: "SupportPayment" };

export interface CreateSupportPaymentInput {
  readonly id: string;
  readonly campaignReference: SupportCampaignReference;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
}

export interface RehydrateSupportPaymentInput {
  readonly id: string;
  readonly campaignReference: SupportCampaignReference;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
  /**
   * Terminal only. A `pending` payment is produced by `createSupportPayment`
   * from its own inputs, so rehydration can never be used as an exported
   * status setter that reopens a settled or cancelled payment.
   */
  readonly status: SupportPaymentTerminalStatus;
}

interface SupportPaymentFields {
  readonly id: string;
  readonly campaignReference: SupportCampaignReference;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
  readonly status: SupportPaymentStatus;
}

/**
 * Builds a SupportPayment field by field and freezes it. Explicit construction
 * (never a spread of the previous value) is what stops a cast or deserialized
 * object from laundering unknown properties — a smuggled `pan`, `cvv`, `iban`,
 * or `payoutAccount` — into a settled payment. `Object.freeze` makes the
 * `readonly` state machine hold at runtime too, so a terminal payment cannot
 * be reopened and `simulated` cannot be flipped to `false`.
 */
function buildSupportPayment(fields: SupportPaymentFields): SupportPayment {
  return Object.freeze({
    id: fields.id,
    campaignReference: fields.campaignReference,
    amountCents: fields.amountCents,
    currency: "EUR",
    simulated: true,
    payerKind: fields.payerKind,
    method: fields.method,
    status: fields.status,
  }) as SupportPayment;
}

/** Returns the trimmed value so callers store the normalized form. */
function assertBoundedText(field: string, value: string, max: number): string {
  if (typeof value !== "string") {
    throw new DomainValidationError(
      `SupportPayment ${field} must be a string`,
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError(`SupportPayment ${field} must not be empty`);
  }
  if (trimmed.length > max) {
    throw new DomainValidationError(
      `SupportPayment ${field} must not exceed ${max} characters`,
    );
  }
  return trimmed;
}

function assertId(value: string): string {
  const id = assertBoundedText("id", value, MAX_SUPPORT_PAYMENT_ID_LENGTH);
  if (!SUPPORT_PAYMENT_ID_PATTERN.test(id)) {
    throw new DomainValidationError(
      "SupportPayment id must contain only letters, digits, hyphens, and underscores",
    );
  }
  return id;
}

function assertCampaignReference(
  value: SupportCampaignReference,
): SupportCampaignReference {
  if (!SUPPORT_CAMPAIGN_REFERENCES.includes(value)) {
    throw new DomainValidationError(
      `SupportPayment campaignReference '${String(value)}' is not a known campaign identifier`,
    );
  }
  return value;
}

function assertTerminalStatus(status: SupportPaymentTerminalStatus): void {
  if (!TERMINAL_STATUSES.includes(status)) {
    throw new DomainValidationError(
      `SupportPayment cannot be rehydrated into status '${String(status)}'; only ${TERMINAL_STATUSES.join(", ")} are terminal`,
    );
  }
}

function assertAmountCents(amountCents: number): void {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_SIMULATED_SUPPORT_AMOUNT_CENTS
  ) {
    throw new DomainValidationError(
      `SupportPayment amountCents must be a positive safe integer up to ${MAX_SIMULATED_SUPPORT_AMOUNT_CENTS}`,
    );
  }
}

function assertPayerKind(payerKind: SupportPayerKind): void {
  if (!PAYER_KINDS.includes(payerKind)) {
    throw new DomainValidationError(
      `SupportPayment payerKind '${payerKind}' is invalid`,
    );
  }
}

function assertMethod(method: SimulatedPaymentMethod): void {
  if (!PAYMENT_METHODS.includes(method)) {
    throw new DomainValidationError(
      `SupportPayment method '${method}' is invalid`,
    );
  }
}

function assertPending(payment: SupportPayment, transition: string): void {
  if (payment.status !== "pending") {
    throw new InvalidTransitionError(
      `Cannot ${transition} a SupportPayment in '${payment.status}' state (requires 'pending')`,
    );
  }
}

/**
 * Re-runs every non-status assertion and returns the normalized values.
 * Transitions use it too: checking `status` alone would let a cast or
 * deserialized object carrying a corrupt known value — a negative amount, an
 * IBAN in a field, an unknown method — emerge as a frozen, valid-looking
 * terminal payment.
 */
function assertKnownFields(
  payment: SupportPayment,
): Omit<SupportPaymentFields, "status"> {
  const id = assertId(payment.id);
  const campaignReference = assertCampaignReference(payment.campaignReference);
  assertAmountCents(payment.amountCents);
  assertPayerKind(payment.payerKind);
  assertMethod(payment.method);

  return {
    id,
    campaignReference,
    amountCents: payment.amountCents,
    payerKind: payment.payerKind,
    method: payment.method,
  };
}

/** Creates a pending, simulation-only support payment in integer EUR cents. */
export function createSupportPayment(
  input: CreateSupportPaymentInput,
): SupportPayment {
  const id = assertId(input.id);
  const campaignReference = assertCampaignReference(input.campaignReference);
  assertAmountCents(input.amountCents);
  assertPayerKind(input.payerKind);
  assertMethod(input.method);

  return buildSupportPayment({
    id,
    campaignReference,
    amountCents: input.amountCents,
    payerKind: input.payerKind,
    method: input.method,
    status: "pending",
  });
}

/**
 * Rebuilds a SupportPayment from persisted or transported data in one of its
 * terminal statuses. It re-runs every assertion so corrupt data fails fast,
 * copies only known fields so no extra property survives the round trip, and
 * rejects `pending` so it cannot be used to reopen a terminal payment and
 * settle it again to the opposite outcome.
 */
export function rehydrateSupportPayment(
  input: RehydrateSupportPaymentInput,
): SupportPayment {
  const id = assertId(input.id);
  const campaignReference = assertCampaignReference(input.campaignReference);
  assertAmountCents(input.amountCents);
  assertPayerKind(input.payerKind);
  assertMethod(input.method);
  assertTerminalStatus(input.status);

  return buildSupportPayment({
    id,
    campaignReference,
    amountCents: input.amountCents,
    payerKind: input.payerKind,
    method: input.method,
    status: input.status,
  });
}

/** Applies a fake gateway's trusted, terminal success/decline outcome. */
export function settleSupportPayment(
  payment: SupportPayment,
  outcome: SimulatedSettlementOutcome,
): SupportPayment {
  assertPending(payment, "settle");
  const fields = assertKnownFields(payment);
  if (!SETTLEMENT_OUTCOMES.includes(outcome)) {
    throw new DomainValidationError(
      `SupportPayment settlement outcome '${String(outcome)}' is invalid`,
    );
  }
  return buildSupportPayment({
    id: fields.id,
    campaignReference: fields.campaignReference,
    amountCents: fields.amountCents,
    payerKind: fields.payerKind,
    method: fields.method,
    status: outcome,
  });
}

/** Cancels a pending simulation before the fake gateway settles it. */
export function cancelSupportPayment(payment: SupportPayment): SupportPayment {
  assertPending(payment, "cancel");
  const fields = assertKnownFields(payment);
  return buildSupportPayment({
    id: fields.id,
    campaignReference: fields.campaignReference,
    amountCents: fields.amountCents,
    payerKind: fields.payerKind,
    method: fields.method,
    status: "cancelled",
  });
}
