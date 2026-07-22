# Simulated Support Payments Specification

## Purpose

Defines a safe demonstration-only support payment. It is not a financial
transaction and MUST NOT be presented as one.

## Requirements

### Requirement: Create a valid simulated support payment

The system MUST create a `pending` SupportPayment from a bounded campaign
reference slug, a bounded identifier, a positive integer amount in euro cents,
a payer category, and a simulated method.

The campaign reference MUST be a lowercase alphanumeric slug with single hyphen
separators containing at least one letter. It is an opaque identifier, never
free text, so it cannot be used to carry an IBAN, card number, phone number,
account number, control character, bidi-override glyph, or markup into the
gateway request.

#### Scenario: An institution simulates a Bizum-labelled contribution

- GIVEN campaign reference `campaign-1`
- WHEN an institution initiates 5000 euro cents using the `bizum` simulated method
- THEN the payment starts in `pending` state
- AND the payment contains no bank, phone, card, or provider credential data

#### Scenario: Invalid money is denied

- GIVEN a payment amount that is zero, negative, non-integer, non-finite, or
  above the defined simulation bound
- WHEN a caller initiates the payment
- THEN the domain MUST deny it

#### Scenario: A campaign reference outside the slug charset is denied

- GIVEN a campaign reference containing an IBAN, card number, phone number,
  whitespace, uppercase, a control character, a bidi-override glyph, markup,
  or only digits
- WHEN a caller initiates the payment
- THEN the domain MUST deny it
- AND the value MUST NOT reach the gateway request

#### Scenario: Persisted data is revalidated on rehydration

- GIVEN a stored simulated payment in any valid status
- WHEN the system rebuilds it
- THEN every invariant MUST be re-checked and corrupt data denied
- AND only known fields MUST survive the round trip

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
fields, never an arbitrary set of properties from its input.

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

#### Scenario: A failed simulation cancels the pending payment

- GIVEN a pending payment whose gateway call rejects, or whose result fails the
  synthetic receipt check
- WHEN the application handles the failure
- THEN the payment MUST be cancelled and the error rethrown
- AND no payment MUST be left in `pending`

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
- AND the reference is unique per payment, not a per-gateway-instance counter

#### Scenario: The outbound request is marked as a simulation

- GIVEN any simulated payment sent to the gateway port
- WHEN the request is built
- THEN it MUST carry `simulated: true`, so it is never indistinguishable from a
  real charge request
