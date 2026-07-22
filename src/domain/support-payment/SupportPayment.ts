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

export type SimulatedSettlementOutcome = "succeeded" | "declined";

export const MAX_SIMULATED_SUPPORT_AMOUNT_CENTS = 100_000_000;
export const MAX_CAMPAIGN_REFERENCE_LENGTH = 128;
export const MAX_SUPPORT_PAYMENT_ID_LENGTH = 128;

/**
 * A campaign reference is an opaque slug, never free text. The explicit
 * charset is what keeps the field from becoming a channel for financial or
 * personal data: without it an IBAN, PAN, phone number, NUL byte, newline,
 * bidi-override glyph, or raw markup would be accepted and forwarded verbatim
 * into the outbound gateway request. The leading lookahead requires at least
 * one letter, so a digits-only value — the shape of a card, phone, or account
 * number — cannot pass as a campaign slug either.
 */
const CAMPAIGN_REFERENCE_PATTERN = /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SUPPORT_PAYMENT_STATUSES: readonly SupportPaymentStatus[] = [
  "pending",
  "succeeded",
  "declined",
  "cancelled",
];

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

const SETTLEMENT_OUTCOMES: readonly SimulatedSettlementOutcome[] = [
  "succeeded",
  "declined",
];

declare const SUPPORT_PAYMENT_BRAND: unique symbol;

/**
 * A demonstration-only support-payment state machine. This aggregate is NOT
 * a ledger entry, donation certificate, charge, bank transfer, or payout.
 * It intentionally contains no card, phone, IBAN, provider, or identity data.
 */
export type SupportPayment = {
  readonly id: string;
  readonly campaignReference: string;
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
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
}

export interface RehydrateSupportPaymentInput {
  readonly id: string;
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
  readonly status: SupportPaymentStatus;
}

interface SupportPaymentFields {
  readonly id: string;
  readonly campaignReference: string;
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

function assertCampaignReference(value: string): string {
  const reference = assertBoundedText(
    "campaignReference",
    value,
    MAX_CAMPAIGN_REFERENCE_LENGTH,
  );
  if (!CAMPAIGN_REFERENCE_PATTERN.test(reference)) {
    throw new DomainValidationError(
      "SupportPayment campaignReference must be a lowercase alphanumeric slug separated by single hyphens and containing at least one letter",
    );
  }
  return reference;
}

function assertStatus(status: SupportPaymentStatus): void {
  if (!SUPPORT_PAYMENT_STATUSES.includes(status)) {
    throw new DomainValidationError(
      `SupportPayment status '${status}' is invalid`,
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

/** Creates a pending, simulation-only support payment in integer EUR cents. */
export function createSupportPayment(
  input: CreateSupportPaymentInput,
): SupportPayment {
  const id = assertBoundedText("id", input.id, MAX_SUPPORT_PAYMENT_ID_LENGTH);
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
 * Rebuilds a SupportPayment from persisted or transported data. Unlike
 * `createSupportPayment` it MAY produce any valid status, but it re-runs every
 * assertion so corrupt data fails fast instead of silently rehydrating, and it
 * copies only known fields so no extra property survives the round trip.
 */
export function rehydrateSupportPayment(
  input: RehydrateSupportPaymentInput,
): SupportPayment {
  const id = assertBoundedText("id", input.id, MAX_SUPPORT_PAYMENT_ID_LENGTH);
  const campaignReference = assertCampaignReference(input.campaignReference);
  assertAmountCents(input.amountCents);
  assertPayerKind(input.payerKind);
  assertMethod(input.method);
  assertStatus(input.status);

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
  if (!SETTLEMENT_OUTCOMES.includes(outcome)) {
    throw new DomainValidationError(
      `SupportPayment settlement outcome '${outcome}' is invalid`,
    );
  }
  return buildSupportPayment({
    id: payment.id,
    campaignReference: payment.campaignReference,
    amountCents: payment.amountCents,
    payerKind: payment.payerKind,
    method: payment.method,
    status: outcome,
  });
}

/** Cancels a pending simulation before the fake gateway settles it. */
export function cancelSupportPayment(payment: SupportPayment): SupportPayment {
  assertPending(payment, "cancel");
  return buildSupportPayment({
    id: payment.id,
    campaignReference: payment.campaignReference,
    amountCents: payment.amountCents,
    payerKind: payment.payerKind,
    method: payment.method,
    status: "cancelled",
  });
}
