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
- [x] 5.2 Add `rehydrateSupportPayment`, build every payment field by field,
  and freeze it so terminal states and `simulated` hold at runtime.
- [x] 5.3 Validate and capture the fake adapter outcome at construction, and
  derive the synthetic receipt reference from the payment id.
- [x] 5.4 Mark the gateway request `simulated: true` and cancel the pending
  payment when the gateway call or its receipt check fails.
- [x] 5.5 Regenerate the security approval evidence from an actual run.
