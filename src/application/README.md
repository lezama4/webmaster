# Application Layer

Use cases orchestrate domain logic against ports (interfaces). This layer
knows *what* to do but not *how* it is persisted or delivered.

## Boundary rule

Code in this folder MUST NOT import from:

- `next` (or any Next.js API)
- `@prisma/client` or any concrete persistence/auth adapter — depend on the
  port interfaces in `ports/` instead, implemented in `src/infrastructure`.
- `src/app`, `src/ui`

It MAY import from `src/domain`.

## Layout

- `ports/` (Phase 3, extended in the PR 2a remediation pass) — repository
  and adapter interfaces (`AccountRepository`, `ProfileRepository`,
  `SlotRepository`, `ProposalRepository`, `EventRepository`,
  `PublicEventProjectionQuery`, `OpenSlotListingQuery` (pr2a-N3),
  `MatchingUnitOfWork`, `ProfileUnitOfWork`, `RegistrationUnitOfWork`
  (pr2a-M5), `SessionPort`, `LoginRateLimiter`, `PasswordHasher`, `Clock`,
  `IdGenerator`).
- `dto/` (Phase 3) — `PublicEventProjection` (D6 allow-list shape).
- `use-cases/` (Phase 3, hardened in the PR 2a remediation pass, unified per
  recheck-pr2a-verify-M2) —
  `registerProfile` (incl. credential-verified `rejected -> pending`
  re-registration, pr2a-B2), `login`/`logout`, `validateProfile`,
  `deactivateProfile`, `publishSlot`, `listOpenSlots`, `submitProposal`,
  `approveProposal`, `rejectProposal`, `closeSlot`, `listPublishedEvents`.
  `publishSlot` re-checks the acting Profile's LIVE status AND type via
  `ProfileUnitOfWork.withLockedProfile` FROM WITHIN its own lock (pr2a-M1/
  N1) — it has no existing Slot row to lock. `submitProposal`/
  `approveProposal`/`rejectProposal`/`closeSlot` commit EXCLUSIVELY through
  `MatchingUnitOfWork.withLockedSlot` (lock-first, ADR D4), which now ALSO
  locks the acting Account and reads its live Profile INSIDE the SAME
  transaction that locks the Slot and persists the mutation
  (recheck-pr2a-verify-M2) — no separate `ProfileUnitOfWork` transaction is
  involved, closing the window where that second transaction could commit
  and release the Account lock before the Slot mutation was persisted.
  Documented global lock order: Slot lock first, then the Account lock (no
  operation acquires the reverse order, so no deadlock cycle exists).
  `login`, `validateProfile`, and `deactivateProfile` coordinate
  Profile-status transitions with session issuance/revocation exclusively
  through `ProfileUnitOfWork.withLockedProfile` (ADR D7). `registerProfile`
  commits exclusively through `RegistrationUnitOfWork.withLockedRegistration`
  (pr2a-M5) — the Prisma adapter for this port is a follow-up infra task;
  only the in-memory fake exists so far.
- `use-cases/shared/guards.ts` — small role/ownership/live-status guard
  helpers shared across use cases (N1 error taxonomy; `assertActiveProfile`
  now also accepts an `expectedType` for pr2a-N1 Profile-type defense-in-depth).
