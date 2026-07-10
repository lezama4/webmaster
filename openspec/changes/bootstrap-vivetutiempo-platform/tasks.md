# Tasks: bootstrap-vivetutiempo-platform (Block 1: Core)

## Review Workload Forecast

**Revised after `reviews/codex-planning-review.md` (all findings accepted) — see task additions across Phases 2-7 below.**

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4500-6500 (greenfield: scaffold + 5 domain entities incl. `closeSlot`/invariants + 11 use cases incl. `closeSlot`/`deactivateProfile` + 9 ports + `PublicEventProjection` DTO + 5 Prisma repos + row-locked UoW + auth adapters incl. session hardening/CSRF/rate-limit + 11 routes/pages + 5-Slot seed + expanded unit/integration/E2E tests) |
| 400-line budget risk | Very High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Scaffold+Domain -> PR2 Application+Infra (incl. race guard, session lifecycle/CSRF) -> PR3 UI+Seed (incl. public DTO wiring + no-leak test) -> PR4 Deploy+Docs (incl. deploy execution) |
| Delivery strategy | not specified for this run — default `ask-on-risk` |
| Chain strategy | pending (user decision required) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Very High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold app + pure domain layer incl. `closeSlot` cascade, Profile `deactivated`/`rejected→pending` transitions, Slot invariants (Phases 1-2) | PR 1 | Base = main (or tracker branch). No runtime deps on other units. |
| 2 | Application use cases/ports (`closeSlot`, `deactivateProfile`, re-registration branch, authorization edge-case matrix, `PublicEventProjection` mapper) + Prisma infra + submit/approve/close race guard + session lifecycle hardening + CSRF policy (Phases 3-4) | PR 2 | Depends on Unit 1 (domain). Base = PR 1 branch if feature-branch-chain. Session lifecycle/CSRF (4.12-4.14) ships here as infra, per review. |
| 3 | Route handlers/pages (incl. close-Slot, deactivate-profile, public-DTO wiring) + 5-Slot seed dataset + E2E incl. authorization-edge-case and public no-leak tests (Phases 5-6) | PR 3 | Depends on Unit 2 (application). Base = PR 2 branch if feature-branch-chain. The `PublicEventProjection` mapper is defined in PR 2 (3.26-3.27); its route wiring and no-leak verification (5.7, 6.4) land here, per review's "public DTO → PR3" guidance. |
| 4 | Deploy config + README/docs + production migration/seed/deploy execution + live-URL smoke verification (Phase 7) | PR 4 | Depends on Unit 3. Base = PR 3 branch if feature-branch-chain. Deploy-execute tasks (7.4-7.8) added per review M5 — "prepared" is not "deployed and demonstrably working." |

## Phase 1: Project Scaffolding (Foundation) — non-TDD

- [x] 1.1 Init Next.js App Router + TS + Tailwind: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`. (Tailwind v4 uses `postcss.config.mjs`, no `tailwind.config.ts` file — current Next.js scaffold default.)
- [x] 1.2 Create layer folders: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/ui/`, `src/app/` (ADR D5: `src/app` thin). Path aliases (`@domain/*`, `@application/*`, `@infrastructure/*`, `@ui/*`) added in `tsconfig.json`; ESLint boundary rule added in `eslint.config.mjs`.
- [x] 1.3 Add `prisma/schema.prisma`: Account/Profile/Slot/Proposal/Event models + enums (no migration yet). Prisma pinned to 6.19.3 (see apply-progress deviation note — Prisma 7 changed schema config).
- [x] 1.4 Add `docker-compose.yml` for local Postgres.
- [x] 1.5 Configure Vitest: `vitest.config.ts`, `tests/unit/`, `tests/integration/`.
- [x] 1.6 Configure Playwright: `playwright.config.ts`, `e2e/`.
- [x] 1.7 Add `.env.example` (`DATABASE_URL`, `SESSION_SECRET`) + `README.md` skeleton.

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
- [ ] 2.12 [RED] `tests/unit/domain/profile.test.ts` (extend): Profile transitions `active -> deactivated` (Admin, M3) and `rejected -> pending` (re-registration, same profile, M2).
- [ ] 2.13 [GREEN] Extend `src/domain/profile/Profile.ts` with `deactivate()` and `reactivate()` transitions.
- [ ] 2.14 [RED] `tests/unit/domain/slot.test.ts` (extend): Slot invariants — `scheduledAt` strictly future at creation (via injected `Clock`), `durationMinutes` > 0, `title`/`description`/`location` length bounds (N2).
- [ ] 2.15 [GREEN] Extend `src/domain/slot/Slot.ts` construction/validation with the invariants above; raise a domain validation error on violation.
- [ ] 2.16 [RED] `tests/unit/domain/closeSlot.test.ts`: closing an `open` Slot with `submitted` Proposals transitions the Slot to `closed` and cascades every `submitted` Proposal to `rejected`; deny closing a non-open Slot (B2).
- [ ] 2.17 [GREEN] Pure `src/domain/slot/closeSlot.ts` — mirrors `acceptProposal`'s shape (ADR D4 / Domain Model).

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
- [ ] 3.16 [RED] Test `closeSlot` use case: ownership check (403 non-owner), denies on non-open Slot, calls `domain.closeSlot`, persists cascade via `MatchingUnitOfWork` (B2).
- [ ] 3.17 [GREEN] `src/application/use-cases/closeSlot.ts`.
- [ ] 3.18 [RED] Test `deactivateProfile` use case: Admin-only (403 non-Admin), `active -> deactivated`, triggers `SessionPort.revokeAllForAccount` (M3).
- [ ] 3.19 [GREEN] `src/application/use-cases/deactivateProfile.ts`.
- [ ] 3.20 [RED] Test `registerProfile` reactivation branch: registering while an existing `rejected` Profile exists for the Account transitions that SAME Profile `rejected -> pending` (new review request), not a second Profile row (M2).
- [ ] 3.21 [GREEN] Extend `src/application/use-cases/registerProfile.ts` with the reactivation branch.
- [ ] 3.22 [RED] Test `submitProposal` race guard: a Slot that concurrently left `open` at commit time (simulated via a fake `MatchingUnitOfWork` returning a guard failure) denies the submission with `ConflictError`, never inserts (B1).
- [ ] 3.23 [GREEN] Extend `src/application/use-cases/submitProposal.ts` to commit through the same guarded transaction as `approveProposal`/`closeSlot` (ADR D4).
- [ ] 3.24 [RED] Test the authorization edge-case matrix (M6): Admin attempting `approveProposal`/`rejectProposal` (denied); Artist/Patient attempting Hospital-only or Admin-only use cases (denied); `approveProposal`/`rejectProposal` where the Proposal's `slotId` does not match the targeted Slot (denied); acting on an already-`accepted`/`rejected` Proposal (denied); an actor whose Profile turned `rejected`/`deactivated` after session issuance attempting any mutating use case (denied via live-status re-check, not session snapshot).
- [ ] 3.25 [GREEN] Add/adjust guard clauses across `approveProposal.ts`, `rejectProposal.ts`, `submitProposal.ts`, `publishSlot.ts`, `closeSlot.ts`, `deactivateProfile.ts` enforcing role + ownership + Proposal/Slot linkage + live Profile status on every call.
- [ ] 3.26 [RED] Test `listPublishedEvents` returns only the `PublicEventProjection` allow-list (title, description, scheduledAt, durationMinutes, artist public display name) — no location, Proposal message, email, or internal id (M4).
- [ ] 3.27 [GREEN] `src/application/dto/PublicEventProjection.ts` (allow-list mapper), wired into `listPublishedEvents.ts` (ADR D6).

## Phase 4: Infrastructure Layer — pragmatic tests

- [ ] 4.1 Prisma migration: base schema (`prisma/migrations/.../migration.sql`).
- [ ] 4.2 Raw-SQL migration: partial unique `UNIQUE(slot_id) WHERE status='accepted'` on proposals + `(slot_id, artist_profile_id) WHERE status='submitted'` (Prisma can't express this — design flag).
- [ ] 4.3 Prisma repositories in `src/infrastructure/persistence/prisma/` (Account/Profile/Slot/Proposal/Event).
- [ ] 4.4 `MatchingUnitOfWork` with `$transaction` + guarded `UPDATE ... WHERE status='open'` (0 rows -> `ConflictError`).
- [ ] 4.5 [Integration test] `tests/integration/matching-race.test.ts`: two parallel `approveProposal` calls on same Slot -> exactly one `accepted`, one `409 ConflictError` (Docker Postgres).
- [ ] 4.6 DB-backed session adapter (httpOnly/Secure/SameSite=Lax, session table): `src/infrastructure/auth/session.ts`.
- [ ] 4.7 argon2id `PasswordHasher`: `src/infrastructure/auth/passwordHasher.ts`.
- [ ] 4.8 `Clock`/`IdGenerator` adapters.
- [ ] 4.9 Extend `MatchingUnitOfWork` to serialize `submitProposal`, `approveProposal`, and `closeSlot` on the same Slot row (`SELECT ... FOR UPDATE` in the transaction, or the atomic `INSERT ... SELECT ... WHERE slot.status='open'` guard) — B1, ADR D4.
- [ ] 4.10 [Integration test] `tests/integration/submit-approve-race.test.ts`: interleave `submitProposal` and `approveProposal` on the same Slot (not two approvals) — assert the late `submitProposal` is rejected once the Slot is `filled` (Docker Postgres) (B1).
- [ ] 4.11 [Integration test] `tests/integration/close-slot-cascade.test.ts`: closing a Slot with `submitted` Proposals persists the cascade atomically — Slot `closed`, every `submitted` Proposal `rejected` (Docker Postgres) (B2).
- [ ] 4.12 Session lifecycle hardening in `src/infrastructure/auth/session.ts`: absolute expiry + idle-timeout expiry, session-id rotation on login, revoke-on-logout (row delete), `revokeAllForAccount` (used by `deactivateProfile`/reject flows) (M3, ADR D7).
- [ ] 4.13 Login attempt rate-limiting: `src/infrastructure/auth/loginRateLimiter.ts` — cap failed attempts per account + per IP within a rolling window, generic error on lockout (M3, ADR D7).
- [ ] 4.14 CSRF policy: `Origin`/`Host` header check for authenticated mutation route handlers, beyond `SameSite=Lax` — `src/infrastructure/auth/csrf.ts` (shared route-handler guard) (M3, ADR D7).

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
- [ ] 5.10 Hospital close/withdraw Slot: `POST /api/slots/[id]/close` (owner-Hospital-only) + UI action in `src/app/hospital/slots/page.tsx` (B2).
- [ ] 5.11 Admin deactivate profile: `POST /api/admin/profiles/[id]/deactivate` + UI action in `src/app/admin/profiles/page.tsx` (M3).
- [ ] 5.12 Admin validation queue surfaces re-registered (`rejected -> pending`) profiles in the same pending queue as first-time submissions — no separate UI path (M2).
- [ ] 5.13 Wire the CSRF Origin/Host check (4.14) into every authenticated mutation route handler (`src/app/api/**/route.ts`) (M3).
- [ ] 5.14 [E2E] `e2e/close-slot.spec.ts`: Hospital closes a Slot with outstanding Proposals -> Proposals show `rejected`, Slot no longer accepts new Proposals (B2).
- [ ] 5.15 [E2E] `e2e/authorization-edge-cases.spec.ts`: exercises the M6 denial matrix (Admin approving a Proposal, Artist/Patient on Hospital/Admin routes, mismatched proposal/slot id, already-terminal Proposal, deactivated-mid-session actor) via direct API calls — asserts denial happens in the application layer, not only via hidden UI (M6).

## Phase 6: Seed Dataset

- [ ] 6.1 `prisma/seed.ts`: 7 accounts + **5 Slots** + 2 Events per design D-seed fix (M1) — S1 `open`/2 competing Proposals, S2 `filled`/accepted Proposal/published Event, S3 `open`/no Proposals, S4 `closed` via `closeSlot`/cascade-rejected Proposal, S5 `filled`/accepted Proposal/`completed` Event (Block 2 seam, valid unique origin distinct from S2's).
- [ ] 6.2 [E2E] Public browsing shows only published Events against seeded data.
- [ ] 6.3 Document seed credentials in `README.md`.
- [ ] 6.4 [E2E/API test] Public Events response never includes `location`, Proposal `message`, any email, or any internal id, verified against the seeded dataset (ADR D6, no-leak test) (M4).

## Phase 7: Deployment Prep + Docs

- [ ] 7.1 Vercel config + managed-Postgres env wiring (prod `DATABASE_URL` notes).
- [ ] 7.2 Finalize `README.md`: setup, run, test commands, seed credentials (TFM requirement).
- [ ] 7.3 Add `test`, `test:e2e`, `db:migrate`, `db:seed` scripts to `package.json`.
- [ ] 7.4 Run the production database migration safely: `prisma migrate deploy` against the managed Postgres instance, with a documented rollback path (previous migration / point-in-time restore per proposal §9) (M5).
- [ ] 7.5 Provision/seed demo data in the deployed environment: run the seed script against the deployed database (documented as a one-time, idempotent operation) so the deployed URL reproduces the full demo chain (M5).
- [ ] 7.6 Execute the deploy: trigger the Vercel production deployment and record the resulting live URL in `README.md` (M5).
- [ ] 7.7 Verify the live URL: manually exercise the full demo chain (login as all four seeded roles; publish -> propose -> approve -> Event published -> public browse; close a Slot) against the deployed instance (M5).
- [ ] 7.8 [E2E] Run the Playwright smoke suite against the deployed URL (`PLAYWRIGHT_BASE_URL` pointed at production) and record pass evidence in README/PR (M5).
