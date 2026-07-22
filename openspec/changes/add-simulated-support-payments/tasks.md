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
- [x] 6.4 Restrict `rehydrateSupportPayment` to terminal statuses, so it cannot
  reopen a settled payment as `pending`.
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
