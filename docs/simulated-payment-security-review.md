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
- The id charset is **enforced by denial, not by normalization**. An earlier
  version trimmed the value before testing the charset, so
  `"  support-payment-1  "` was silently accepted and rewritten. The id is
  system-generated, so a non-canonical id is malformed rather than repairable,
  and the trim was a lossy rewrite: it collapsed `"abc"`, `" abc "` and
  `"abc\n"` onto one id and therefore onto one receipt reference —
  contradicting the injectivity the adapter's own no-rewrite rule is built on.
  The length bound is now applied to the **raw** input, before any inspection
  that would materialize a second copy of it, so a whitespace-padded oversized
  string is rejected on its length instead of being copied first.
- Every serializable payment, gateway request, and receipt includes
  `simulated: true`. The request carries the marker too, so the one object
  handed to an adapter is not byte-for-byte indistinguishable from a real
  charge request.
- **Five objects are frozen**: the payment (`buildSupportPayment`), the
  receipt, the `SimulateSupportPaymentResult` wrapper, the outbound
  `SimulatedGatewayRequest`, and the `FakePaymentGateway.simulate` result. Each
  is asserted by a test. So `simulated: true` cannot be flipped and the
  aggregate cannot be swapped at the boundary. `readonly` is erased at compile
  time, so without the freeze `result.receipt.simulated = false` would have
  succeeded silently and an adapter could have run `delete request.simulated`
  before reading it. Freezing the aggregate alone bought nothing at the
  boundary while the wrapper holding it still allowed `result.payment` to be
  replaced by an unfrozen look-alike.
- The **thrown `FailedSimulationError` is NOT frozen** — it is an extensible
  `Error`, and the enumerated five above do not include it. It is protected
  **per property** instead: `cancelledPayment`, `causedByAdapterDefect` and
  `cause` are each own, non-enumerable, non-writable and non-configurable.
  `cause` is re-declared explicitly, because `Error` installs it writable and
  configurable; without that, the two routes the documents offer a handler —
  branch on the discriminator, or unwrap `cause` — would not be equally
  protected, since the locked flag could be read against a swapped cause. Each
  of the three descriptors — `cancelledPayment`, `causedByAdapterDefect` and
  `cause` — is asserted own, non-enumerable, non-writable and non-configurable
  by a test.
- The module-private allowed-value sets are frozen as well — `PAYER_KINDS`,
  `PAYMENT_METHODS`, `TERMINAL_STATUSES`, `SETTLEMENT_OUTCOMES`,
  `SIMULATED_GATEWAY_OUTCOMES` and `SIMULATED_OUTCOMES`, alongside the already
  frozen `SUPPORT_CAMPAIGN_REFERENCES`. Without it `TERMINAL_STATUSES.push(
  "pending")` would reopen the route `rehydrateSupportPayment` exists to close.
  These constants are not exported, so this is defence in depth against code
  inside the module and is **verified by inspection, not by a test**: a
  module-private constant exposes no behaviour a test can assert.
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
- **No validator in this flow echoes the value it rejected.** That is the
  security-relevant half and it holds without exception: `assertId`,
  `assertPending`, and every caller of `rejectUnknownValue` withhold the
  offending value. The enumerated `campaignReference` exists so an IBAN or a
  PAN cannot enter through that field; echoing the rejected payload into the
  error message would copy it into logs and error aggregators, reintroducing
  the channel. Withholding also keeps the assertion itself safe:
  `String(value)` throws `TypeError` for a null-prototype object, which would
  turn a domain denial into a programmer error.
- **Naming the field and the allowed set is narrower.** Only
  `rejectUnknownValue` does that, for `campaignReference`, `payerKind`,
  `method`, the settlement outcome, and the rehydrated status.
  `assertPending`'s message (`Cannot settle a SupportPayment that is not in
  'pending' state`) names neither a field nor an allowed set — it withholds the
  current status, which is the part that matters here and is asserted by a
  test, but it is not an instance of the field-plus-allowed-set convention and
  must not be cited as one.
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
- The use case rejects a gateway result that is **absent or not an object**,
  that is not explicitly marked as simulated, whose `receiptReference` is not a
  bounded `sim_`-prefixed **string**, or whose `outcome` is outside the
  `succeeded | declined` union. The shape check runs **before any property is
  dereferenced**: an adapter resolving to `undefined` or `null` would otherwise
  make the first read throw a bare `TypeError`, which carries no label this
  codebase recognises, so `causedByAdapterDefect` would have reported `false`
  for an unambiguous adapter defect. Each field is then read off the adapter's
  object exactly once, into a local, and the receipt and the settlement are
  built from those locals — an adapter exposing a getter cannot return one
  value to the check and another to the caller. The explicit `typeof` check
  runs before the pattern, because `RegExp.test` coerces and would otherwise
  let `{ toString: () => "sim_ok" }` land in a field typed `string`.
- The settlement call runs inside the guarded region, so **once the gateway
  call has settled**, a gateway rejection, a malformed result, a rejected
  receipt, a rejected outcome, or a refused settlement all cancel the pending
  payment. That qualifier is load-bearing: `await
  deps.paymentGateway.simulate(request)` has no timeout, so an adapter whose
  promise never settles leaves the payment `pending` with the `catch` never
  running. See known non-guarantee 9.
- An adapter-contract violation raises `AdapterContractError` from
  `@application/errors`, not a `DomainError`: a gateway response is not domain
  input, and a misbehaving adapter is a defect on our side of the boundary, not
  a rejected caller operation.
- **`AdapterContractError` never reaches `toErrorResponse` from this use
  case.** The argument is STRUCTURAL — about where each construction site sits
  relative to the use case's guarded region — not a count of sites, because a
  count goes stale the moment one is added or removed. Every site that can
  construct it on the REQUEST path lies inside that guarded region: thrown
  either directly in `validateGatewayResult`, or inside the adapter call the
  region awaits (`syntheticReference`, reached from `FakePaymentGateway.
  simulate`). That region's `catch` unconditionally rethrows a
  `FailedSimulationError`, so from this use case the error is structurally
  incapable of escaping and surfaces only as `FailedSimulationError.cause`; its
  "falls through to a generic 500" mapping is therefore unreachable from here.
  Every remaining site runs at WIRING time (constructing a `FakePaymentGateway`),
  before any call reaches the use case. The invariant is precise: no
  construction site sits on the request path OUTSIDE the guarded region, and
  that is the one condition a newly added site must preserve. (An earlier
  version of this document said the error was "only ever constructed inside the
  guarded region" and described all adapter sites as wiring-time; both were
  false, because `syntheticReference` runs on the request path. The conclusion
  survives because that path is awaited from inside the guarded region.)
- `FailedSimulationError` carries `causedByAdapterDefect`, an own,
  non-enumerable, non-writable, non-configurable boolean derived from whether
  `cause` is an `AdapterContractError`. It exists because the wrapping above
  ERASES the distinction at the thrown type: a future handler that mapped
  `FailedSimulationError` wholesale to a non-500 status would otherwise report
  adapter DEFECTS to clients under the same status as external gateway or
  infrastructure rejections, which is what splitting `AdapterContractError` out
  of the taxonomy was meant to prevent. Deriving it cannot itself throw:
  `instanceof` performs a prototype lookup a `Proxy` can trap, so the check is
  guarded. A cause it cannot classify is reported as **not** a defect — see
  known non-guarantee 3, which explains why that is a demotion rather than a
  conservative default.
- The `receiptReference` **shape** is enforced by the use case and now stated
  in the port contract: the `sim_` prefix, the `[A-Za-z0-9_-]` charset, and the
  132-character maximum. An adapter whose own scheme is longer or uses another
  charset is rejected at runtime with its payment cancelled, so an implementer
  reading only the interface had to be told. The **per-payment uniqueness**
  rule stays an adapter obligation the use case does not verify: an adapter
  returning a constant `sim_x` for every call passes the shape check, and
  verifying uniqueness would couple the application layer to an adapter's
  naming scheme. `FakePaymentGateway` discharges injectivity over payment ids
  only — see known non-guarantee 4 for what it does not discharge.
- `MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH` is an **independent defensive cap**
  on adapter-supplied text, not a consequence of a derivation. The port
  deliberately refuses to mandate how the adapter derives the reference, so no
  assumption about its naming scheme could justify a bound. The value is
  borrowed from the domain's id bound only because that is a known-generous
  size; the reason to bound at all is that the value is adapter-controlled,
  reaches the receipt and the logs, and the charset pattern is unbounded.
- `FakePaymentGateway` reads its configured outcome off the options object
  exactly once, into a local, and both validates and stores that local — the
  same read-once contract the use case applies to gateway results. It raises
  `AdapterContractError` from the project taxonomy for both a rejected
  configuration and a rejected payment id, rather than a bare `Error` that any
  exception assertion would satisfy.
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
  that later exposes this simulation must map it explicitly, and must branch on
  `causedByAdapterDefect` when it does.**
- **`FailedSimulationError` is raised for FAILURES ONLY. There is no
  business-outcome member of this class.** A gateway `outcome: "declined"`
  passes `validateGatewayResult`, is applied by `settleSupportPayment(payment,
  "declined")`, and the use case **resolves normally** with a `declined`
  payment; it never reaches this error. Every `FailedSimulationError` that can
  be constructed therefore represents an adapter throw, an adapter-contract
  violation, or a refused settlement. The discriminator separates an
  adapter-contract DEFECT (a bug on our side of the boundary) from a gateway or
  infrastructure REJECTION (an external failure) — **not** a defect from a
  business outcome. (Earlier revisions of this document, of
  `openspec/changes/add-simulated-support-payments/design.md`, of
  `src/application/errors.ts`, and a test name described a "legitimate
  decline-cancel" reaching this class. That case does not exist. Acting on the
  old wording would have made a handler return a business status for what is
  always an internal failure. The branch's own test, `settles with a
  gateway-owned declined outcome`, asserts the resolving path.)
- The failure message is derived defensively and cannot itself throw. It runs
  inside the `catch`, after the payment has already been cancelled, so a throw
  there would discard the cancelled payment and lose the cause. `message` is an
  arbitrary accessor that can throw or return a `Symbol`, and `String(value)`
  raises `TypeError` for a null-prototype object; every such read is guarded and
  falls back to a `typeof`-only description, which cannot fail. A non-`Error`
  rejection keeps its original value as `cause` instead of being flattened to
  `"[object Object]"`. The derived message is also **bounded** to
  `MAX_FAILED_SIMULATION_MESSAGE_LENGTH` (512 characters, truncation marker
  included), because it is adapter-supplied text that reaches logs and every
  other adapter-supplied value in this flow is bounded or withheld. Nothing is
  lost: the full value always survives verbatim on `cause`.
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
2. **No HTTP status is mapped for `FailedSimulationError`.** By inspection of
   `src/infrastructure/http/httpErrors.ts`, it has no case in
   `statusAndMessage`, so it falls through to a generic 500. This is stated
   from reading that file, not from a test: no route reaches it, so there is
   nothing to exercise. A future handler must map it, and that handler must
   bring the test with it. `AdapterContractError` is also unmapped, but that
   mapping is unreachable from `simulateSupportPayment` — see the next item.
3. **`causedByAdapterDefect` is a PARTIAL classifier, and its `false` branch
   silently absorbs unclassifiable failures.** It is exactly `cause instanceof
   AdapterContractError`, so it detects only defects **this codebase itself
   labels**. Genuine adapter defects that read `false`: an adapter throwing its
   own error type; an `AdapterContractError` originating in another realm
   (a worker, a `vm` context), where `instanceof` is false; and a cause behind
   a `Proxy` whose `getPrototypeOf` traps and throws, which the guard converts
   to `false` so that describing the failure cannot become a second failure.
   Because the documents instruct a handler to treat `false` as the non-defect
   branch, that guard **demotes** an unclassifiable failure instead of
   escalating it. Read `false` as "not labelled `AdapterContractError` here",
   never as "definitely not a defect". A result that is `undefined`, `null`, or
   a primitive is no longer in this set: `validateGatewayResult` now labels it
   before dereferencing, and five such shapes are asserted by tests.
   Everything thrown inside `simulateSupportPayment`'s guarded region leaves as
   a `FailedSimulationError`, so the thrown class alone never carries the
   distinction, and a handler that ignores the discriminator will report
   adapter defects under whatever status it chose for external rejections.
4. **Neither uniqueness nor non-reuse of `receiptReference` is verified.** Both
   are stated in the `PaymentGateway` port contract; the use case validates
   only shape, charset and length, so an adapter returning a constant `sim_x`
   for every call is not detected here. `FakePaymentGateway` discharges
   **injectivity over payment ids only** — it maps `id -> sim_<id>`, asserted
   against that adapter alone. It does **not** discharge non-reuse across
   calls: that holds only if `IdGenerator.next()` never repeats a value.
   `IdGenerator` now records that as an implementer obligation, but nothing
   checks it, and the test fake `SequentialIdGenerator` restarts its counter
   per instance and does not satisfy it.
5. **The freeze of the module-private allowed-value sets is verified by
   inspection, not by a test.** `PAYER_KINDS`, `PAYMENT_METHODS`,
   `TERMINAL_STATUSES`, `SETTLEMENT_OUTCOMES`, `SIMULATED_GATEWAY_OUTCOMES` and
   `SIMULATED_OUTCOMES` are not exported, so no test can reach them to assert
   `Object.isFrozen`. The frozen objects the flow HANDS OUT — payment, receipt,
   result wrapper, gateway request, gateway result — are each asserted by a
   test.
6. **No idempotency, no replay protection, no rate limit, no authentication.**
   None is present, because there is no endpoint. All are required before any
   caller can reach this use case over the network.
7. **The `simulated` and `currency` fields are hardcoded, not validated.**
   That is the intended design (see above), but it means these two fields carry
   no assertion a reviewer can point to.
8. **`Object.freeze` is shallow, and nothing enforces that it stays
   sufficient.** Today it is: the receipt, the gateway request, the gateway
   result and the payment hold only primitives, and the one nested container —
   the result wrapper — holds a payment and a receipt that are each frozen in
   their own right. A future nested field would need its own freeze, and no
   check would catch its absence.
9. **The gateway call is unbounded; "no payment is left in `pending`" holds
   only for calls that settle.** `await deps.paymentGateway.simulate(request)`
   has no timeout, no `AbortSignal`, and no deadline. An adapter whose promise
   never settles leaves its payment in `pending` forever and the `catch` that
   cancels it never runs, so the cancellation guarantee is scoped to gateway
   calls that resolve or reject. No test covers the hang, because there is
   nothing to observe. A timeout — and a policy for a call that completes after
   it — is required of the first caller that can reach this over the network,
   alongside the authentication and rate limiting in item 6.
10. **The thrown `FailedSimulationError` is not frozen.** The error object
    itself is extensible: a caller can add properties to it. Only
    `cancelledPayment`, `causedByAdapterDefect` and `cause` are locked, each
    own, non-enumerable, non-writable and non-configurable. The freeze claim
    above covers the five enumerated objects, not this one.

## Verification performed

Numbers come from runs performed on branch `feat/support-payments`. Every claim
in this document is one the latest (round-7) run supports; where a run did not
establish a guarantee, the guarantee is listed under "Known non-guarantees"
instead. The round-6 block below is retained as prior evidence; the round-7
block reflects the current state of the code and tests.

### Round 7 (current)

Round 7 closed a disputed read-once gap in the domain factory plus two
documentation claims that asserted more than the artifacts proved. The one code
change was written test-first.

- The read-once gap: every enumerated/amount assertion in `SupportPayment.ts`
  now RETURNS the value it validated, and every field is built from those
  returned locals. Previously a value was validated and then re-read off the
  input to store it, so a getter or `Proxy` on cast/deserialized input could
  pass a valid value to the check and smuggle a different one into the frozen
  aggregate (`amountCents: -999` on a `succeeded` payment; a forged `pending`
  from a status getter).
- Test-first RED phase: seven new cases in `supportPayment.test.ts` (a
  getter/Proxy whose second read differs, across `createSupportPayment`,
  `rehydrateSupportPayment`, `settleSupportPayment` and `cancelSupportPayment`)
  reported **7 failed** before the fix, each storing the smuggled `-999`/
  `pending` value; **all 7 passed** after applying the read-once discipline.
- Two `simulateSupportPayment.test.ts` descriptor assertions were strengthened
  to full own/non-enumerable/non-writable/non-configurable checks for
  `cancelledPayment` and `causedByAdapterDefect`. The code already implemented
  these; temporarily setting either property to `configurable: true` made both
  assertions fail, confirming they constrain the descriptor, and reverting made
  them pass. This makes the document's "each of the three descriptors is
  asserted by a test" claim true.
- The `AdapterContractError` construction-site claim was restated STRUCTURALLY
  ("no construction site on the request path outside the guarded region")
  instead of by a count that had already gone stale.
- Full Vitest suite (`npm run test`): **594 passed, 61 skipped**
  (39 files passed, 18 skipped) — the round-6 total plus the 7 added this round,
  with no pre-existing test's behaviour changed. The skipped suites require a
  PostgreSQL environment not available in this run.
- TypeScript: `npx tsc --noEmit` exited 0 with no output.
- ESLint: `npm run lint` exited 0 with no findings.

### Round 6 (prior)

Round 6 was **documentation-only except for two code changes**, each written
test-first. It corrected claims that asserted more than the code does; it added
no security control, because the review found none missing.

- Baseline before this round (`npm run test`): **473 passed, 55 skipped**
  (28 files passed, 17 skipped).
- Test-first RED phase, round 6: `simulateSupportPayment.test.ts` reported
  **3 failed, 33 passed** (36 tests). The three failures were: a gateway
  resolving to `undefined` and one resolving to `null`, each of which produced
  a bare `TypeError` as `cause` instead of an `AdapterContractError` (and so
  `causedByAdapterDefect === false` for an unambiguous adapter defect); and
  `FailedSimulationError.cause` being writable, so a caller could swap the
  value the locked discriminator was derived from. The three `it.each` cases
  for a string, a number and a boolean result passed already — a primitive is
  boxed on property access, so `simulated` read as `undefined` and the existing
  check rejected it.
- Both changes are two-line guards:
  `validateGatewayResult` now rejects a non-object result before dereferencing
  it, and the `FailedSimulationError` constructor re-declares `cause` as
  non-writable and non-configurable.
- Targeted payment simulation suites after the change
  (`tests/unit/domain/supportPayment.test.ts`,
  `tests/unit/application/simulateSupportPayment.test.ts`,
  `tests/unit/infrastructure/fakePaymentGateway.test.ts`):
  **174 passed, 0 failed** (3 files) — the previous 168 plus the 6 added this
  round.
- Full Vitest suite (`npm run test`): **479 passed, 55 skipped**
  (28 files passed, 17 skipped) — the baseline 473 plus the 6 added this round,
  with no pre-existing test modified. The skipped suites require a PostgreSQL
  environment not available in this run.
- TypeScript: `npx tsc --noEmit --incremental false` exited 0 with no output.
- ESLint: `npm run lint` exited 0 with no findings.
- Carried forward from round 5 and NOT re-run this round: the independent
  adversarial re-check of the six campaign payloads and the six non-canonical
  id payloads outside the committed suite. Those behaviours are unchanged by
  this round and remain covered by the committed domain suite, which passed
  above.
- Static import review, re-run this round over
  `src/domain/support-payment/`, `src/application/ports/PaymentGateway.ts`,
  `src/application/ports/IdGenerator.ts`,
  `src/application/use-cases/simulateSupportPayment.ts`,
  `src/application/errors.ts`, and `src/infrastructure/payment/`: every import
  statement in these files resolves inside the project (`@domain/...`,
  `@application/...`, `../errors`) — five `import type` and five value imports,
  the latter being the domain factories, the domain id bound, and the two error
  classes. `IdGenerator.ts` imports nothing. There is no dynamic
  `import()`/`require()` and no occurrence of `fetch`, `XMLHttpRequest`,
  `WebSocket`, `http`/`https`, `net`, `PrismaClient`, or `process.env`. This
  round added no import to any of these files.

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
