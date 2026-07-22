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
   * from its own inputs, so rehydration cannot forge an unsettled payment out
   * of a stored record. It does NOT constrain WHICH terminal status is
   * presented — see `rehydrateSupportPayment`.
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
 * `readonly` modifiers hold at runtime too: an existing payment OBJECT cannot
 * have its `status` reassigned back to `pending` and `simulated` cannot be
 * flipped to `false`. That is a guarantee about this instance, not about which
 * statuses `rehydrateSupportPayment` will accept for a stored record.
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

/**
 * Reports a rejected enumerated value by naming the FIELD and the allowed set,
 * never the value itself. Two reasons, both load-bearing:
 *
 * 1. Leak. The enumerated `campaignReference` exists precisely so an IBAN or a
 *    PAN can never enter through it. Echoing the rejected value into the
 *    message would copy that same payload into every log line and error
 *    aggregator the message reaches — reintroducing the channel the
 *    enumeration removed. `assertId` already withholds its value.
 * 2. Robustness. These assertions run on cast or deserialized input. Any
 *    interpolation of an untrusted value can itself throw: `String(value)`
 *    raises `TypeError` for a null-prototype object or an object with a
 *    throwing `toString`, turning a domain denial into a programmer error.
 *
 * The allowed set is safe to include: it is system-issued, closed, and public.
 */
function rejectUnknownValue(field: string, allowed: readonly string[]): never {
  throw new DomainValidationError(
    `SupportPayment ${field} is not one of the allowed values (${allowed.join(", ")})`,
  );
}

function assertCampaignReference(
  value: SupportCampaignReference,
): SupportCampaignReference {
  if (!SUPPORT_CAMPAIGN_REFERENCES.includes(value)) {
    rejectUnknownValue("campaignReference", SUPPORT_CAMPAIGN_REFERENCES);
  }
  return value;
}

function assertTerminalStatus(status: SupportPaymentTerminalStatus): void {
  if (!TERMINAL_STATUSES.includes(status)) {
    rejectUnknownValue("rehydrated status", TERMINAL_STATUSES);
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
    rejectUnknownValue("payerKind", PAYER_KINDS);
  }
}

function assertMethod(method: SimulatedPaymentMethod): void {
  if (!PAYMENT_METHODS.includes(method)) {
    rejectUnknownValue("method", PAYMENT_METHODS);
  }
}

/**
 * The first guard a transition runs, and it runs against cast input too, so it
 * withholds the current status for the same two reasons as
 * `rejectUnknownValue`: the value is untrusted, and interpolating it can throw
 * a `TypeError` instead of denying the transition.
 */
function assertPending(payment: SupportPayment, transition: string): void {
  if (payment.status !== "pending") {
    throw new InvalidTransitionError(
      `Cannot ${transition} a SupportPayment that is not in 'pending' state`,
    );
  }
}

/**
 * Re-asserts the five caller-supplied fields — `id`, `campaignReference`,
 * `amountCents`, `payerKind`, `method` — and returns their normalized values.
 * `currency` and `simulated` are deliberately NOT asserted: they are never
 * read off the input, because `buildSupportPayment` hardcodes them on every
 * construction, so a corrupt incoming value for either is discarded rather
 * than validated.
 *
 * Transitions use this too: checking `status` alone would let a cast or
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
 * terminal statuses.
 *
 * What it guarantees:
 * - It TRUSTS the persisted status and re-asserts every caller-supplied field
 *   (`id`, `campaignReference`, `amountCents`, `payerKind`, `method`), so
 *   corrupt stored data fails fast instead of re-entering the model.
 * - It copies only known fields, so no extra property survives the round trip.
 * - It refuses to produce `pending`, so a terminal record cannot be
 *   reconstructed as an unsettled one and then driven through
 *   `settleSupportPayment` a second time.
 *
 * What it explicitly does NOT guarantee — terminal-outcome immutability.
 * A record persisted as `declined` can be rehydrated as `succeeded`:
 *
 *     rehydrateSupportPayment({ ...declinedFields, status: "succeeded" })
 *
 * returns a frozen, valid `succeeded` payment. This is not an oversight and
 * it is not fixable here. This is a PURE function: it receives one input and
 * has no prior state to compare the presented status against, so the check is
 * not merely absent, it is impossible at this signature.
 *
 * Terminal-outcome immutability is a PERSISTENCE-LAYER invariant, and this
 * change ships no persistence. Whatever repository later stores these records
 * MUST enforce it — a status column that leaves `pending` exactly once and is
 * never rewritten afterwards, enforced by the store (a conditional update
 * guarded on the current status, or an append-only event log), not by this
 * function.
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
    rejectUnknownValue("settlement outcome", SETTLEMENT_OUTCOMES);
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
