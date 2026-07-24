import { PrismaClient } from "@prisma/client";

/**
 * Docker/Postgres availability guard (per task instructions: integration
 * tests MUST run against real Postgres, but MUST NOT fake a pass when the
 * database is unreachable in this environment). Every integration test
 * file calls `isDatabaseAvailable()` at module load time and wraps its
 * suite in `describe.skipIf(!available)` — a skipped suite is reported as
 * SKIPPED by the test runner, never silently reported as passing.
 */
let cachedAvailability: Promise<boolean> | undefined;

export function isDatabaseAvailable(): Promise<boolean> {
  // Match globalSetup: local default runs are unit-focused and integration is
  // opt-in, while GitHub Actions sets CI=true and always exercises Postgres.
  const integrationEnabled =
    process.env.CI === "true" || process.env.VIVETUTIEMPO_RUN_INTEGRATION === "true";
  if (!integrationEnabled) return Promise.resolve(false);

  if (!cachedAvailability) {
    cachedAvailability = (async () => {
      const client = new PrismaClient();
      try {
        await client.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      } finally {
        await client.$disconnect().catch(() => undefined);
      }
    })();
  }
  return cachedAvailability;
}

let sharedClient: PrismaClient | undefined;

/** One shared client per test process — integration tests are the only consumers of this module. */
export function getTestPrismaClient(): PrismaClient {
  if (!sharedClient) {
    sharedClient = new PrismaClient();
  }
  return sharedClient;
}

/** Deletes every row from every application table, in FK-safe order. Call in `beforeEach` so each test starts from an empty database. */
export async function resetDatabase(client: PrismaClient): Promise<void> {
  await client.event.deleteMany();
  await client.proposal.deleteMany();
  await client.slot.deleteMany();
  await client.session.deleteMany();
  await client.loginAttemptWindow.deleteMany();
  // ProfileReview FKs to Profile with ON DELETE RESTRICT (ADR D21,
  // `auditable-profile-approval`) — MUST be cleared before profile.deleteMany().
  await client.profileReview.deleteMany();
  await client.profile.deleteMany();
  await client.account.deleteMany();
}
