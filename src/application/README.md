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

- `ports/` (Phase 3) — repository and adapter interfaces
  (`AccountRepository`, `ProfileRepository`, `SlotRepository`,
  `ProposalRepository`, `EventRepository`, `PublicEventProjectionQuery`,
  `MatchingUnitOfWork`, `ProfileUnitOfWork`, `SessionPort`,
  `LoginRateLimiter`, `PasswordHasher`, `Clock`, `IdGenerator`).
- `dto/` (Phase 3) — `PublicEventProjection` (D6 allow-list shape).
- `use-cases/` (Phase 3, done) — `registerProfile` (incl. `rejected ->
  pending` re-registration), `login`/`logout`, `validateProfile`,
  `deactivateProfile`, `publishSlot`, `listOpenSlots`, `submitProposal`,
  `approveProposal`, `rejectProposal`, `closeSlot`, `listPublishedEvents`.
  All Slot-resolving use cases (`submitProposal`/`approveProposal`/
  `rejectProposal`/`closeSlot`) commit exclusively through
  `MatchingUnitOfWork.withLockedSlot` (lock-first, ADR D4). `login`,
  `validateProfile`, and `deactivateProfile` coordinate Profile-status
  transitions with session issuance/revocation exclusively through
  `ProfileUnitOfWork.withLockedProfile` (ADR D7).
- `use-cases/shared/guards.ts` — small role/ownership/live-status guard
  helpers shared across use cases (N1 error taxonomy).
