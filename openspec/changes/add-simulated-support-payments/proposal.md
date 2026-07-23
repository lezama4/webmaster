# Proposal — add-simulated-support-payments

**Project:** Vivetutiempo  
**Change:** `add-simulated-support-payments`  
**Scope:** Block 3 foundation — simulated support payments only.

## Intent

Vivetutiempo needs a demonstrable patronage seam without becoming a payment
processor. This change adds a simulated support-payment workflow for four
payer categories: individual, private patron, institution, and corporate
sponsor. It exposes Bizum, bank transfer, and card only as labelled simulated
methods for a demo.

The purpose is to demonstrate a clean port/adapter boundary, money represented
in integer cents, explicit settlement states, and a security-first upgrade path
to a future regulated provider. It does **not** collect, transmit, store, or
validate payment credentials.

## In scope

- Pure `SupportPayment` domain state machine.
- Application `PaymentGateway` port and a use case that creates and settles a
  simulated payment.
- Deterministic `FakePaymentGateway` adapter with server/test-configured
  outcomes.
- Unit tests for validation, state transitions, simulated settlement, and the
  absence of client-controlled outcomes.

## Out of scope

- Real cards, Bizum API, bank-transfer instructions, IBANs, phone numbers,
  payment links, webhooks, checkout sessions, payouts, refunds, invoices,
  tax receipts, or financial reconciliation.
- Persistence of payments, patron identity, or payment metadata.
- Claims that a simulated payment is a donation, a tax-deductible gift, or a
  transfer to an Artist.

## Safety contract

1. Every result MUST be labelled as simulated.
2. The client/request input MUST NOT choose success or failure; that outcome
   is owned by the fake adapter's test/server configuration.
3. Amounts MUST be positive integer euro cents; floating-point money is
   forbidden.
4. The model MUST accept only categorical payer/method data. It MUST NOT
   contain card, CVV, PAN, IBAN, bank account, Bizum phone number, or external
   provider credential fields.
5. A settled payment MUST be terminal **within the in-memory state machine**:
   `settleSupportPayment` and `cancelSupportPayment` deny any transition out of
   a terminal state, and every payment is frozen so the guarantee holds at
   runtime. There is no payout side effect.
6. Terminal-outcome immutability across a store-and-reload cycle is explicitly
   **NOT** delivered by this change. `rehydrateSupportPayment` refuses to
   produce `pending`, so a terminal record cannot be reconstructed as an
   unsettled one; it does not and cannot constrain which terminal status is
   presented, because it is a pure function with no prior state to compare
   against. That invariant belongs to the persistence layer, which this change
   deliberately does not include (see "Out of scope"), and is a hard
   requirement on whatever repository later stores these records.

## Success criteria

- A caller can simulate a successful or declined support payment through an
  application port, with a synthetic receipt that cannot be mistaken for a
  real provider confirmation.
- Tests demonstrate validation and all legal state transitions.
- `domain/` and `application/` remain framework-free; the fake adapter performs
  no network or financial I/O.

## Rollback

The change is additive and has no persistence or external side effect. It can
be removed by deleting the isolated support-payment domain, use case, port,
fake adapter, and tests.
