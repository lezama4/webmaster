import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resetDatabase } from "./db";

/**
 * Vitest `globalSetup` for the integration project (pr2b-M3). Runs ONCE,
 * before any integration test file is loaded — this is now the ONLY place
 * that applies migrations for the integration suite; no individual test
 * file (e.g. `schema-migration.test.ts`) is relied on to bootstrap schema
 * for the files that happen to run alongside/after it.
 *
 * If the configured `DATABASE_URL` is unreachable in this environment
 * (e.g. Docker/WSL2 disabled locally), this is a NO-OP: every integration
 * suite already guards itself with `describe.skipIf(!await
 * isDatabaseAvailable())` (see `./db.ts`), so the run reports those suites
 * as SKIPPED — never a false pass and never a false failure caused by a
 * missing database.
 *
 * When the database IS reachable, a migration failure here throws and
 * fails the whole test run immediately: tests must never execute against
 * a partially- or un-migrated schema.
 */
export default async function setup(): Promise<(() => Promise<void>) | void> {
  // Local unit runs must not wait on a Docker/WSL PostgreSQL connection that
  // cannot exist in this environment. CI always sets `CI=true`; a developer
  // with a working local database can opt in explicitly.
  const integrationEnabled =
    process.env.CI === "true" || process.env.VIVETUTIEMPO_RUN_INTEGRATION === "true";
  if (!integrationEnabled) return;

  const probe = new PrismaClient();
  let reachable = true;
  try {
    await probe.$queryRaw`SELECT 1`;
  } catch {
    reachable = false;
  } finally {
    await probe.$disconnect().catch(() => undefined);
  }

  if (!reachable) return;

  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    stdio: "inherit",
    // `shell: true` (portable on POSIX and Windows): on Windows, `npx` is a
    // `.cmd` shim, and `execFileSync`/`spawnSync` with the default
    // `shell: false` performs a raw `CreateProcess` call that does NOT
    // consult `PATHEXT`, so it fails with `ENOENT` even though `npx` is on
    // `PATH` and works from an interactive shell. Node still handles arg
    // quoting correctly per-element with `shell: true`, so this is safe on
    // both platforms and is not a shell-injection concern (all args here
    // are fixed literals, never user input).
    shell: true,
  });

  // Teardown: empty the database once the whole integration run finishes.
  //
  // Every suite resets in `beforeEach`, so each test STARTS clean — but
  // nothing cleaned up at the END, so whatever the last test of the run
  // created survived. Against a shared development database (a Neon branch
  // rather than a throwaway container) that residue outlives the run: the
  // fixtures in `./fixtures.ts` create ACTIVE hospital Profiles, and an
  // ACTIVE hospital is exactly what the public directory at
  // `/encuentra-tu-momento` is supposed to list. Test rows were observed
  // rendering as real entries there.
  //
  // CI never saw this because it provisions a fresh PostgreSQL per job.
  //
  // Leaving the database empty (not reseeded) is deliberate: `npm run
  // db:seed` is the documented next step before an e2e run, and reseeding
  // from here would hide the fact that the integration run wiped the data.
  return async () => {
    const client = new PrismaClient();
    try {
      await resetDatabase(client);
    } finally {
      await client.$disconnect().catch(() => undefined);
    }
  };
}
