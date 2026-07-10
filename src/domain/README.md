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
  aggregate: entity + state machine.
- `errors.ts` (Phase 2) — shared domain errors.
- `slot/acceptProposal.ts` (Phase 2) — the accept-cascade invariant (ADR D4).
