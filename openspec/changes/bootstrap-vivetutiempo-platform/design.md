# Design — bootstrap-vivetutiempo-platform (Block 1: Core)

**Stack (fixed):** Next.js (App Router + Route Handlers) + TypeScript + Tailwind + PostgreSQL/Prisma + Vitest/Playwright. Clean/Hexagonal in one repo. Docker only for local Postgres. Deploy: Vercel + managed Postgres.

## Technical Approach

A hexagonal monolith: pure `domain/` (entities + state machines), `application/` (use cases + ports), `infrastructure/` (Prisma/auth adapters), and Next.js as the delivery mechanism. The key invariant (accept one Proposal → publish Event, fill Slot, auto-reject rivals) is a pure domain decision persisted atomically by one transactional adapter. Blocks 2/3 stay cheap: role-generic accounts, `completed` Event state, and the ports-first pattern leave additive seams — nothing for them is built now.

## Architecture Decisions (ADRs)

### D1 — Auth: cookie sessions (DB-backed), not JWT
**Choice:** httpOnly + Secure + SameSite=Lax session cookie; session rows in Postgres; passwords hashed (argon2id). Exposed to `application/` via `SessionPort` + `PasswordHasher` ports; domain never sees auth.
**Rejected:** JWT — stateless tokens can't be revoked when an Admin rejects/deactivates a profile (a governance requirement here), and add expiry/refresh complexity with zero benefit in a same-origin monolith with one DB.
**Rationale:** Sessions are simpler, revocable, OWASP-friendlier (no token storage in JS), and trivially explainable in a TFM defense.

### D2 — Patient/Family in Block 1: seeded login, zero gated capability
**Choice:** `Account.role` enum includes `PATIENT`; one seeded Patient account proves role-based auth works, but Patient capability equals anonymous (browse published Events). No Patient Profile row — `Profile` (with `pending/active/rejected`) exists only for Hospital/Artist.
**Seam for Block 2:** Rating will reference `Account.id` + `Event.id` (unique pair) on `completed` Events. Account is already lightweight (email + password); nothing to migrate.
**Rejected:** No Patient account at all — fails the proposal's "log in with all four roles" success criterion.

### D3 — Slot shape (minimal, demo-credible)
`title`, `description`, `scheduledAt` (datetime), `durationMinutes`, `location` (free text: ward/room), `status`. **No capacity** — no Block 1 rule consumes it; additive later if needed.

### D4 — Concurrency: pure domain decision + transactional guarded write
**Choice:** `approveProposal` use case loads Slot + its Proposals, calls pure domain op `acceptProposal(slot, proposals, proposalId, clock)` → returns new Slot/Proposal states + Event to create. A single `MatchingUnitOfWork` port persists the outcome in one DB transaction with a guarded update (`UPDATE slots SET status='filled' WHERE id=? AND status='open'`; 0 rows → abort/conflict error). Belt-and-braces: partial unique index `UNIQUE(slot_id) WHERE status='accepted'` on proposals (raw SQL in migration — Prisma schema can't express partial uniques).
**Rejected:** optimistic version column (more machinery, same guarantee); serializable isolation (retry complexity).

### D5 — App Router placement
Next.js requires `src/app`; it is the UI-layer *entry* (thin pages + route handlers), while `src/ui` holds presentational components. Documented adaptation of the four-layer rule to a Next constraint.

## Domain Model

| Aggregate | Fields (key) | State machine |
|---|---|---|
| Account | email (unique), passwordHash, role: ADMIN\|HOSPITAL\|ARTIST\|PATIENT | — |
| Profile | accountId (unique), type: HOSPITAL\|ARTIST, name, status | pending → active \| rejected |
| Slot | hospitalProfileId, D3 fields, status | open → filled \| closed |
| Proposal | slotId, artistProfileId, message, status | submitted → accepted \| rejected |
| Event | slotId (unique), proposalId (unique), title, status | created → published → completed |

Domain rules enforced in `domain/` (framework-free): only `active` profiles act; only owner Hospital decides; accept requires Slot `open`; accept cascade is one operation; Event auto-publishes on accept. Resubmit-after-reject allowed: partial unique `(slot_id, artist_profile_id) WHERE status='submitted'`.

## Application Layer

Use cases: `registerProfile`, `login`/`logout`, `validateProfile` (Admin), `publishSlot`, `listOpenSlots`, `submitProposal`, `approveProposal`, `rejectProposal`, `listPublishedEvents` (public), plus owner listings. Each receives an `Actor` context and enforces **role + ownership** (defense in depth vs UI/route checks).

Ports: `AccountRepository`, `ProfileRepository`, `SlotRepository`, `ProposalRepository`, `EventRepository`, `MatchingUnitOfWork`, `SessionPort`, `PasswordHasher`, `Clock`, `IdGenerator`. (Block 3 later adds `PaymentGateway` here — port slot only, not now.)

## Approve-Proposal Sequence

```
Hospital UI → route handler: POST /api/slots/{id}/proposals/{pid}/approve
  handler: session → Actor (401/403 if none/inactive)
  → approveProposal use case
      loads Slot+Proposals; checks actor owns Slot (403)
      domain.acceptProposal(...) → {filled Slot, accepted P, rejected P*, published Event} | DomainError
      → MatchingUnitOfWork.commit(outcome)   [ONE tx: guarded slot update,
        proposal updates, event insert; 0-row guard or unique-index hit → ConflictError 409]
  ← 200 event | 409 on race
```

## File Changes (greenfield — key creations)

| Path | Purpose |
|---|---|
| `src/domain/{account,profile,slot,proposal,event}/` | Entities, state machines, `acceptProposal`, domain errors |
| `src/application/{use-cases,ports}/` | Use cases + port interfaces |
| `src/infrastructure/persistence/prisma/` | Prisma repos + `MatchingUnitOfWork` (`$transaction`) |
| `src/infrastructure/auth/` | Session adapter, argon2 hasher |
| `src/app/` | Pages + route handlers (thin; Zod validation at boundary) |
| `src/ui/` | Presentational components (Tailwind) |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | Schema + partial-unique raw SQL + seed |
| `tests/` (unit/integration), `e2e/` (Playwright), `vitest.config.ts`, `playwright.config.ts` | Test scaffolding (enables strict TDD) |
| `docker-compose.yml` | Local Postgres only |

## Seed Dataset (D-seed)

All passwords `VivetuTiempo2026!` (seed-only, documented in README).

| Role | Accounts |
|---|---|
| Admin | `admin@vtt.test` |
| Hospital | `hospital.sanjuan@vtt.test` (active), `hospital.esperanza@vtt.test` (pending — demos Admin validation) |
| Artist | `artist.clara@vtt.test`, `artist.mateo@vtt.test` (active); `artist.lucia@vtt.test` (pending) |
| Patient | `patient.ana@vtt.test` |

Data: 4 Slots for San Juan — S1 open with 2 competing submitted Proposals (Clara, Mateo — demos choose + auto-reject), S2 filled (accepted Proposal → published Event), S3 open with no Proposals (empty state), S4 closed. Events: 1 published (from S2), 1 completed (Block 2 seam demo). Reproduces the full demo chain from a fresh DB via `prisma db seed`.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit (Vitest) | Domain state machines, accept cascade, invariants | Pure functions, zero mocks |
| Unit (Vitest) | Use cases: role/ownership/status errors | In-memory fake adapters implementing ports |
| Integration (Vitest) | Prisma repos, tx guard — incl. two parallel approvals race | Docker Postgres |
| E2E (Playwright) | Full demo chain + public browsing, per seeded creds | Against seeded app |

Strict TDD target: `domain/` + `application/` (re-run sdd-init after scaffolding).

## Migration / Rollout

Greenfield — no migration. Rollback per proposal §9 (git revert, Vercel redeploy, seed-only data).

## Open Questions

None blocking. Noted risk: Prisma partial unique indexes require raw SQL migrations — flag in tasks.
