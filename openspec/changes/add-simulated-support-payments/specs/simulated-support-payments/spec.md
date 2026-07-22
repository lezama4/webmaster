# Simulated Support Payments Specification

## Purpose

Defines a safe demonstration-only support payment. It is not a financial
transaction and MUST NOT be presented as one.

## Requirements

### Requirement: Create a valid simulated support payment

The system MUST create a `pending` SupportPayment from a system-issued campaign
identifier, a bounded opaque identifier, a positive integer amount in euro
cents, a payer category, and a simulated method.

The campaign reference MUST be one of an explicitly enumerated, frozen set of
system-issued campaign identifiers defined in the domain. It MUST NOT be
caller-supplied free text and MUST NOT be validated by a charset rule: a
charset rule cannot exclude financial identifiers, because an IBAN begins with
a country code and a PAN or phone number can be prefixed with letters. The
enumeration removes the channel by construction.

The payment `id` MUST be constrained to an opaque identifier charset
(letters, digits, hyphens, underscores) and bounded in length, because it is
forwarded to the gateway as the request `paymentId`.

#### Scenario: An institution simulates a Bizum-labelled contribution

- GIVEN the system-issued campaign identifier `campaign-music-ward`
- WHEN an institution initiates 5000 euro cents using the `bizum` simulated method
- THEN the payment starts in `pending` state
- AND the payment contains no bank, phone, card, or provider credential data

#### Scenario: Invalid money is denied

- GIVEN a payment amount that is zero, negative, non-integer, non-finite, or
  above the defined simulation bound
- WHEN a caller initiates the payment
- THEN the domain MUST deny it

#### Scenario: A campaign reference outside the enumerated set is denied

- GIVEN any campaign reference that is not a system-issued campaign identifier,
  including an IBAN with or without separators, a card number with or without a
  letter prefix, a phone number, a plausible-looking unknown slug, a control
  character, a bidi-override glyph, markup, or an empty value
- WHEN a caller initiates the payment
- THEN the domain MUST deny it
- AND the value MUST NOT reach the gateway request

#### Scenario: An id outside the opaque identifier charset is denied

- GIVEN a payment id containing whitespace, punctuation outside `-`/`_`, a
  control character, a bidi-override glyph, markup, or a non-ASCII letter
- WHEN a caller initiates or rehydrates the payment
- THEN the domain MUST deny it
- AND the value MUST NOT reach the gateway request as `paymentId`

#### Scenario: Persisted data is revalidated on rehydration

- GIVEN a stored simulated payment in a terminal status
- WHEN the system rebuilds it
- THEN every caller-supplied field (`id`, `campaignReference`, `amountCents`,
  `payerKind`, `method`) MUST be re-asserted and corrupt data denied
- AND only known fields MUST survive the round trip
- AND the persisted `status` MUST be trusted, not re-derived

#### Scenario: Rehydration cannot forge a pending payment

- GIVEN a stored simulated payment presented with status `pending`
- WHEN the system attempts to rebuild it
- THEN the domain MUST deny it, so a terminal record cannot be reconstructed as
  an unsettled one and then driven through settlement a second time

#### Scenario: Rejecting an enumerated value MUST NOT echo it

- GIVEN a rejected `campaignReference`, `payerKind`, `method`, settlement
  outcome, or rehydrated status, or the current status of a denied transition
- WHEN the domain denies it
- THEN the error message MUST report the field name and the allowed set
- AND it MUST NOT contain the rejected value, which may be a financial
  identifier and must not reach a log or an error aggregator
- AND the denial MUST be a domain error even when the value's string conversion
  is hostile (a null-prototype object, a symbol, a throwing `toString`)

### Requirement: Terminal-outcome immutability is delegated to persistence

`rehydrateSupportPayment` is a pure function. It has no prior state to compare
a presented status against, so it MUST NOT be documented, tested, or reviewed
as preventing an outcome flip. Rejecting `pending` closes only the two-step
route (reopen, then settle); the one-step route — presenting a `declined`
record as `succeeded` — is open and is NOT a defect at this layer.

Any repository that later persists these records MUST enforce terminal-outcome
immutability itself: a status that leaves `pending` exactly once and is never
rewritten afterwards, enforced by the store through a conditional update
guarded on the current status or an append-only event log.

#### Scenario: A persisted terminal outcome can be re-read as another terminal outcome

- GIVEN a record persisted as `declined`
- WHEN it is rehydrated with status `succeeded`
- THEN the domain MUST return a valid frozen `succeeded` payment
- AND this MUST be recorded as a known non-guarantee of this layer, with the
  invariant assigned to the future persistence layer

### Requirement: Only the fake gateway determines a simulated outcome

The use case MUST send a pending payment to `PaymentGateway`. The gateway
returns a synthetic outcome configured by trusted application/test wiring, not
by client input.

#### Scenario: Fake gateway simulates success

- GIVEN a pending payment and a fake gateway configured for success
- WHEN the application simulates it
- THEN the returned payment is `succeeded`
- AND the receipt is explicitly marked `simulated`

#### Scenario: Fake gateway simulates decline

- GIVEN a pending payment and a fake gateway configured for decline
- WHEN the application simulates it
- THEN the returned payment is `declined`
- AND no retry, payout, transfer, or external call occurs

### Requirement: Settlement is terminal

A `pending` payment MAY transition to `succeeded`, `declined`, or `cancelled`.
Every terminal state MUST deny any later transition, at runtime and not only
through compile-time types. A transition MUST copy only the known payment
fields, never an arbitrary set of properties from its input, and MUST re-assert
every caller-supplied field (`id`, `campaignReference`, `amountCents`,
`payerKind`, `method`) before rebuilding. `currency` and `simulated` are
hardcoded on every construction and are therefore never read from the input,
so they are not asserted.

#### Scenario: A succeeded payment cannot be settled again

- GIVEN a `succeeded` simulated payment
- WHEN any actor attempts to settle or cancel it again
- THEN the domain MUST deny the transition
- AND direct assignment to `status` or `simulated` MUST fail at runtime

#### Scenario: A transition cannot launder unknown properties

- GIVEN an object carrying extra fields such as a card number, CVV, IBAN, or
  payout account alongside a valid pending payment
- WHEN it is settled or cancelled
- THEN the resulting payment MUST contain only the known payment fields

#### Scenario: A transition denies corrupt known fields

- GIVEN a cast or deserialised pending payment whose known fields are corrupt,
  such as a negative amount, an unknown campaign reference, a card number in
  `id`, or an unknown payer kind or method
- WHEN it is settled or cancelled
- THEN the domain MUST deny the transition instead of producing a frozen,
  valid-looking terminal payment

#### Scenario: A failed simulation cancels the pending payment

- GIVEN a pending payment whose gateway call rejects, whose result fails the
  synthetic receipt check, whose result carries an outcome outside the
  `succeeded | declined` union, or whose settlement is refused
- WHEN the application handles the failure
- THEN the payment MUST be cancelled and a `FailedSimulationError` thrown
- AND no payment MUST be left in `pending`
- AND `FailedSimulationError` MUST belong to the application error taxonomy
- AND an adapter-contract violation MUST be reported as an application-layer
  error, never as a domain error, because a gateway response is not domain input

#### Scenario: Describing a hostile rejection never discards the cancelled payment

- GIVEN an adapter that rejects with a value whose `message` throws, is a
  symbol, or is a null-prototype object
- WHEN the application builds the failure message
- THEN it MUST fall back to a description that cannot throw
- AND the cancelled payment and the original `cause` MUST both survive

#### Scenario: The gateway result is read exactly once

- GIVEN an adapter exposing `receiptReference` or `outcome` as a getter that
  returns a different value on a second read
- WHEN the application validates and then uses the result
- THEN the returned receipt and the settled status MUST be the values that were
  validated
- AND a `receiptReference` that is not a bounded string MUST be denied, because
  `RegExp.test` coerces and would admit `{ toString: () => "sim_ok" }`

#### Scenario: A failed simulation never mutates the thrown error

- GIVEN an adapter that rejects with a shared or frozen error value
- WHEN the application reports the failure
- THEN it MUST throw a new error carrying the original value as `cause`
- AND the cancelled payment MUST be an own non-enumerable, non-writable
  property, so it is not serialised into structured logs and two failures
  cannot overwrite each other

### Requirement: Financial identifiers are out of the model

The public input and output contracts MUST include only categorical payer/method
data, campaign reference, amount in cents, currency, simulated status, and a
synthetic receipt reference. They MUST NOT define fields for card data, CVV,
IBAN, account number, Bizum phone number, webhook secret, transaction token,
or provider account.

#### Scenario: A receipt cannot be mistaken for a real confirmation

- GIVEN any fake gateway result
- WHEN the application returns a receipt
- THEN `simulated` is true
- AND the receipt reference starts with `sim_`
- AND the derivation from the payment id is injective, so two distinct payment
  ids always yield two distinct references — not a per-gateway-instance counter
  and not a lossy rewrite that collapses distinct ids onto one reference
- AND the adapter MUST enforce the payment id's length bound as well as its
  charset, since it does not rely on upstream validation and the charset
  pattern is unbounded

#### Scenario: The outbound request is marked as a simulation

- GIVEN any simulated payment sent to the gateway port
- WHEN the request is built
- THEN it MUST carry `simulated: true`, so it is never indistinguishable from a
  real charge request
