# PR 1 follow-up adversarial security review

This review was repeated after the latest domain-layer changes. The previous
factory/brand, operation-level ownership, invalid-date, and Slot-Date aliasing
findings are substantially addressed in the current TypeScript domain code.

## Verification performed

- `npm run test`: **passed** — 8 test files, 133 tests.
- `npx tsc --noEmit --incremental false`: **passed**.
- `npm run lint`: **passed**.

The present `src/domain` import graph is framework-free. The passing checks do
not resolve the persistence and boundary gaps below.

## BLOCKER

### B1 — Prisma still cannot persist required Profile lifecycle and audit data

**References:** `src/domain/profile/Profile.ts:6, 38-46, 164-176`;
`prisma/schema.prisma:29-33, 66-83`; `design.md` §Domain Model and §Profile
transitions (lines 53, 60-62); `specs/profile-onboarding/spec.md` §Rejected
Profile May Re-Register Into the Same Profile and §Admin Deactivates an Active
Profile (lines 79-107).

The domain correctly models `deactivated` and creates `reviewRequestedAt` for
re-registration, but the Prisma `ProfileStatus` enum has no `DEACTIVATED` and
the Profile model has neither `reviewRequestedAt` nor an append-only review
history. The code explicitly acknowledges the mismatch as a deferred TODO.

This makes the next persistence implementation unable to save a deactivation
or the audit evidence required for a new review request. Add the enum value and
a durable timestamp/history representation before writing the Prisma adapter
and migration; otherwise the authorization-revocation lifecycle is only an
in-memory claim.

## MAJOR

### M1 — Aggregate validation is not a complete state-consistency validator

**References:** `src/domain/slot/aggregate.ts:6-43, 45-55`;
`src/domain/slot/closeSlot.ts:38-51`; `src/domain/slot/acceptProposal.ts:60-88`;
`specs/slot-proposal-coordination/spec.md` §Accepting a Proposal Auto-Rejects
Competitors (lines 117-128) and §The Owning Hospital Closes/Withdraws a Slot
(lines 146-174).

`assertValidSlotAggregate` only rejects an `open` Slot with an accepted
Proposal. It accepts all of these persisted snapshots despite describing itself
as an internal-consistency check:

- a `closed` Slot with one or more `submitted` Proposals;
- a `filled` Slot with no accepted Proposal, more than one accepted Proposal,
  or a remaining submitted Proposal;
- a `closed` Slot with an accepted Proposal.

The first case directly violates the specification's “no Proposal is left in
submitted state against a non-open Slot” invariant. The second permits a broken
acceptance cascade to be silently rehydrated. `rehydrateSlotAggregate` therefore
does not deliver its documented fail-fast guarantee.

Implement a complete Slot/Proposal status matrix: `open` has no accepted
Proposal; `filled` has exactly one accepted and no submitted Proposal; `closed`
has neither accepted nor submitted Proposal. If Event consistency is part of
the aggregate, include it in rehydration too so a filled Slot cannot exist
without its published Event. Add one negative test for each matrix violation.

### M2 — User-controlled Profile and Proposal text is unbounded

**References:** `src/domain/profile/Profile.ts:64-68, 97-109, 120-137`;
`src/domain/proposal/Proposal.ts:43-74, 84-95`; `prisma/schema.prisma:71,
110`; `design.md` §D6 (lines 34-37); `specs/public-event-browsing/spec.md`
§The Public Projection Is an Explicit Allow-List (lines 31-58).

`Profile.name` is only required to be non-empty and is later a public field.
`Proposal.message` is not validated at all: blank and arbitrarily large values
are accepted by both construction and rehydration. PostgreSQL `String` maps to
unbounded text, so a malicious registration/proposal request can grow database,
logs, and response/rendering work without a domain backstop.

Set explicit, tested character limits and whitespace normalization for Profile
names and Proposal messages in the domain, then enforce matching request-body
limits at the future HTTP boundary. React escaping is still required at output;
size limits are a DoS control, not an XSS substitute.

### M3 — The claimed hexagonal boundary remains only partially enforced

**References:** `eslint.config.mjs:16-38`; `src/domain/README.md:8-17`;
`README.md:40-43`.

Current domain imports are clean, but the ESLint rule only blocks `next`,
`@prisma/client`, and selected aliases. It permits relative imports into outer
layers (`../application/...`, `../../infrastructure/...`), Node/IO modules
(`node:fs`), other persistence/HTTP libraries, and banned globals such as
`process` and `fetch`. A future security-relevant boundary violation can pass
the existing lint command.

Use a dependency-boundary rule that resolves relative paths, restrict Node/HTTP
and persistence packages, and prohibit the relevant globals in `src/domain`.
Add a negative lint fixture or CI assertion that proves the boundary fails.

### M4 — Environment secrets can still be committed, and local Postgres is network-published

**References:** `.gitignore:30-33`; `.env.example:1-8`;
`docker-compose.yml:1-13`.

`.gitignore` does not exclude `.env.production`, `.env.development`, or
`.env.test`, although Next.js can load those files and they may carry session
secrets or database URLs. Separately, Docker publishes the development
PostgreSQL service on all host interfaces with a committed, predictable
password. This is a real exposure on shared networks, even though it is not a
production deployment configuration.

Ignore `.env*` while explicitly retaining `.env.example`, and bind local
Postgres to `127.0.0.1:5432` unless LAN access is deliberately needed. Treat
the Compose credential as development-only and never reuse it outside a local
machine.

## MINOR

### N1 — `reviewRequestedAt` can be invalid or mutable after reactivation

**References:** `src/domain/profile/Profile.ts:82-91, 128-137, 170-176`;
`tests/unit/domain/profile.test.ts:108-120, 280-288`.

Rehydration validates and clones `reviewRequestedAt`, but `reactivateProfile`
stores `clock.now()` directly without validating or cloning it. The returned
Profile exposes the mutable Date, so callers can alter the evidence for a
review request after the transition. Validate the Clock result, capture its
epoch value, and expose a defensive copy (the same pattern already used by
`Slot.scheduledAt`).

### N2 — Slot creation trusts an unvalidated Clock result

**References:** `src/domain/slot/Slot.ts:123-143`; `tests/unit/domain/slot.test.ts:208-235`.

The input Slot date is validated, but `clock.now()` is not. If an adapter
returns `new Date(NaN)`, the comparison evaluates false and an otherwise valid
Slot passes the strictly-future rule. This is a low-probability adapter fault,
not an external attack by itself, but the domain's stated invariant should not
depend on an unchecked clock. Validate the current timestamp and test it.

### N3 — Test coverage misses the remaining integrity and abuse cases

**References:** `tests/unit/domain/acceptProposal.test.ts:256-287`;
`tests/unit/domain/closeSlot.test.ts:187-214`;
`tests/unit/domain/profile.test.ts`; `tests/unit/domain/proposal.test.ts`.

The new tests meaningfully cover ownership, duplicate ids, an accepted rival on
an open Slot, factory initial states, and Slot Date safety. They do not cover
the invalid status combinations in M1, unbounded/empty Proposal messages,
oversized public Profile names, invalid Clock output, or mutation of a
reactivated review timestamp. Add these before presenting the domain suite as
security evidence.

### N4 — Playwright still cannot run the planned deployment smoke test

**References:** `playwright.config.ts:4-16`; `tasks.md` 7.8 (lines 137-141).

The base URL remains fixed to localhost and `webServer` always launches the dev
server. The production smoke task names `PLAYWRIGHT_BASE_URL`, but this config
does not consume it. Support an environment override and skip `webServer` for a
remote target so the planned security and regression evidence can run against
the deployed MVP.

## OPEN QUESTIONS

1. Should a filled Slot's published Event be included in the domain aggregate
   rehydration contract, so the accept-and-publish invariant is validated as a
   whole rather than across separate repositories?
2. What are the approved maximum sizes and character rules for public Profile
   names and private Proposal messages? They should be set before the HTTP DTOs
   and Prisma migration make these fields externally writable.
3. Does the project require an append-only profile-review table rather than a
   single timestamp, given the stated traceability requirement for a hospital
   governance workflow?
