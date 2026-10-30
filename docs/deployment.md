# Vivetutiempo deployment runbook

This runbook defines the controlled deployment of the Block 1 MVP on Vercel
and managed PostgreSQL. It is a release procedure, not evidence that a
production deployment has already occurred.

**Production URL: TBD.** Record the final HTTPS URL, deployment ID, exact commit
SHA, migration output, CI run URL, and smoke/E2E evidence when deployment is
actually completed.

## 1. Release prerequisites

- The exact release commit has a green GitHub Actions run.
- A PostgreSQL 16-compatible managed database is provisioned with TLS enabled
  (for example, Neon or Supabase).
- A verified backup or point-in-time restore checkpoint exists before applying
  migrations or seed data.
- Production, Preview, and local environments use separate databases and
  independent secrets.
- The final public HTTPS origin is known before enabling authenticated
  mutations. Do not decide this after deployment: it is the canonical value
  used by the CSRF guard.

Run schema migrations and the initial seed from a controlled release terminal
or CI job, not as an implicit side effect of a Vercel build. The database user
used for the runtime should have only application privileges; use a separate,
controlled migration connection where the provider permits it.

## 2. Production environment variables

Configure these values in **Vercel -> Project -> Settings -> Environment
Variables**. They are server-side only: never prefix them with `NEXT_PUBLIC_`,
commit them, or put them in the TFM video.

| Variable | Required | Production value and purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL used by `prisma/schema.prisma`. Use the provider's TLS-required URL, for example `postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`. |
| `SESSION_SECRET` | Yes | Independent random value of at least 32 bytes. The current database-backed sessions use opaque CSPRNG tokens and store only token hashes; this variable is the fallback HMAC key for the login rate limiter, not a JWT signing key. |
| `RATE_LIMIT_HMAC_SECRET` | Yes | Independent random value of at least 32 bytes. The login rate limiter HMACs email/IP scoped keys with it. Setting it explicitly avoids relying on `SESSION_SECRET` as the fallback. Rotating it resets recognition of existing limiter rows. |
| `APP_ORIGIN` | Yes | The exact public origin, such as `https://vivetutiempo.example`. It must be scheme + host + optional port only: no path, no alternate hostname, and no confusion between `www` and non-`www`. |

`APP_ORIGIN` is security-critical. `src/infrastructure/http/csrfGuard.ts` reads
this exact variable and compares it with `Origin`, or `Referer` as a fallback,
for every unsafe request. An empty, malformed, or mismatched value fails
closed with a denial. Never derive it from an incoming `Host` header.

Scope every variable to exactly one environment. A value ticked for both
Production and Preview means unreviewed branch code runs with production
secrets. Preview gets its own database, secrets and `DEMO_MODE=true`; see
[Preview](#preview) in Section 9. Never point a Preview build at production
data.

## 3. Provision and migrate the database

From a controlled environment with `DATABASE_URL` set to the intended managed
database:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
```

`prisma migrate deploy` applies the committed migration history in order. Do
not use `prisma migrate dev` in production, modify applied migration SQL, or
manually replay partial-index statements. Capture the command output and the
applied migration names in the release record.

After a successful migration, verify that the application database contains the
Profile lifecycle schema, session and login-rate-limit tables, and the partial
unique indexes that protect accepted and submitted Proposals.

## 4. Seed the fictional demo dataset once

**Demo, Preview and local databases only. Never run this against production** (see
[Section 9](#9-production-vs-demo-environments)); the seed refuses to run unless
`DEMO_MODE=true` or `DATABASE_URL` points at `localhost`/`127.0.0.1`.

After migration of a demo database, execute:

```bash
npm run db:seed
```

The seed is idempotent and uses stable identifiers, so rerunning the same
reviewed seed updates its own fictional demo records rather than creating
duplicates. It creates seven accounts, five Slots, and two Events. It is for an
isolated TFM/demo database only; do not seed a database that contains real
hospital, artist, or patient-related data.

Verify the seed before deployment:

- seven accounts: Admin, two Hospitals, three Artists, and one Patient/Family
  account;
- S1 open with two competing Proposals;
- S2 filled with an accepted Proposal and a published Event;
- S3 open without Proposals;
- S4 closed with a cascade-rejected Proposal;
- S5 filled with an accepted Proposal and a completed Event.

The fictional credentials are generated from `prisma/seed.ts` (see [README.md](../README.md#seed-credentials)). They must exist only locally and in the Preview and demo environments; see [Section 9](#9-production-vs-demo-environments).

## 5. Deploy the application on Vercel

1. Import the GitHub repository into Vercel and select the repository root.
   Vercel detects the Next.js application.
2. Use Node.js 24.x, matching the project and CI runtime. `engines.node` in
   `package.json` overrides the Node.js version in Project Settings.
3. Configure the four production variables from Section 2 and verify that
   `APP_ORIGIN` matches the final HTTPS URL exactly.
4. Configure the production domain and DNS. If the public hostname changes,
   update `APP_ORIGIN` before enabling unsafe requests.
5. Trigger the production deployment for the commit already migrated and
   seeded. Inspect build logs for Prisma generation and environment failures.
6. Record the resulting Vercel deployment ID, URL, commit SHA, and timestamp.

A successful build does not prove authorization, CSRF, concurrency, or public
data minimization. Those require the checks below.

## 6. Post-deployment verification

Use an incognito browser for public checks and retain the results as TFM
evidence.

1. Log in as the seeded Admin. Confirm that the pending Hospital and Artist
   can be validated and that deactivation invalidates their sessions.
2. Log in as the active Hospital, publish a future Slot, and confirm it appears
   on the Hospital board.
3. Log in as an active Artist and submit a Proposal. Optionally submit a second
   Proposal for the same Slot using the other active Artist.
4. As the owning Hospital, approve one Proposal. Confirm the Slot is filled,
   the selected Proposal is accepted, any submitted rival is rejected, and the
   Event is published.
5. Without a session, browse published Events and inspect the response. It may
   contain title, description, date/time, duration, and Artist display name;
   it must not expose location, Proposal message, emails, or internal IDs.
6. Confirm logout revokes the current session and that an expired/revoked
   session cannot perform a mutation.
7. Send an unsafe cross-origin request and confirm it is rejected. Confirm a
   same-origin authenticated mutation succeeds with the configured
   `APP_ORIGIN`.

Run the deployed Playwright suite without starting a local server:

```bash
PLAYWRIGHT_BASE_URL="https://your-production-url.example" npm run test:e2e
```

Do not call the deployment complete until the command result, browser smoke
results, and CI run correspond to the same commit and URL.

## 7. CI and TFM evidence

The versioned GitHub Actions workflow provisions PostgreSQL 16, generates
Prisma Client, applies migrations, and runs lint, typecheck, and `npm run test`.
Vitest isolates the integration project, serializes its files, and applies
migrations before integration test files load. Consequently, the lock-first,
session, partial-index, and concurrency tests execute against real PostgreSQL
in CI rather than a mock.

The Playwright configuration supports a deployed target through
`PLAYWRIGHT_BASE_URL`. However, the currently versioned workflow does not yet
invoke `npm run test:e2e`. Add that explicit CI step and retain a green run
before claiming E2E-in-CI evidence in the TFM defence. This limitation is
documented deliberately to avoid overstating the evidence.

Retain:

- the protected CI run URL for the release SHA;
- migration output and provider restore-point identifier;
- the Vercel deployment URL/ID;
- seed command output without secrets;
- deployed smoke/E2E results and the public no-leak inspection;
- accepted residual risks, if any, in the threat model/readiness evidence.

## 8. Rollback and recovery

### Application rollback

1. Stop further promotion and preserve Vercel and CI logs.
2. Redeploy the last known-good Vercel deployment.
3. Re-run the public and authenticated smoke checks against the restored URL.
4. Record the affected commit, rollback deployment ID, impact, and decision.

### Database rollback

Prisma migrations are not automatically reversible. Prefer a reviewed,
forward-only corrective migration when it is safer than restoration. If a
restore is necessary:

1. Restore the managed PostgreSQL backup or point-in-time checkpoint to a new
   database instance according to the provider's documented process.
2. Validate the schema, seed state, and application against that instance.
3. Change `DATABASE_URL` only after validation, then redeploy the matching
   known-good application version.
4. Rotate database credentials and application secrets if compromise is
   suspected.

Never delete Prisma migration records or run ad-hoc destructive SQL merely to
make a deployment look reverted.

## 9. Production vs demo environments

Production must never contain fictional data, and the demo must be clearly
labelled. They are two separate deployments with separate databases. These are
**manual maintainer steps**; nothing here is executed by the repository or CI.

### Production

1. Create a **new** Neon project in an EU region (AWS Europe, Frankfurt,
   `eu-central-1`). Do not reuse a database that has ever been seeded.
2. Set the Vercel function region of the production project to an EU region
   next to the database (Frankfurt, `fra1`), under **Project -> Settings ->
   Functions**, so the app and database share a region.
3. Set the Section 2 variables in the production project, with the new
   database's `DATABASE_URL`. Do **not** set `DEMO_MODE` (it is off by default).
4. Run `npx prisma migrate deploy` against the new database (Section 3), using
   the Neon **direct** (non-`-pooler`) connection string. `prisma/schema.prisma`
   has no `directUrl`, so Prisma uses `DATABASE_URL` for both migrations and the
   app. Pooled (pgbouncer) URLs can fail on migration advisory locks, so export
   the direct URL as `DATABASE_URL` for the migration shell only. Which URL the
   Vercel runtime should use (direct or pooled) is a manual decision; **verify
   against the current Neon and Prisma docs at execution time**. Do not change
   `schema.prisma` for this without a separate review.
   **Do not run `npm run db:seed`.** The seed would create accounts with a
   published password.
5. Redeploy and run the Section 6 checks.

### Preview

Preview deployments build unreviewed branch code. They therefore get a
**separate Neon project** holding fictional data only, plus their own secrets.
They never get a branch of the production project, whose data a branch would
copy. These are manual maintainer steps.

> **Status: pending execution.** This procedure is documented but has not been
> run yet. Until it is, Preview still uses its previous database. Record the
> execution date and the deployment ID from step 5 here once it is done.

1. **Create the project.** In Neon, create a new project (for example
   `vivetutiempo-preview`). Use the **same PostgreSQL major version and the
   same region as the production project**, so migrations and query behaviour
   match. Read both values from the production project's settings; do not
   assume them. Never restore or copy production data into it.
2. **Create the role and database.** In that project, create a dedicated role
   (for example `preview_app`) and a database owned by it (for example
   `vivetutiempo_preview`).
   - While `vercel-build` still runs `prisma migrate deploy`, this role has to
     own the schema and so holds DDL rights. That is acceptable only because
     the database holds fictional data.
   - Copy the **direct** (non-`-pooler`) connection string, because
     migrations take advisory locks.
3. **Migrate and seed** from a controlled shell, in a checkout whose `.env`
   does not point at production:

   ```bash
   read -rs DATABASE_URL && export DATABASE_URL  # paste the Preview direct URL; not echoed
   export DEMO_MODE=true
   npm ci
   npx prisma migrate deploy
   npm run db:seed
   unset DATABASE_URL DEMO_MODE
   ```

   Prisma prints `Datasource "db": PostgreSQL database "<db>", schema "public"
   at "<host>"`. Check that `<host>` is the Preview project's endpoint before
   trusting the rest of the output.
4. **Set the Vercel variables.** Under **Project -> Settings -> Environment
   Variables**, scope each of these to **Preview only**:
   - `DATABASE_URL`: the Preview direct URL. If Production and Preview already
     have separate entries, edit only the Preview one.
   - `SESSION_SECRET` and `RATE_LIMIT_HMAC_SECRET`: if one entry is shared by
     Production and Preview, edit it and **untick Preview without changing
     its value**, because changing the value changes Production. Then add a
     new Preview-only entry for each, with a fresh value from
     `openssl rand -base64 48`. Rotating the Production values is a separate
     step.
   - `DEMO_MODE`: exactly `true`. Never set it on Production.
   - `APP_ORIGIN`: Preview needs a stable domain. Until it has one, every
     mutation on a preview, including login, fails closed (Section 2).
5. **Verify that the build migrates the Preview database.**
   - Redeploy one preview without the build cache.
   - In its build log, the `npm run vercel-build` step must print
     `Datasource "db": PostgreSQL database "vivetutiempo_preview", schema
     "public" at "ep-<id>...neon.tech"`. Then it prints either `No pending
     migrations to apply.` or the list of applied migrations.
   - `ep-<id>` must match the Preview project's endpoint (**Neon -> Preview
     project -> Connection details**) and must differ from the production
     endpoint.
   - Confirm that the latest production build log still shows the production
     endpoint, and that no Production variable changed. Compare **Last
     updated** in Vercel.
   - Open the preview and confirm the fictional-data banner.
   - Record the deployment ID and the endpoint ID, never a URL with
     credentials, in the release record.
6. **Retire the old copy.** Only after step 5 passes, delete any production
   branch that Preview used before, along with its data. Before deleting it,
   confirm that nothing still points at it: no Vercel variable in any
   environment, no local `.env` and no git worktree `.env`. Compare each
   `DATABASE_URL` host with that branch's endpoint, without printing the
   credentials. Settle first whether
   a data-protection assessment needs evidence of what it held. Keep any other
   copy of production, such as a dated backup branch, only under a documented
   retention period and access policy.

### Demo

1. Create a **separate** Vercel project (or a dedicated environment with its
   own variables) for the demo, with its own Neon database. Never share a
   database with production.
2. Set `DEMO_MODE=true` (exactly `true`) together with its own `DATABASE_URL`,
   `SESSION_SECRET`, `RATE_LIMIT_HMAC_SECRET` and `APP_ORIGIN`. Every page then
   shows a banner saying that centres, artists and events are fictional.
3. From a controlled shell with the demo `DATABASE_URL` and `DEMO_MODE=true`
   exported, run `npx prisma migrate deploy` and `npm run db:seed`. The seed
   guard refuses to run against a non-local database without `DEMO_MODE=true`.

### Migrating real accounts, if any exist

If real accounts were created in the current (pre-split) database, move only
those, never the seed rows:

1. Freeze writes (maintenance window), then take a backup of the old database.
2. List real accounts: treat as non-real any row whose id is prefixed `seed-`
   **or** whose email ends in `@vtt.test` (the e2e specs create such accounts
   without a `seed-` id, e.g. `centre.audit.<runId>@vtt.test`); everything else
   is a candidate real account. Review the list with the maintainer. "Move only
   real rows" does not cover rows tied to real accounts on seeded records (for
   example a real artist's proposals on a seeded slot): review those and decide
   case by case before cutting over.
3. Export the real rows with their related profile rows, in dependency order,
   using `pg_dump --data-only` with `--table` filters or `COPY (SELECT ...)`
   restricted to the real ids, and load them into the new production database
   after `migrate deploy`.
4. Verify row counts and that no `seed-` id or `@vtt.test` email exists in
   production. Real password hashes move as they are; no user needs to reset.
5. Switch DNS or `APP_ORIGIN` to the new production deployment, then retire the
   old database only after the maintainer confirms.

If there are no real accounts yet, skip the migration: provision the new
production database empty.
