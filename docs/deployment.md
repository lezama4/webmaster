# Vivetutiempo Deployment Runbook

## Purpose and current release gate

This runbook describes the target deployment of the Block 1 Core on Vercel and
managed PostgreSQL (Neon or Supabase). It is deliberately split into commands
that are usable now and steps that become executable only after the pending HTTP,
UI, seed, and authentication integration work is completed.

**Do not expose the application publicly as an authenticated MVP yet.** The
current repository has migrations and infrastructure adapters, but no API route
handlers, cookie wiring, authenticated UI, seed script, demo credentials, or
complete E2E flow. The readiness report also records an unresolved application/
rate-limiter contract mismatch. Treat this document as a reproducible release
procedure and as the completion checklist for those prerequisites—not as evidence
that a production deployment has occurred.

## 1. Prerequisites

- Node.js **22.x** and npm. This matches the GitHub Actions runtime.
- A Vercel account and access to the target Vercel project.
- A managed PostgreSQL 16-compatible database (Neon or Supabase), in the region
  closest to the Vercel deployment.
- A GitHub repository connected to Vercel. Protect the production branch and
  require the CI workflow to pass before merge.
- Provider credentials with two scopes:
  - an application database user with only the privileges needed at runtime;
  - a migration user/connection used only by the controlled migration step.
- A production domain, for example `https://app.example.org`, selected before
  enabling authenticated mutations. CSRF must compare requests with this one
  canonical origin, never with the request `Host` header.
- A password manager or secret manager for production values. Do not put
  production URLs or secrets in `.env`, commits, screenshots, logs, or the TFM
  video.

## 2. Environment variables

### 2.1 Required server-side variables

Configure these in **Vercel → Project → Settings → Environment Variables** for
Production and Preview as appropriate. Mark every secret as server-only; do not
prefix secrets with `NEXT_PUBLIC_`.

| Variable | Required | Example shape | Use and handling |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require` | The only database variable currently read by `prisma/schema.prisma`. Use the provider connection string supported by Prisma and require TLS. Use a migration-capable connection when running `prisma migrate deploy`. |
| `SESSION_SECRET` | Yes before authentication is enabled | 32+ random bytes encoded as base64url/hex | Present in `.env.example`; it is the current fallback HMAC key for rate-limit records. Keep it stable while sessions/rate-limit data must remain valid. Rotate through a documented incident procedure. |
| `RATE_LIMIT_HMAC_SECRET` | Recommended; required if `SESSION_SECRET` is not set | independent 32+ random bytes | Preferred HMAC key for Postgres login-rate-limit keys. The adapter falls back to `SESSION_SECRET`, but a separate key isolates rotation. Rotation resets recognisability of old limiter rows; schedule it during low traffic and clean obsolete rows. |
| `CANONICAL_ORIGIN` | Required before routes are enabled | `https://app.example.org` | **Target delivery-layer contract.** The current CSRF helper accepts an origin argument but no route reads this variable yet. Route wiring must read and validate this value at startup, then pass it to every unsafe-method check, including login. |
| `NODE_ENV` | Vercel-managed | `production` | Do not override unless Vercel support requires it. |

Generate secrets locally without printing them into shell history or committing
them, for example with a password manager or a CSPRNG tool. Store the generated
value directly in Vercel; never use `change-me-in-local-env` from `.env.example`.

### 2.2 Environment separation

- **Production:** production database, production canonical origin, unique
  secrets.
- **Preview:** separate preview database/schema and unique secrets. Do not point
  previews at production data.
- **Local:** `.env` is ignored by Git. Use Docker PostgreSQL only for disposable
  local data.
- **CI:** GitHub Actions currently provides an ephemeral PostgreSQL service and
  a workflow-local `DATABASE_URL`. It must not receive production secrets.

The current Prisma schema has only `DATABASE_URL`. If the chosen provider needs
different pooled runtime and direct migration URLs, add and review explicit
Prisma support for a second variable before using it; do not assume an unused
`DIRECT_URL` will have any effect.

## 3. Local development and verification

### 3.1 Start local PostgreSQL

1. Copy `.env.example` to `.env` and replace the placeholder secret for any
   authentication/rate-limit work.
2. Start the disposable local database:

   ```bash
   docker compose up -d --wait
   ```

3. Confirm the health check:

   ```bash
   docker compose exec postgres pg_isready -U vivetutiempo -d vivetutiempo
   ```

The committed Compose file currently publishes PostgreSQL on port 5432. Use it
only on a trusted development machine; restrict it to `127.0.0.1` before use on
a shared network.

### 3.2 Prepare the database and run the application

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`. At the present repository state this only proves
the scaffold page can start; it does not prove the Block 1 user flow.

### 3.3 Seed data

There is currently **no** `prisma/seed.ts`, no `prisma.seed` package setting,
and no `db:seed` script. Do not invent demo accounts manually in production.
After Phase 6 adds an idempotent reviewed seed, document its exact command here
(normally `npx prisma db seed` or the reviewed `npm run db:seed` wrapper) and
run it once against the intended environment.

The seed must create only fictional data and the roles/flows promised in the
README: Admin, active/pending Hospital, active/pending Artist, Patient, five
coherent Slots, and two distinct Event origins. Record seed credentials in the
README only after the seed exists.

### 3.4 Run checks and tests

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
```

Do not interpret a green local `npm test` as full database evidence when Docker
or PostgreSQL is unavailable. The integration project guards itself and reports
its real-PostgreSQL suites as **skipped**, rather than passing. Those tests cover
migrations, row locks, partial indexes, session persistence, rate limiting, and
race conditions; GitHub Actions is the required execution environment when local
virtualisation is unavailable.

## 4. Safe production migration and demo-data provisioning

### 4.1 Pre-migration checklist

- The exact commit passed CI, including TypeScript, lint, unit tests, and the
  real PostgreSQL integration/race suite.
- The rate-limiter port/adapter contract and all release-blocking findings in
  `docs/tfm-readiness-report.md` are closed or formally accepted with an
  explicit non-production scope.
- A managed-PostgreSQL backup or point-in-time restore checkpoint exists and the
  restore owner/time objective is known.
- `DATABASE_URL` points to the intended database and requires TLS.
- No other migration is running. Schedule a brief maintenance window if the
  provider/database size makes index work material.

### 4.2 Apply migrations

Run from a controlled CI/release environment with the production migration
connection available as `DATABASE_URL`:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
```

`prisma migrate deploy` applies committed migrations in directory order. In this
repository that means:

1. `20260711000000_init`: base schema, enums, lifecycle fields, sessions, and
   rate-limit table;
2. `20260711000001_partial_unique_indexes`: PostgreSQL partial unique indexes
   over `proposals` for one accepted proposal per Slot and one submitted proposal
   per Artist/Slot.

Do not use `prisma migrate dev` in production. Do not manually reorder, edit, or
replay the migration SQL. Capture the command result, migration names, timestamp,
database environment, and release commit in the release record.

### 4.3 Verify migration before application traffic

- Confirm `prisma migrate deploy` completed successfully.
- Run the reviewed migration/catalog integration checks against an isolated
  non-production database first.
- Verify that the deployed schema contains `DEACTIVATED`,
  `reviewRequestedAt`, session tables/indexes, and both partial indexes.
- Only then permit the Vercel build/release to receive production traffic.

### 4.4 Seed the demonstration dataset

This step is **blocked until the seed implementation exists**. Once it does:

1. Review that it is idempotent and uses only fictional records.
2. Take/confirm the pre-seed restore point.
3. Run the documented seed command once with the production demo database URL.
4. Verify the resulting account count, role states, Slot/Proposal/Event state
   matrix, and public projection manually.
5. Store the non-production/demo credentials in the README and TFM handout, not
   in source code or browser screenshots containing real data.

## 5. Deploy on Vercel

### 5.1 Project configuration

1. Import the GitHub repository into Vercel.
2. Select the repository root as the project root; Vercel detects Next.js.
3. Configure Node.js **22.x** in the project build settings.
4. Add the production variables from Section 2.
5. Add the final custom domain and configure DNS with the provider. Set
   `CANONICAL_ORIGIN` exactly to the final HTTPS origin—no path, no trailing
   alternate hostname.
6. Keep Preview deployments on isolated databases and preview origins.

### 5.2 Build and release sequence

Use this order for every production release:

1. CI succeeds on the exact commit.
2. Apply production migrations through the controlled step in Section 4.
3. Seed only if this is the first demo release or the reviewed seed changed.
4. Trigger/approve the Vercel production deployment.
5. Inspect Vercel build logs for dependency, Prisma generation, and environment
   failures. A successful build is not an authentication, CSRF, migration, or
   concurrency guarantee.
6. Open the HTTPS URL and record the release URL, Vercel deployment ID, commit,
   and time in the release/TFM evidence log.

Do not make production migrations an unreviewed side effect of a Vercel build.
The migration must be observable, repeatable, and run with the least privilege
needed for schema changes.

## 6. GitHub Actions CI

The workflow in `.github/workflows/ci.yml` runs on `main` and `feat/**` pushes
and on pull requests. It provisions PostgreSQL 16, then performs:

1. `npm ci`;
2. Prisma client generation;
3. `npx prisma migrate deploy`;
4. lint;
5. TypeScript typecheck;
6. `npm test`.

The workflow supplies an ephemeral `DATABASE_URL` for the PostgreSQL service.
The Vitest integration project is configured serially and uses global migration
setup, so its PostgreSQL suites execute there when the workflow is green. This
is the evidence path for the lock/race tests that skip locally when Docker
Desktop/WSL2 virtualisation is disabled.

Before treating CI as a release gate, confirm the workflow run for the exact
release commit actually executed (not skipped) the integration project. Keep a
link/screenshot with the commit SHA in the TFM evidence folder.

## 7. Post-deploy smoke test and acceptance checklist

Run this only after routes, UI, cookie handling, CSRF wiring, and the seed are
implemented. Use a private/incognito browser for the public step.

1. Log in as the demo Admin; activate the pending Hospital and Artist.
2. Log in as the active Hospital; publish one future Slot.
3. Log in as an active Artist; submit a Proposal. Optionally submit a competing
   Proposal using the second Artist.
4. Log in again as the owning Hospital; approve one Proposal.
5. Verify that the Slot is filled, the chosen Proposal is accepted, competitors
   are rejected, and a published Event exists.
6. Without a session, browse the public Events page/API.
7. Inspect the public response and confirm it contains only title, description,
   scheduled time, duration, and artist display name—never location, proposal
   message, email, or internal identifiers.
8. Attempt a cross-origin unsafe request and verify CSRF rejection. Verify a
   same-origin authenticated mutation succeeds.
9. Verify logout invalidates its session; deactivate/reject a profile and verify
   all its sessions are invalidated.
10. Record results, environment, URL, release commit, test accounts used, and
    any failure/rollback decision.

Release only when every item succeeds and the CI integration suite is green for
the same commit.

## 8. Rollback and incident response

### 8.1 Application rollback

1. Stop further promotion and preserve Vercel/CI logs.
2. In Vercel, promote/redeploy the last known-good production deployment.
3. Verify the public health/smoke checks against the restored deployment.
4. Record the incident, affected release, rollback deployment ID, and user/data
   impact. Do not erase relevant security logs.

### 8.2 Database rollback

Prisma migrations are not automatically reversible. Do **not** delete migration
records or run ad-hoc destructive SQL to “undo” a release.

1. First assess whether a forward-only corrective migration is safer.
2. If data/schema restoration is necessary, use the managed provider’s tested
   point-in-time restore/backup procedure to a new database instance.
3. Validate schema/data integrity and the application against that restored
   instance before changing `DATABASE_URL`.
4. Rotate database credentials and affected application secrets if compromise is
   suspected.
5. Document the recovery point, data-loss window, verification results, and
   final production connection change.

### 8.3 Known blockers and pending evidence

- PostgreSQL concurrency/integration tests have not yet been evidenced by a
  reviewed CI run for the release commit.
- The complete race matrix and both login/deactivation orderings remain open.
- The current application rate-limiter port and Prisma adapter must be made
  compatible before deployment.
- Route handlers, CSRF enforcement, cookies, request validation, UI, seeds,
  E2E chain, live URL, and final smoke evidence are still pending.
- Aggregate validation, Profile/Proposal bounds, clock validation, timestamp
  defensiveness, limiter retention, and operational logging/retention policies
  remain open in the readiness tracker.

## 9. Test credentials for README and TFM delivery

There are no credentials today because the seed has not been implemented. Once
the reviewed seed exists, add a table to `README.md` and the delivery notes with
only fictional credentials:

| Role | Email | Password | Expected state |
| --- | --- | --- | --- |
| Admin | Seed-defined | Seed-defined | Can validate/deactivate profiles |
| Hospital A | Seed-defined | Seed-defined | Active; owns demo Slots |
| Hospital B | Seed-defined | Seed-defined | Pending or non-owning negative case |
| Artist A | Seed-defined | Seed-defined | Active; primary Proposal |
| Artist B | Seed-defined | Seed-defined | Active; competing Proposal |
| Patient | Seed-defined | Seed-defined | Block 1 public browsing/demo role |

The current README proposes `VivetuTiempo2026!` as a **seed-only,
non-production** password. Confirm the final seed policy before publishing it.
Never reuse these credentials outside the isolated TFM demo environment.

## Evidence to retain for the defence

- Exact release commit and protected CI run URL.
- Migration output and provider restore-point identifier.
- Vercel deployment URL/ID and production domain.
- Seed command/output (without secrets) and demo-account table.
- Post-deploy smoke/E2E output, including the public no-leak inspection.
- Updated threat model and readiness tracker, with any accepted residual risks.
