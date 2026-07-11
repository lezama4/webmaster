# Domain Layer

Framework-free business rules: entities, state machines, and pure domain
operations (e.g. `acceptProposal`).

## Boundary rule

Code in this folder MUST NOT import from:

- `next` (or any Next.js API, including route handlers/pages)
- `@prisma/client` or any persistence library
- `src/application`, `src/infrastructure`, `src/ui`, or `src/app`
- Node-only APIs tied to HTTP/DB (e.g. `fetch`, `process.env` for secrets)

It may only depend on plain TypeScript and, if strictly necessary, small
framework-free utility packages. This boundary is enforced by the ESLint
rule in `eslint.config.mjs` (see `no-restricted-imports` for `src/domain/**`).

## Layout

- `account/`, `profile/`, `slot/`, `proposal/`, `event/` — one folder per
  aggregate: entity + state machine (pure, immutable transitions).
- `errors.ts` — shared domain errors (`InvalidTransitionError`,
  `DomainValidationError`, `NotSlotOwnerError`).
- `shared/Clock.ts` — minimal injected time source (keeps time rules testable).
- `slot/acceptProposal.ts` — the accept-cascade invariant (ADR D4): accept one
  Proposal -> fill Slot, auto-reject rivals, create + publish Event. Enforces
  Slot ownership (M2) and aggregate consistency (M4) before transitioning.
- `slot/closeSlot.ts` — the close/withdraw cascade (B2): close Slot,
  cascade-reject outstanding `submitted` Proposals. Enforces Slot ownership
  (M2) and aggregate consistency (M4) before transitioning.
- `slot/linkage.ts` — shared guard: cascade Proposals must belong to the Slot.
- `slot/aggregate.ts` — validates a Slot + its complete Proposal set is an
  internally consistent snapshot (M4/Q3): unique Proposal ids, and an `open`
  Slot never coexists with an already-`accepted` Proposal. Used by both
  cascade operations and by `rehydrateSlotAggregate` on load.

## Construction (M1)

Every entity (`Account`, `Profile`, `Proposal`, `Slot`, `Event`) is a
nominally-branded type (an unexported `unique symbol` field, erased at
compile time) — a structural object literal can never satisfy it. The ONLY
ways to obtain one are:

- `createX(input)` — forces the entity's valid initial state (`Profile` ->
  `pending`, `Proposal` -> `submitted`, `Slot` -> `open`, `Event` ->
  `created`; `Account` has no lifecycle, but still only constructs via its
  factory).
- `rehydrateX(input)` — for reconstructing already-persisted entities from
  any valid status; validates every field (including the status) so
  corrupt/invalid persisted data fails fast rather than silently rehydrating.

State-machine transitions (`approveProfile`, `acceptProposal`, `fillSlot`,
etc.) keep working on already-branded values via object spread, which
preserves the brand at the type level with zero runtime cost — entities
remain plain, JSON-serializable objects.
