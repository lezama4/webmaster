# Vivetutiempo

Vivetutiempo is a free, non-profit multi-role coordination platform that
connects hospitals with available agenda slots, artists/dynamizers who can
fill them with cultural and human activities, and the patients/families who
benefit — with matching, approval, governance, and traceability.

This repository is the deliverable of a Master's final project (TFM) in
AI-assisted software development, built with Spec-Driven Development,
Clean/Hexagonal Architecture, layered testing, and security by design.

> Status: Block 1 (Core) is in progress. See
> `openspec/changes/bootstrap-vivetutiempo-platform/` for the spec, design,
> and task breakdown driving this build.

## Stack

- **Frontend/Backend:** Next.js (App Router + Route Handlers), TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL, via Prisma ORM
- **Auth:** DB-backed cookie sessions (httpOnly/Secure/SameSite=Lax) +
  argon2id password hashing — see ADR D1 in `design.md`
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Local infra:** Docker Compose (PostgreSQL only)
- **Deployment target:** Vercel + managed PostgreSQL

## Architecture

Hexagonal / Clean Architecture in a single repo:

```
src/
  domain/          Framework-free entities, state machines, pure domain logic
  application/     Use cases + port interfaces (no framework/persistence deps)
  infrastructure/  Prisma repositories, auth adapters (implements the ports)
  ui/              Presentational React components (Tailwind)
  app/             Next.js App Router: pages + route handlers (thin entry layer)
```

`domain/` and `application/` must stay framework-free; this is enforced via
an ESLint boundary rule in `eslint.config.mjs`. See ADR D5 in
`openspec/changes/bootstrap-vivetutiempo-platform/design.md` for why
Next.js's required `src/app` folder sits alongside this structure.

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

### Install

```bash
npm install
cp .env.example .env
```

### Run local PostgreSQL

```bash
docker compose up -d
```

Postgres has a healthcheck (`pg_isready`), so `docker compose` reports the
container as reproducibly ready — no more racing a not-yet-accepting-
connections database on a fresh start. To wait for it explicitly (e.g. in a
setup script) before running migrations/seeds:

```bash
docker compose up -d --wait
# or, to poll manually:
docker compose exec postgres pg_isready -U vivetutiempo -d vivetutiempo
```

### Generate the Prisma client / run migrations

```bash
npm run prisma:generate
# Migrations land in Phase 4 of this change:
# npx prisma migrate dev
```

### Run the app

```bash
npm run dev
```

Visit http://localhost:3000.

### Run tests

```bash
npm run test        # Vitest — unit + integration
npm run test:e2e     # Playwright — end-to-end
```

## Project structure

```
prisma/            Prisma schema, migrations, seed script
src/                Application source (see Architecture above)
tests/unit/         Vitest unit tests (domain, application)
tests/integration/  Vitest integration tests (Prisma-backed)
e2e/                Playwright end-to-end tests
openspec/           Spec-Driven Development artifacts for this change
docker-compose.yml  Local PostgreSQL only
```

## Functionalities (Block 1: Core)

> Filled in as each phase of `bootstrap-vivetutiempo-platform` lands.

- [ ] Hospital/Artist self-registration and Admin profile validation
- [ ] Hospital agenda Slot publishing
- [ ] Artist Proposal submission
- [ ] Hospital Proposal approval/rejection (with auto-reject of rival
      Proposals and automatic Event publication)
- [ ] Public, anonymous browsing of published Events

## Test credentials

> To be filled in once the seed dataset (Phase 6) is implemented. All seed
> passwords will be `VivetuTiempo2026!` (seed-only, non-production).

| Role | Email | Notes |
|---|---|---|
| Admin | _pending_ | |
| Hospital | _pending_ | active |
| Hospital | _pending_ | pending validation |
| Artist | _pending_ | active |
| Artist | _pending_ | pending validation |
| Patient | _pending_ | |

## Deployment

- **Live URL:** _pending (Phase 7)_

## TFM delivery materials

- **Slides:** _pending_
- **Video walkthrough:** _pending_

## Development notes

Full spec, design decisions (ADRs), and task breakdown for the current
change live under
`openspec/changes/bootstrap-vivetutiempo-platform/`.
