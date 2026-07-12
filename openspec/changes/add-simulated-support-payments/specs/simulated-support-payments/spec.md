# Simulated Support Payments Specification

## Purpose

Defines a safe demonstration-only support payment. It is not a financial
transaction and MUST NOT be presented as one.

## Requirements

### Requirement: Create a valid simulated support payment

The system MUST create a `pending` SupportPayment from a non-empty campaign
reference, a positive integer amount in euro cents, a payer category, and a
simulated method.

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
Every terminal state MUST deny any later transition.

#### Scenario: A succeeded payment cannot be settled again

- GIVEN a `succeeded` simulated payment
- WHEN any actor attempts to settle or cancel it again
- THEN the domain MUST deny the transition

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
