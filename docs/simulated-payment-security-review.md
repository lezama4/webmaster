# Simulated payment security approval

## Decision

**Approved for demonstration-only simulation. Not approved for real payments.**

The implementation is a deliberately constrained Block 3 seam. It may show
simulated labels for card, Bizum, and bank transfer, but it does not call a
provider, collect payment credentials, issue payment instructions, store a
financial record, or transfer funds to an Artist or any other party.

## Controls reviewed

- `SupportPayment` accepts only a bounded positive safe-integer amount in EUR
  cents, categorical payer/method values, and a bounded campaign reference.
- Every serializable payment and receipt includes `simulated: true`.
- The state machine is `pending -> succeeded | declined | cancelled`; terminal
  states cannot transition again.
- The request contract has no PAN, CVV, IBAN, phone number, account number,
  webhook secret, provider token, outcome, or payout field.
- `simulateSupportPayment` creates the pending payment itself and sends the
  fake gateway only the safe categorical request shape.
- `FakePaymentGateway` receives its success/decline outcome only through
  trusted constructor configuration. Request data cannot cause a simulated
  success.
- The use case rejects a result that is not explicitly marked as simulated or
  does not have a `sim_` synthetic reference.
- The fake adapter imports no provider SDK or networking API and has no
  persistence adapter.

## Verification performed

- Test-first RED phase: the three new suites initially failed because the
  aggregate, port, use case, and fake adapter did not exist.
- Targeted payment simulation tests: **20 passed** after implementation.
- Full Vitest suite: **281 passed, 33 skipped**. The skipped suites require a
  PostgreSQL environment not available in this run.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- ESLint: `npm run lint` passed.
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
