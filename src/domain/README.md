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
  Proposal -> fill Slot, auto-reject rivals, create + publish Event.
- `slot/closeSlot.ts` — the close/withdraw cascade (B2): close Slot,
  cascade-reject outstanding `submitted` Proposals.
- `slot/linkage.ts` — shared guard: cascade Proposals must belong to the Slot.
