# Tasks: bootstrap-vivetutiempo-platform (Block 1: Core)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3000-4500 (greenfield: scaffold + 5 domain entities + 9 use cases + 9 ports + 5 Prisma repos + UoW + auth adapters + 9 routes/pages + seed + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Scaffold+Domain -> PR2 Application+Infra -> PR3 UI+Seed -> PR4 Deploy+Docs |
| Delivery strategy | not specified for this run — default `ask-on-risk` |
| Chain strategy | pending (user decision required) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold app + pure domain layer (Phases 1-2) | PR 1 | Base = main (or tracker branch). No runtime deps on other units. |
| 2 | Application use cases/ports + Prisma infra + race-guard test (Phases 3-4) | PR 2 | Depends on Unit 1 (domain). Base = PR 1 branch if feature-branch-chain. |
| 3 | Route handlers/pages + seed dataset + E2E (Phases 5-6) | PR 3 | Depends on Unit 2 (application). Base = PR 2 branch if feature-branch-chain. |
| 4 | Deploy config + README/docs (Phase 7) | PR 4 | Depends on Unit 3. Base = PR 3 branch if feature-branch-chain. |

## Phase 1: Project Scaffolding (Foundation) — non-TDD

- [ ] 1.1 Init Next.js App Router + TS + Tailwind: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`.
- [ ] 1.2 Create layer folders: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/ui/`, `src/app/` (ADR D5: `src/app` thin).
- [ ] 1.3 Add `prisma/schema.prisma`: Account/Profile/Slot/Proposal/Event models + enums (no migration yet).
- [ ] 1.4 Add `docker-compose.yml` for local Postgres.
- [ ] 1.5 Configure Vitest: `vitest.config.ts`, `tests/unit/`, `tests/integration/`.
- [ ] 1.6 Configure Playwright: `playwright.config.ts`, `e2e/`.
- [ ] 1.7 Add `.env.example` (`DATABASE_URL`, `SESSION_SECRET`) + `README.md` skeleton.

## Phase 2: Domain Layer — strict TDD (RED -> GREEN -> REFACTOR)

- [ ] 2.1 [RED] `tests/unit/domain/profile.test.ts`: Profile state machine `pending->active|rejected`.
- [ ] 2.2 [GREEN] `src/domain/profile/Profile.ts` entity + transitions.
- [ ] 2.3 [RED] `tests/unit/domain/slot.test.ts`: Slot state machine `open->filled|closed`.
- [ ] 2.4 [GREEN] `src/domain/slot/Slot.ts`.
- [ ] 2.5 [RED] `tests/unit/domain/proposal.test.ts`: Proposal state machine `submitted->accepted|rejected`.
- [ ] 2.6 [GREEN] `src/domain/proposal/Proposal.ts`.
- [ ] 2.7 [RED] `tests/unit/domain/event.test.ts`: Event lifecycle `created->published->completed`.
- [ ] 2.8 [GREEN] `src/domain/event/Event.ts`.
- [ ] 2.9 [RED] `tests/unit/domain/acceptProposal.test.ts`: accept P1 -> auto-reject P2*, fill Slot, publish Event; deny on non-open Slot (spec scenarios in `slot-proposal-coordination`).
- [ ] 2.10 [GREEN] Pure `src/domain/slot/acceptProposal.ts` (ADR D4 invariant).
- [ ] 2.11 [REFACTOR] `src/domain/errors.ts` shared domain errors; add `src/domain/account/Account.ts`.

## Phase 3: Application Layer — strict TDD

- [ ] 3.1 Define ports in `src/application/ports/`: `AccountRepository`, `ProfileRepository`, `SlotRepository`, `ProposalRepository`, `EventRepository`, `MatchingUnitOfWork`, `SessionPort`, `PasswordHasher`, `Clock`, `IdGenerator`.
- [ ] 3.2 [RED] Test `registerProfile` (creates `pending` Profile) w/ in-memory fakes.
- [ ] 3.3 [GREEN] `src/application/use-cases/registerProfile.ts`.
- [ ] 3.4 [RED] Test `login`/`logout` (session issuance, invalid creds).
- [ ] 3.5 [GREEN] `src/application/use-cases/login.ts`, `logout.ts`.
- [ ] 3.6 [RED] Test `validateProfile` (Admin-only; non-admin denied).
- [ ] 3.7 [GREEN] `src/application/use-cases/validateProfile.ts`.
- [ ] 3.8 [RED] Test `publishSlot`/`listOpenSlots` (active-Hospital gate).
- [ ] 3.9 [GREEN] `src/application/use-cases/publishSlot.ts`, `listOpenSlots.ts`.
- [ ] 3.10 [RED] Test `submitProposal` (active-Artist gate, open-Slot only).
- [ ] 3.11 [GREEN] `src/application/use-cases/submitProposal.ts`.
- [ ] 3.12 [RED] Test `approveProposal`/`rejectProposal` (ownership 403, cascade via `domain.acceptProposal`, non-open-Slot denial).
- [ ] 3.13 [GREEN] `src/application/use-cases/approveProposal.ts`, `rejectProposal.ts`.
- [ ] 3.14 [RED] Test `listPublishedEvents` (public; unpublished items excluded).
- [ ] 3.15 [GREEN] `src/application/use-cases/listPublishedEvents.ts`.

## Phase 4: Infrastructure Layer — pragmatic tests

- [ ] 4.1 Prisma migration: base schema (`prisma/migrations/.../migration.sql`).
- [ ] 4.2 Raw-SQL migration: partial unique `UNIQUE(slot_id) WHERE status='accepted'` on proposals + `(slot_id, artist_profile_id) WHERE status='submitted'` (Prisma can't express this — design flag).
- [ ] 4.3 Prisma repositories in `src/infrastructure/persistence/prisma/` (Account/Profile/Slot/Proposal/Event).
- [ ] 4.4 `MatchingUnitOfWork` with `$transaction` + guarded `UPDATE ... WHERE status='open'` (0 rows -> `ConflictError`).
- [ ] 4.5 [Integration test] `tests/integration/matching-race.test.ts`: two parallel `approveProposal` calls on same Slot -> exactly one `accepted`, one `409 ConflictError` (Docker Postgres).
- [ ] 4.6 DB-backed session adapter (httpOnly/Secure/SameSite=Lax, session table): `src/infrastructure/auth/session.ts`.
- [ ] 4.7 argon2id `PasswordHasher`: `src/infrastructure/auth/passwordHasher.ts`.
- [ ] 4.8 `Clock`/`IdGenerator` adapters.

## Phase 5: UI / Route Handlers

- [ ] 5.1 `POST /api/auth/register` (Hospital/Artist self-registration): `src/app/api/auth/register/route.ts`.
- [ ] 5.2 `POST /api/auth/login`, `POST /api/auth/logout` route handlers.
- [ ] 5.3 Admin profile validation: `POST /api/admin/profiles/[id]/approve|reject` + `src/app/admin/profiles/page.tsx` (empty-state per spec).
- [ ] 5.4 Hospital slot publish: `POST /api/slots` + `src/app/hospital/slots/page.tsx`.
- [ ] 5.5 Artist proposal submit: `POST /api/slots/[id]/proposals` + `src/app/artist/slots/page.tsx`.
- [ ] 5.6 Hospital approve/reject: `POST /api/slots/[id]/proposals/[pid]/approve|reject`.
- [ ] 5.7 Public anonymous events browsing (no auth): `GET /api/events` + `src/app/events/page.tsx`.
- [ ] 5.8 Enforce role + ownership checks per handler (defense-in-depth; delegate to use cases per ADR).
- [ ] 5.9 [E2E] `e2e/demo-chain.spec.ts`: register -> admin approve -> publish -> propose -> accept -> auto-reject rival -> public browse.

## Phase 6: Seed Dataset

- [ ] 6.1 `prisma/seed.ts`: 7 accounts + 4 Slots + 2 Events per design D-seed (exact demo chain).
- [ ] 6.2 [E2E] Public browsing shows only published Events against seeded data.
- [ ] 6.3 Document seed credentials in `README.md`.

## Phase 7: Deployment Prep + Docs

- [ ] 7.1 Vercel config + managed-Postgres env wiring (prod `DATABASE_URL` notes).
- [ ] 7.2 Finalize `README.md`: setup, run, test commands, seed credentials (TFM requirement).
- [ ] 7.3 Add `test`, `test:e2e`, `db:migrate`, `db:seed` scripts to `package.json`.
