# Simulated payment security approval

## Decision

**Approved for demonstration-only simulation. Not approved for real payments.**

The implementation is a deliberately constrained Block 3 seam. It may show
simulated labels for card, Bizum, and bank transfer, but it does not call a
provider, collect payment credentials, issue payment instructions, store a
financial record, or transfer funds to an Artist or any other party.

## Controls reviewed

- `SupportPayment` accepts only a bounded positive safe-integer amount in EUR
  cents, categorical payer/method values, a bounded trimmed `id`, and a
  campaign reference constrained to a lowercase alphanumeric hyphen-separated
  slug that must contain at least one letter. The slug charset is the control
  that stops the field being used as a free-text channel: an IBAN, PAN, phone
  number, NUL byte, newline, bidi-override glyph, raw markup, or a digits-only
  card/phone/account shape is rejected instead of forwarded to the gateway.
- Every serializable payment, gateway request, and receipt includes
  `simulated: true`. The request carries the marker too, so the one object
  handed to an adapter is not byte-for-byte indistinguishable from a real
  charge request.
- The state machine is `pending -> succeeded | declined | cancelled`; terminal
  states cannot transition again. Every payment is returned frozen, so the
  guarantee is enforced at runtime and not only by compile-time `readonly`:
  a settled payment cannot be reassigned back to `pending` and `simulated`
  cannot be flipped to `false`.
- Payments are always built field by field from a known field list, never by
  spreading a previous value. A cast or deserialized object carrying extra
  properties (`pan`, `cvv`, `iban`, `payoutAccount`) cannot launder them into
  a settled payment.
- `rehydrateSupportPayment` re-runs every assertion, so persisted or
  transported data cannot re-enter the model unvalidated.
- The request contract has no PAN, CVV, IBAN, phone number, account number,
  webhook secret, provider token, outcome, or payout field.
- `simulateSupportPayment` creates the pending payment itself and sends the
  fake gateway only the safe categorical request shape.
- `FakePaymentGateway` receives its success/decline outcome only through
  trusted constructor configuration, validates it against the allowed union,
  and captures it as a scalar at construction. Request data cannot cause a
  simulated success, and mutating the caller's options object afterwards
  cannot flip an already-wired outcome.
- The synthetic receipt reference is derived from the payment id, so it is
  unique and traceable across gateway instances rather than a per-instance
  counter that two fresh gateways would both start at `sim_1`.
- The use case rejects a result that is not explicitly marked as simulated or
  does not have a `sim_` synthetic reference. A gateway rejection or a
  rejected receipt cancels the pending payment and rethrows, so `cancelled`
  is the documented failure path and no payment is abandoned in `pending`.
- The fake adapter imports no provider SDK or networking API and has no
  persistence adapter.

## Verification performed

Numbers below come from a run performed on branch `feat/support-payments`,
against the simulated-payment hardening change applied on top of commit
`6c64529`. They are not carried over from an earlier run.

- Test-first RED phase, hardening pass: the new assertions for the campaign
  reference charset, `id` bounds, rehydration, runtime freezing, property
  laundering, gateway option capture, receipt derivation, the simulated
  request marker, and the cancel-on-failure path failed first — **42 failed,
  22 passed** across the three payment suites before any implementation
  change.
- Targeted payment simulation suites after implementation
  (`tests/unit/domain/supportPayment.test.ts`,
  `tests/unit/application/simulateSupportPayment.test.ts`,
  `tests/unit/infrastructure/fakePaymentGateway.test.ts`):
  **64 passed, 0 failed**.
- Full Vitest suite (`npm run test`): **369 passed, 55 skipped**
  (28 files passed, 17 skipped). The skipped suites require a PostgreSQL
  environment not available in this run.
- TypeScript: `npx tsc --noEmit --incremental false` passed with no output.
- ESLint: `npm run lint` passed with no findings.
- Static import review found no network, provider SDK, database, or Node I/O
  import in the simulation implementation.

## Non-negotiable limits

This approval ends if any of the following is introduced: a real card, Bizum,
or bank-transfer flow; hosted checkout; payment link; provider SDK; webhook;
IBAN/phone/card data; settlement/payout; refund; invoice; tax receipt; or a
claim that a simulated receipt represents money received.

A real-payment change requires a new threat model and architecture review,
provider-hosted payment collection, server-side signed idempotent webhook
verification, reconciliation, fraud controls, legal and tax ownership
decisions, retention policy, and end-to-end tests against a provider sandbox.
