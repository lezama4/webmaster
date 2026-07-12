import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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
export default async function setup(): Promise<void> {
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
  });
}
