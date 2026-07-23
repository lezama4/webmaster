# Tasks — simulated support payments

## 1. Specification and security boundary

- [x] 1.1 Define a simulation-only scope with no financial credentials, network,
  provider account, payout, or persistence.
- [x] 1.2 Define payer/method categories, cent-based money, terminal states, and
  gateway-owned result semantics.

## 2. Domain — test first

- [x] 2.1 Add failing unit tests for SupportPayment construction, amount bounds,
  state transitions, terminality, and forbidden-field contract.
- [x] 2.2 Implement the framework-free SupportPayment aggregate and transitions.

## 3. Application and fake adapter — test first

- [x] 3.1 Add failing application tests for gateway-owned success/decline and
  explicit simulated receipts.
- [x] 3.2 Add PaymentGateway port and simulateSupportPayment use case.
- [x] 3.3 Add a no-network FakePaymentGateway adapter.

## 4. Verification

- [x] 4.1 Run the full unit suite and correct failures.
- [x] 4.2 Run TypeScript typecheck and ESLint.
- [x] 4.3 Review imports and confirm no real-payment identifier, network call,
  provider SDK, or financial persistence was introduced.

## 5. Post-review hardening — test first

- [x] 5.1 Constrain `campaignReference` to a slug charset and bound/trim `id`,
  so neither field can carry financial or control-character data.
  **Superseded by 6.1: the charset rule did not hold — see below.**
- [x] 5.2 Add `rehydrateSupportPayment`, build every payment field by field,
  and freeze it so terminal states and `simulated` hold at runtime.
- [x] 5.3 Validate and capture the fake adapter outcome at construction, and
  derive the synthetic receipt reference from the payment id.
- [x] 5.4 Mark the gateway request `simulated: true` and cancel the pending
  payment when the gateway call or its receipt check fails.
- [x] 5.5 Regenerate the security approval evidence from an actual run.

## 6. Round-2 hardening — test first

- [x] 6.1 Replace the free-text `campaignReference` with a closed, frozen set
  of system-issued campaign identifiers and delete the slug pattern. The
  pattern's "must contain a letter" lookahead could not reject an IBAN
  (`es9121000418450200051332`), a letter-prefixed PAN
  (`card-4111111111111111`), or a letter-prefixed phone number
  (`tel-34600123456`); an enumeration removes the channel by construction.
- [x] 6.2 Constrain `id` to an opaque identifier charset in both
  `createSupportPayment` and `rehydrateSupportPayment`, since it is forwarded
  to the adapter as `paymentId`.
- [x] 6.3 Re-run every field assertion inside `settleSupportPayment` and
  `cancelSupportPayment`, so a corrupt known value cannot reach a terminal
  state through a cast or a deserializer.
  **Wording corrected by 7.8: the five caller-supplied fields are re-asserted;
  `currency` and `simulated` are hardcoded and never asserted.**
- [x] 6.4 Restrict `rehydrateSupportPayment` to terminal statuses, so it cannot
  reopen a settled payment as `pending`.
  **Claim narrowed by 7.1: this closes the two-step reopen-then-settle route
  only. It does NOT prevent an outcome flip — see below.**
- [x] 6.5 Replace the `Object.assign`-onto-the-caught-error failure path with a
  `FailedSimulationError` class carrying the original as `cause` and the
  cancelled payment as a non-enumerable, non-writable own property, and replace
  the `in`-based type guard with `instanceof`.
- [x] 6.6 Validate the gateway `outcome` against the simulated union and move
  the settlement inside the guarded region, so no failure path abandons a
  payment in `pending`.
- [x] 6.7 Make the synthetic receipt derivation injective: reject a non-opaque
  payment id in the adapter instead of rewriting it onto a colliding reference.
- [x] 6.8 Align the security approval, the aggregate doc comment, and this spec
  with what the code demonstrably enforces, and regenerate the evidence numbers
  from an actual run.

## 7. Round-4 correction — retract an unearned claim, then fix

Rounds 1-3 each narrowed a control and then strengthened the prose to claim a
whole class of attack was closed. Round 4 stops that pattern. 7.1 is a
documentation correction with no behavioural change; it was taken as a product
decision *not* to add the control.

- [x] 7.1 Retract the outcome-immutability claim from the aggregate doc
  comment, the security approval, this spec, and the proposal safety contract.
  Rejecting `pending` closes only the two-step route (reopen, then settle); the
  one-step route — `rehydrateSupportPayment({ ...declinedFields, status:
  "succeeded" })` — was never closed, and cannot be at that signature, because
  a pure function has no prior status to compare against. Record it as a
  persistence-layer invariant required of any future repository, and rename the
  tests that implied the removed guarantee.
- [x] 7.2 Derive the failure message defensively: reading an arbitrary
  `message` accessor inside the `catch` could throw and discard the already
  cancelled payment.
- [x] 7.3 Move `FailedSimulationError` into `@application/errors` and extend
  `ApplicationError`, so it sits inside the documented error taxonomy and takes
  its `name` from the `new.target.name` convention.
- [x] 7.4 Raise `AdapterContractError` (application layer) instead of
  `DomainValidationError` for a gateway-contract violation.
- [x] 7.5 Stop echoing rejected untrusted values in domain validator messages,
  for `campaignReference`, `payerKind`, `method`, settlement outcome,
  rehydrated status, and the current status in `assertPending`. This subsumes
  the narrower `String(value)` fix: `String()` itself throws `TypeError` on a
  null-prototype object, and echoing the value leaks it into logs.
- [x] 7.6 Read `receiptReference` and `outcome` off the gateway result exactly
  once, assert `typeof receiptReference === "string"`, bound its length, and
  build both the receipt and the settlement from the validated locals.
- [x] 7.7 Enforce the payment id length bound in `FakePaymentGateway`, not only
  its charset.
- [x] 7.8 Reword `assertKnownFields` and the security approval: `currency` and
  `simulated` are hardcoded by `buildSupportPayment` and never asserted, so
  "re-runs every field assertion" was inaccurate.
- [x] 7.9 Regenerate the evidence numbers from an actual run and add an explicit
  "Known non-guarantees" section to the security approval.

## 8. Round-5 hardening — test first

- [x] 8.1 Correct `src/application/errors.ts`, the security approval, and the
  design doc: `AdapterContractError` cannot reach `toErrorResponse` from
  `simulateSupportPayment`, because it is only ever constructed inside the
  guarded region whose `catch` unconditionally rethrows a
  `FailedSimulationError`. It surfaces only as `cause`.
- [x] 8.2 Add `FailedSimulationError.causedByAdapterDefect` — an own,
  non-enumerable, non-writable boolean derived from `cause instanceof
  AdapterContractError`, with the derivation guarded against a trapped
  prototype lookup. Without it, a handler following the documented advice to
  map `FailedSimulationError` to a business status would report adapter DEFECTS
  as ordinary business outcomes. Record the type erasure as a known
  non-guarantee.
- [x] 8.3 Make `assertId` DENY a non-canonical id instead of trimming it, and
  bound the RAW input before any normalization. `trim()` accepted
  `"  support-payment-1  "` where the spec says whitespace MUST be denied, and
  it was a lossy rewrite that collapsed `"abc"`, `" abc "` and `"abc\n"` onto
  one id and therefore one receipt reference — contradicting the injectivity
  the adapter's no-rewrite rule is built on. Rename the test that asserted the
  old behaviour.
- [x] 8.4 Freeze every object the flow hands out: the receipt, the
  `SimulateSupportPaymentResult` wrapper, the outbound `SimulatedGatewayRequest`
  and the `FakePaymentGateway.simulate` result. `readonly` is erased at compile
  time, so the security approval's freeze argument only held for the aggregate.
- [x] 8.5 Bound the derived `FailedSimulationError.message`, which otherwise
  propagated unbounded adapter-supplied text into logs. The full value survives
  on `cause`.
- [x] 8.6 Freeze the remaining module-private allowed-value sets
  (`PAYER_KINDS`, `PAYMENT_METHODS`, `TERMINAL_STATUSES`,
  `SETTLEMENT_OUTCOMES`, `SIMULATED_GATEWAY_OUTCOMES`, `SIMULATED_OUTCOMES`);
  `TERMINAL_STATUSES.push("pending")` would have reopened the route
  `rehydrateSupportPayment` exists to close. Not exported, so recorded as
  verified by inspection rather than by a test.
- [x] 8.7 Read the `FakePaymentGateway` configured outcome exactly once, and
  raise `AdapterContractError` from the project taxonomy at both of its throw
  sites instead of a bare `Error` that `.toThrow(Error)` could not distinguish.
- [x] 8.8 State per-payment `receiptReference` uniqueness as an adapter
  obligation in the `PaymentGateway` port contract, not verified by the use
  case, and record it under "Known non-guarantees" — rather than coupling the
  use case to the adapter's naming scheme.
- [x] 8.9 Regenerate the security approval evidence numbers from an actual run.

> Round 6 superseded two claims recorded above. **8.1** is false as written:
> `AdapterContractError` is constructed at more than the guarded region alone —
> a request-path site (`syntheticReference`) and a wiring-time site both exist —
> see 9.1.
> **8.2**'s framing of the alternative as "ordinary business outcomes" is false:
> a declined gateway outcome resolves normally and never reaches
> `FailedSimulationError` — see 9.2.

## 9. Round-6 correction — documentation, plus two test-first code changes

Round 6 of the adversarial review returned zero CRITICALs for the second
consecutive round. Every remaining finding was a sentence asserting more than
the code does. No security control was missing.

- [x] 9.1 Correct the `AdapterContractError` construction-site claim in
  `src/application/errors.ts`, the security approval, and the design doc. State
  it STRUCTURALLY, not by count: every site that constructs it on the REQUEST
  path is inside the use case's guarded region (in `validateGatewayResult`, or
  in the adapter call the region awaits — `syntheticReference`), and every
  remaining site runs at wiring time (constructing a `FakePaymentGateway`). The
  old wording said "only ever constructed inside the guarded region" and
  characterised all adapter sites as wiring-time, but `syntheticReference` runs
  on the request path; the conclusion survives because that path is awaited from
  inside the guarded region. A count would go stale — 9.3 below adds another
  site to `validateGatewayResult` — so the invariant is stated as "no
  construction site on the request path outside the guarded region" instead.
  (Round 6 stated this as "four sites, two in `validateGatewayResult`"; 9.3 made
  that three-in-`validateGatewayResult`, which is why the structural form
  replaced it in round 7.)
- [x] 9.2 Delete the "legitimate decline-cancel" case from
  `src/application/errors.ts`, the security approval, the design doc, and the
  test describe block. It does not exist: a gateway `outcome: "declined"`
  passes validation, is settled by `settleSupportPayment(payment, "declined")`,
  and the use case RESOLVES normally — asserted by "settles with a
  gateway-owned declined outcome". Every constructible
  `FailedSimulationError` is a failure, so the discriminator separates an
  adapter-contract DEFECT from a gateway/infrastructure REJECTION, never from a
  business outcome. The old wording would have led a handler to return a
  business status for what is always an internal failure.
- [x] 9.3 (code, test first) Raise `AdapterContractError` in
  `validateGatewayResult` for a result that is absent or not an object, BEFORE
  dereferencing any property. A gateway resolving to `undefined`/`null`
  previously produced a bare `TypeError`, which carries no label this codebase
  recognises, so `causedByAdapterDefect` reported `false` for an unambiguous
  defect. Document the discriminator as a PARTIAL classifier and record the
  remaining cases (an adapter throwing its own type, a cross-realm error, a
  trapped prototype lookup) as a known non-guarantee, noting that the `false`
  branch DEMOTES an unclassifiable failure rather than escalating it.
- [x] 9.4 (code, test first) Re-declare `FailedSimulationError.cause` as own,
  non-enumerable, non-writable and non-configurable. `Error` installs it
  writable and configurable, so the two routes the documents offer a handler —
  branch on the discriminator, or unwrap `cause` — were not equally protected.
- [x] 9.5 State the `receiptReference` prefix, charset and 132-character
  maximum as explicit obligations in the `SimulatedGatewayResult` contract: the
  use case enforces all three and cancels the payment otherwise, and an adapter
  author reading only the interface had no way to learn them. Rejustify
  `MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH` as an independent defensive cap
  rather than as a consequence of a derivation the port refuses to mandate.
- [x] 9.6 Scope the freeze claim to the five enumerated objects and record the
  thrown `FailedSimulationError` as extensible but protected per property.
- [x] 9.7 Qualify "no payment is left in `pending`" to gateway calls that
  SETTLE, in the use case, the security approval, and the spec scenario. The
  `await` has no timeout, so a hanging adapter strands a payment with the
  `catch` never running. Added as a known non-guarantee.
- [x] 9.8 Split the validator claim in the security approval and the spec:
  value-withholding holds for ALL validators; reporting the field name and the
  allowed set applies to the enumerated denials only, not to `assertPending`,
  whose message names neither.
- [x] 9.9 Correct the uniqueness claim. `FakePaymentGateway` discharges
  injectivity over payment ids only. Non-reuse across calls depends on
  `IdGenerator.next()` never repeating, now stated as a precondition on that
  port; `SequentialIdGenerator` restarts per instance and does not satisfy it.
- [x] 9.10 Add the missing delta-spec scenarios: a declined outcome is not a
  failure, a malformed gateway result is classified rather than dereferenced,
  the adapter-defect discriminator and its locked descriptors, the bounded
  failure message, and the runtime freezing of the receipt, result wrapper,
  outbound request and gateway result.
- [x] 9.11 Regenerate the security approval evidence numbers from an actual
  run.

## 10. Round-7 correction — one code gap, two documentation truths

Round 7 ended ESCALATED on a disputed finding: one judge proved a read-once gap
in the domain factory; the other did not report it because the reachable callers
pass plain data. It is a real gap in a stated guarantee, exercised by a hostile
in-process object — the adversary the module's own doc comments name. Fixed
here, test-first, together with two documentation claims that asserted more than
the artifacts prove.

- [x] 10.1 (code, test first) Make every enumerated/amount assertion in
  `SupportPayment.ts` RETURN the value it validated, and build every field from
  those returned locals — never a second read of `input.x` after validating it.
  A getter or `Proxy` on cast/deserialized input could otherwise pass a valid
  value to the check and store a different one (`amountCents: -999` on a frozen
  `succeeded` payment; a forged `pending` from a status getter). This is the
  read-once discipline `validateGatewayResult` and `FakePaymentGateway` already
  apply. Covered for `createSupportPayment`, `rehydrateSupportPayment`,
  `settleSupportPayment` and `cancelSupportPayment`.
- [x] 10.2 Replace the `AdapterContractError` construction-site COUNT ("four
  sites, two in `validateGatewayResult`") with a STRUCTURAL statement in
  `src/application/errors.ts`, the security approval, the design doc, and this
  file. The count was already stale — 9.3 added a third `validateGatewayResult`
  site — and this file said "two" in 9.1 while 9.3 adds a third. The invariant
  is now stated as "no construction site on the request path outside the guarded
  region", which stays true as sites are added or removed.
- [x] 10.3 (test first) Make the "both descriptors are asserted by tests" claim
  true rather than weaken it. `cause` had a full descriptor assertion;
  `cancelledPayment` asserted only enumerable/writable; `causedByAdapterDefect`
  had no descriptor assertion. Added full own/non-enumerable/non-writable/
  non-configurable checks for `cancelledPayment` and `causedByAdapterDefect`;
  the code already implemented them. Corrected the wording in the security
  approval to name all three descriptors.
