# Simulated payment security approval

## Decision

**Approved for demonstration-only simulation. Not approved for real payments.**

The implementation is a deliberately constrained Block 3 seam. It may show
simulated labels for card, Bizum, and bank transfer, but it does not call a
provider, collect payment credentials, issue payment instructions, store a
financial record, or transfer funds to an Artist or any other party.

## Controls reviewed

- `SupportPayment` has **no free-text field**. It accepts only a bounded
  positive safe-integer amount in EUR cents, categorical payer/method values,
  an opaque `id`, and a campaign reference drawn from a closed, frozen set of
  system-issued campaign identifiers (`SUPPORT_CAMPAIGN_REFERENCES`).
- The campaign reference is an **enumerated identifier, not a charset rule**.
  A charset rule was tried and rejected: an IBAN begins with an ISO 3166
  country code, and a caller can prefix a PAN or phone number with letters, so
  a "must contain a letter" slug pattern accepts `es9121000418450200051332`,
  `es91-2100-0418-4502-0005-1332`, `card-4111111111111111`,
  `visa-4111-1111-1111-1111`, `tel-34600123456` and
  `pan4111111111111111-cvv123`. With a closed set there is no field a donor
  can type into, so the channel is removed by construction. Each of those six
  payloads is asserted denied by a test in
  `tests/unit/domain/supportPayment.test.ts`.
- `id` is constrained to an opaque identifier charset (`[A-Za-z0-9_-]+`) and
  bounded, in both `createSupportPayment` and `rehydrateSupportPayment`. It is
  the value forwarded to the adapter as `SimulatedGatewayRequest.paymentId`, so
  an IBAN, PAN, NUL byte, newline, bidi-override glyph, or raw markup cannot
  reach the gateway request through it.
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
- `settleSupportPayment` and `cancelSupportPayment` re-run every field
  assertion before rebuilding, not only the `status` check. A cast or
  deserialized object carrying a corrupt **known** value — `amountCents: -999`,
  an unknown campaign reference, a PAN in `id`, an unknown payer kind or
  method — cannot emerge as a frozen, valid-looking terminal payment.
- `rehydrateSupportPayment` re-runs every assertion, so persisted or
  transported data cannot re-enter the model unvalidated, and it accepts only
  a **terminal** status. It therefore cannot be used as an exported status
  setter that reopens a `succeeded` payment as `pending` and settles it again
  to the opposite outcome. A `pending` payment is produced only by
  `createSupportPayment` from its own validated inputs.
- The request contract has no PAN, CVV, IBAN, phone number, account number,
  webhook secret, provider token, outcome, or payout field.
- `simulateSupportPayment` creates the pending payment itself and sends the
  fake gateway only the safe categorical request shape.
- `FakePaymentGateway` receives its success/decline outcome only through
  trusted constructor configuration, validates it against the allowed union,
  and captures it as a scalar at construction. Request data cannot cause a
  simulated success, and mutating the caller's options object afterwards
  cannot flip an already-wired outcome.
- The synthetic receipt reference is the identity mapping of the payment id
  onto `sim_<id>`, so it is injective: distinct payment ids always produce
  distinct references, across gateway instances. The adapter rejects a payment
  id outside the opaque charset rather than rewriting it, because a rewrite
  would collapse `pay 1`, `pay.1`, `pay/1` and `pay+1` onto the same reference.
  The adapter enforces this itself and does not rely on upstream validation.
- The use case rejects a gateway result that is not explicitly marked as
  simulated, that does not have a `sim_` synthetic reference, **or whose
  `outcome` is outside the `succeeded | declined` union**. The settlement call
  itself runs inside the guarded region, so a gateway rejection, a rejected
  receipt, a rejected outcome, or a refused settlement all cancel the pending
  payment. No payment is left in `pending`.
- A failed simulation is reported as a dedicated `FailedSimulationError` that
  wraps the original rejection as `cause` and carries the cancelled payment as
  an own, non-enumerable, non-writable property. The previous approach assigned
  that property onto the caught error, which mutated any module-level error
  constant an adapter reuses (two failures overwriting each other's cancelled
  payment), serialized the whole aggregate into structured logs, and threw
  outright if the adapter froze its error. A non-`Error` rejection keeps its
  original value as `cause` instead of being flattened to `"[object Object]"`,
  and the message is derived with `typeof`, which cannot itself throw.
- `isFailedSimulationError` is an `instanceof` check. It no longer narrows on
  `"cancelledPayment" in error`, which walked the prototype chain and never
  inspected the value.
- The fake adapter imports no provider SDK or networking API and has no
  persistence adapter.

## Verification performed

Numbers below come from runs performed on branch `feat/support-payments`,
against the round-2 hardening change applied on top of commit `cceec7c`. They
are not carried over from an earlier run.

- Test-first RED phase, round-2 hardening: the domain suite failed to load at
  all, because the enumerated campaign identifier export it now imports did not
  exist yet; the application and infrastructure suites reported **17 failed,
  15 passed**. The failing assertions covered the enumerated campaign
  reference, the `id` charset, transition revalidation, terminal-only
  rehydration, `FailedSimulationError`, outcome validation, and injective
  receipt derivation.
- Targeted payment simulation suites after implementation
  (`tests/unit/domain/supportPayment.test.ts`,
  `tests/unit/application/simulateSupportPayment.test.ts`,
  `tests/unit/infrastructure/fakePaymentGateway.test.ts`):
  **117 passed, 0 failed**.
- Independent re-check of the six adversarial payloads outside the committed
  suite: all six returned `DENIED (DomainValidationError)` against the allowed
  set `["campaign-music-ward", "campaign-artist-residency",
  "campaign-hospital-outreach", "campaign-general-fund"]`.
- Full Vitest suite (`npm run test`): **422 passed, 55 skipped**
  (28 files passed, 17 skipped). The skipped suites require a PostgreSQL
  environment not available in this run.
- TypeScript: `npx tsc --noEmit --incremental false` exited 0 with no output.
- ESLint: `npm run lint` exited 0 with no findings.
- Static import review of `src/domain/support-payment/`,
  `src/application/ports/PaymentGateway.ts`,
  `src/application/use-cases/simulateSupportPayment.ts`, and
  `src/infrastructure/payment/` found only intra-project type and error
  imports — no network, provider SDK, database, or Node I/O import.

## Non-negotiable limits

This approval ends if any of the following is introduced: a real card, Bizum,
or bank-transfer flow; hosted checkout; payment link; provider SDK; webhook;
IBAN/phone/card data; settlement/payout; refund; invoice; tax receipt; a
free-text or caller-supplied campaign reference; or a claim that a simulated
receipt represents money received.

A real-payment change requires a new threat model and architecture review,
provider-hosted payment collection, server-side signed idempotent webhook
verification, reconciliation, fraud controls, legal and tax ownership
decisions, retention policy, and end-to-end tests against a provider sandbox.
