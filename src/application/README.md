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
  (`AccountRepository`, `SlotRepository`, `MatchingUnitOfWork`,
  `SessionPort`, `PasswordHasher`, `Clock`, `IdGenerator`, etc.).
- `use-cases/` (Phase 3) — `registerProfile`, `login`, `logout`,
  `validateProfile`, `publishSlot`, `listOpenSlots`, `submitProposal`,
  `approveProposal`, `rejectProposal`, `listPublishedEvents`.
