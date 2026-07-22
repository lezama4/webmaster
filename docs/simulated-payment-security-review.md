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
- The state machine is `pending -> succeeded | declined | cancelled`;
  `settleSupportPayment` and `cancelSupportPayment` deny any transition out of
  a terminal state. Every payment is returned frozen, so that holds at runtime
  and not only through compile-time `readonly`: an existing payment object
  cannot have its `status` reassigned back to `pending` and `simulated` cannot
  be flipped to `false`.
- Payments are always built field by field from a known field list, never by
  spreading a previous value. A cast or deserialized object carrying extra
  properties (`pan`, `cvv`, `iban`, `payoutAccount`) cannot launder them into
  a settled payment.
- `settleSupportPayment` and `cancelSupportPayment` re-assert the five
  caller-supplied fields (`id`, `campaignReference`, `amountCents`,
  `payerKind`, `method`) before rebuilding, not only the `status` check. A cast
  or deserialized object carrying a corrupt **known** value — `amountCents:
  -999`, an unknown campaign reference, a PAN in `id`, an unknown payer kind or
  method — cannot emerge as a frozen, valid-looking terminal payment.
  `currency` and `simulated` are deliberately not asserted, because they are
  never read from the input at all: `buildSupportPayment` hardcodes both on
  every construction, so a corrupt incoming value for either is discarded
  rather than validated.
- Validators that reject an untrusted value report the **field name and the
  allowed set, never the rejected value** — `campaignReference`, `payerKind`,
  `method`, the settlement outcome, the rehydrated status, and the current
  status in a denied transition. The enumerated `campaignReference`
  exists so an IBAN or a PAN cannot enter through that field; echoing the
  rejected payload into the error message would copy it into logs and error
  aggregators, reintroducing the channel. It also keeps the assertion itself
  safe: `String(value)` throws `TypeError` for a null-prototype object, which
  would turn a domain denial into a programmer error.
- `rehydrateSupportPayment` **trusts the persisted status** and re-asserts
  every caller-supplied field, so persisted or transported data cannot re-enter
  the model unvalidated. It refuses to produce `pending`, so a terminal record
  cannot be reconstructed as an unsettled one and driven through settlement a
  second time; a `pending` payment is produced only by `createSupportPayment`
  from its own validated inputs.
- **Terminal-outcome immutability is NOT enforced by this change, and cannot
  be.** A record persisted as `declined` can be rehydrated as `succeeded`:
  `rehydrateSupportPayment({ ...declinedFields, status: "succeeded" })` returns
  a frozen, valid `succeeded` payment. Rejecting `pending` closes only the
  two-step route (reopen, then settle); the one-step route is open by design.
  `rehydrateSupportPayment` is a pure function — it receives one input and has
  no prior status to compare against, so the check is not merely absent, it is
  impossible at that signature. Terminal-outcome immutability is a
  **persistence-layer invariant**, and this change ships no persistence.
  Whatever repository later stores these records MUST enforce it: a status
  column that leaves `pending` exactly once and is never rewritten afterwards,
  enforced by the store (a conditional update guarded on the current status, or
  an append-only event log). This is recorded as a hand-off requirement, not as
  a control delivered here.
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
  The adapter enforces both the charset **and the length bound** itself and
  does not rely on upstream validation: the charset pattern is unbounded, so
  without the bound an in-charset multi-megabyte id would have produced a
  multi-megabyte reference.
- The use case rejects a gateway result that is not explicitly marked as
  simulated, whose `receiptReference` is not a bounded `sim_`-prefixed
  **string**, or whose `outcome` is outside the `succeeded | declined` union.
  Each field is read off the adapter's object exactly once, into a local, and
  the receipt and the settlement are built from those locals — an adapter
  exposing a getter cannot return one value to the check and another to the
  caller. The explicit `typeof` check runs before the pattern, because
  `RegExp.test` coerces and would otherwise let `{ toString: () => "sim_ok" }`
  land in a field typed `string`. The settlement call runs inside the guarded
  region, so a gateway rejection, a rejected receipt, a rejected outcome, or a
  refused settlement all cancel the pending payment. No payment is left in
  `pending`.
- An adapter-contract violation raises `AdapterContractError` from
  `@application/errors`, not a `DomainError`: a gateway response is not domain
  input, and a misbehaving adapter is a defect on our side of the boundary, not
  a rejected caller operation.
- A failed simulation is reported as `FailedSimulationError`, a member of the
  application error taxonomy in `@application/errors` (it extends
  `ApplicationError` and takes its `name` from the taxonomy's `new.target.name`
  convention). It wraps the original rejection as `cause` and carries the
  cancelled payment as an own, non-enumerable, non-writable property. The
  previous approach assigned that property onto the caught error, which mutated
  any module-level error constant an adapter reuses (two failures overwriting
  each other's cancelled payment), serialized the whole aggregate into
  structured logs, and threw outright if the adapter froze its error.
  No HTTP status is mapped for it, because this change introduces no route;
  like any unmapped error it would fall through to a generic 500. **A handler
  that later exposes this simulation must map it explicitly** — a
  declined-then-cancelled simulation is an ordinary business outcome, not an
  internal failure.
- The failure message is derived defensively and cannot itself throw. It runs
  inside the `catch`, after the payment has already been cancelled, so a throw
  there would discard the cancelled payment and lose the cause. `message` is an
  arbitrary accessor that can throw or return a `Symbol`, and `String(value)`
  raises `TypeError` for a null-prototype object; every such read is guarded and
  falls back to a `typeof`-only description, which cannot fail. A non-`Error`
  rejection keeps its original value as `cause` instead of being flattened to
  `"[object Object]"`.
- `isFailedSimulationError` is an `instanceof` check. It no longer narrows on
  `"cancelledPayment" in error`, which walked the prototype chain and never
  inspected the value.
- The fake adapter imports no provider SDK or networking API and has no
  persistence adapter.

## Known non-guarantees

Stated here so no reader has to infer them from the absence of a claim.

1. **Terminal-outcome immutability is not implemented.** Detailed above. It is
   a persistence-layer invariant and this change has no persistence. Required
   of whatever repository later stores these records.
2. **No HTTP status is mapped for `FailedSimulationError` or
   `AdapterContractError`.** By inspection of
   `src/infrastructure/http/httpErrors.ts`, neither class has a case in
   `statusAndMessage`, so both fall through to a generic 500. This is stated
   from reading that file, not from a test: no route reaches these errors, so
   there is nothing to exercise. A future handler must map them, and that
   handler must bring the test with it.
3. **No idempotency, no replay protection, no rate limit, no authentication.**
   None is present, because there is no endpoint. All are required before any
   caller can reach this use case over the network.
4. **The `simulated` and `currency` fields are hardcoded, not validated.**
   That is the intended design (see above), but it means these two fields carry
   no assertion a reviewer can point to.

## Verification performed

Numbers below come from runs performed on branch `feat/support-payments`,
against the round-4 correction applied on top of commit `7f93a9d`. They are not
carried over from an earlier run. Every claim in this document is one these
runs support; where a run did not establish a guarantee, the guarantee is
listed under "Known non-guarantees" instead.

- Baseline before this round (`npm run test`): **422 passed, 55 skipped**
  (28 files passed, 17 skipped).
- Test-first RED phase, round 4, first cycle: the three targeted payment suites
  reported **30 failed, 116 passed** (146 tests, 3 files failed). The failing
  assertions covered hostile-value denial and non-echoing rejection messages
  for `campaignReference`/`payerKind`/`method`/settlement outcome/rehydrated
  status, `FailedSimulationError` membership in the application taxonomy,
  `AdapterContractError` as the cause of a gateway-contract violation,
  survival of a hostile rejection whose `message` throws or is a
  symbol/null-prototype object, single-read validation and length bounding of
  `receiptReference` and `outcome`, and the adapter's payment-id length bound.
- Test-first RED phase, round 4, second cycle: after a review of the
  implemented code found `assertPending` echoing the current status, the domain
  suite reported **4 failed, 104 passed** until that message was withheld too.
- Targeted payment simulation suites after implementation
  (`tests/unit/domain/supportPayment.test.ts`,
  `tests/unit/application/simulateSupportPayment.test.ts`,
  `tests/unit/infrastructure/fakePaymentGateway.test.ts`):
  **150 passed, 0 failed**.
- Independent re-check of the six adversarial payloads outside the committed
  suite: all six returned `DENIED (DomainValidationError)` against the allowed
  set `["campaign-music-ward", "campaign-artist-residency",
  "campaign-hospital-outreach", "campaign-general-fund"]`, and for all six the
  error message did **not** contain the rejected payload. The throwaway check
  file was deleted after the run.
- Full Vitest suite (`npm run test`): **455 passed, 55 skipped**
  (28 files passed, 17 skipped) — the baseline 422 plus 33 tests added this
  round. The skipped suites require a PostgreSQL environment not available in
  this run.
- TypeScript: `npx tsc --noEmit --incremental false` exited 0 with no output.
- ESLint: `npm run lint` exited 0 with no findings.
- Static import review of `src/domain/support-payment/`,
  `src/application/ports/PaymentGateway.ts`,
  `src/application/use-cases/simulateSupportPayment.ts`,
  `src/application/errors.ts`, and `src/infrastructure/payment/` found only
  intra-project type and error imports (`@domain/...`, `@application/...`,
  `../errors`), no dynamic `import()`/`require()`, and no occurrence of
  `fetch`, `XMLHttpRequest`, `WebSocket`, `http`/`https`, `net`,
  `PrismaClient`, or `process.env`.

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
