# Design — simulated support payments

## Architecture

The feature is a small bounded context with one pure aggregate and one outbound
port:

```text
simulateSupportPayment use case
  -> SupportPayment factory (domain)
  -> PaymentGateway.simulate (application port)
  -> FakePaymentGateway (infrastructure adapter, no network)
  -> domain settlement transition + simulated receipt
```

`SupportPayment` is not a ledger entry, payment instrument, payout, or
donation certificate. It is an explicit simulation record returned to the
caller. The feature has no repository and no migration because persistence
would falsely imply financial durability before a real financial design exists.

Because there is no persistence, one invariant a reader might expect is
deliberately absent: **terminal-outcome immutability across a store-and-reload
cycle**. `rehydrateSupportPayment` rejects `pending`, so a stored terminal
record cannot be reconstructed as an unsettled one; it does not constrain which
terminal status is presented, and cannot, because a pure function has no prior
state to compare against. This is assigned to the future persistence layer: the
repository that stores these records must enforce a status that leaves
`pending` exactly once and is never rewritten afterwards, via a conditional
update guarded on the current status or an append-only event log.

## Domain model

```text
pending -> succeeded | declined | cancelled
```

Fields:

- `id`, `campaignReference`, `amountCents`, `currency` (`EUR` only for this
  simulation), `payerKind`, `method`, and `status`.
- `payerKind`: `individual`, `private_patron`, `institution`,
  `corporate_sponsor`.
- `method`: `card`, `bizum`, `bank_transfer`; every one is represented as a
  simulation label, never as an integration.

The creation factory forces `pending`. Settlement is pure and terminal. Money
uses bounded integer cents. The aggregate deliberately has no personally
identifying or financial-instrument field.

## Port contract

`PaymentGateway.simulate` receives the safe pending-payment fields and returns
only one trusted simulated outcome plus a synthetic reference. The port does
not expose a generic `charge`, `transfer`, `refund`, or webhook API.

The fake adapter is constructed with a predetermined outcome. It MUST ignore
any attempt to influence that outcome through use-case input, and it MUST NOT
import `fetch`, Node networking APIs, or a provider SDK.

## Security decisions

- The receipt contains `simulated: true` and a `sim_` reference prefix.
- A misbehaving adapter raises `AdapterContractError` from the application
  error taxonomy, never a `DomainError`: a gateway response is not domain
  input, and an adapter defect is not a rejected caller operation.
- `AdapterContractError` never reaches `toErrorResponse` from
  `simulateSupportPayment`. It has four construction sites: two in
  `validateGatewayResult`, plus `FakePaymentGateway`'s constructor and its
  `syntheticReference`. Every site is either inside the use case's guarded
  region or inside the adapter call that region awaits — `syntheticReference`
  runs on the request path, from `FakePaymentGateway.simulate` — except the
  constructor, which runs at wiring time before any call reaches the use case.
  The guarded region's `catch` unconditionally rethrows a
  `FailedSimulationError`, so from this use case the error surfaces only as
  `FailedSimulationError.cause` and its "falls through to 500" mapping is
  unreachable.
- `FailedSimulationError` is raised for FAILURES ONLY. A gateway `declined`
  outcome passes validation, settles the payment, and the use case RESOLVES
  normally — it never reaches this error, so the class has no business-outcome
  member. Because the wrapping erases the thrown type, a future handler MUST
  branch on `FailedSimulationError.causedByAdapterDefect` before choosing a
  status: the class mixes an adapter-contract DEFECT (a bug on our side of the
  boundary) with a gateway or infrastructure REJECTION (an external failure).
  Mapping it wholesale to a business status would be wrong for every member.
- `causedByAdapterDefect` is a PARTIAL classifier: `true` means this codebase
  labelled the cause, `false` means only that it did not. Genuine defects can
  read `false` — an adapter throwing its own error type, for instance. Recorded
  as a known non-guarantee rather than presented as a total classification.
- The `receiptReference` SHAPE — `sim_` prefix, `[A-Za-z0-9_-]` charset,
  132-character maximum — is enforced by the use case and therefore stated as
  an explicit obligation in the port contract; an adapter cannot be expected to
  discover a runtime rejection. Per-payment UNIQUENESS remains an unverified
  adapter obligation, because checking it would couple the application layer to
  an adapter's naming scheme. Non-reuse across calls additionally depends on
  `IdGenerator.next()` never repeating, which is a precondition on that port.
- No validator echoes the value it rejected. Echoing it would copy a financial
  identifier into logs — the very channel the enumeration exists to remove —
  and interpolating an untrusted value can itself throw. Reporting the field
  name and the allowed set is narrower: that applies to the enumerated
  denials (`campaignReference`, `payerKind`, `method`, settlement outcome,
  rehydrated status), not to the denied-transition guard, which reports
  neither.
- Client input never includes an outcome, gateway token, payment URL, or
  provider identifier.
- No amount is represented by `number` with a fractional semantic; the domain
  accepts only safe integer cents and a bounded maximum.
- No public endpoint is introduced by this change. Any future endpoint must
  apply authentication/rate limiting/CSRF as appropriate and retain the
  simulation-only wording.
- A later real provider requires a separate SDD change, legal/financial review,
  provider-hosted checkout, signed idempotent webhooks, reconciliation, refund
  policy, and a new threat model. It MUST NOT reuse this fake as production
  payment code.

## Testing

Use test-first development:

1. Domain tests for all validation and terminal transitions.
2. Application tests for method/payer forwarding and gateway-owned outcome.
3. Infrastructure fake tests proving synthetic reference and explicit simulation
   marker.
4. Run unit tests, typecheck, and lint. Integration/E2E are intentionally not
   required because the fake owns no persistence or network boundary.
