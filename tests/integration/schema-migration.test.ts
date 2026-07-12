import { describe, expect, it } from "vitest";
import { getTestPrismaClient, isDatabaseAvailable } from "./support/db";

/**
 * Task 4.3 (B3/N2 pr2-review). ASSERTS the base migration's final state —
 * it no longer APPLIES the migration itself (pr2b-M3 fix): the Vitest
 * `globalSetup` (`./support/globalSetup.ts`) now runs `prisma migrate
 * deploy` exactly once, before any integration file loads, so this file
 * cannot silently double as the migration bootstrap for whichever other
 * file happened to run alongside/after it under the old (parallel) file
 * scheduling. This file only verifies that every table/column/index the
 * D8 schema additions require exists — including `sessions`,
 * `profiles.reviewRequestedAt`, and the `ProfileStatus` enum's
 * `DEACTIVATED` label.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("base schema migration (4.3)", () => {
  it("creates the `sessions` table with the accountId lookup index (D8)", async () => {
    const client = getTestPrismaClient();
    const columns = await client.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sessions'
    `;
    const names = columns.map((c) => c.column_name).sort();
    expect(names).toEqual(
      [
        "id",
        "accountId",
        "tokenHash",
        "absoluteExpiresAt",
        "lastActiveAt",
        "createdAt",
      ].sort(),
    );

    const indexes = await client.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'sessions'
    `;
    expect(indexes.map((i) => i.indexname)).toContain("sessions_accountId_idx");
  });

  it("adds `profiles.reviewRequestedAt` (D8)", async () => {
    const client = getTestPrismaClient();
    const columns = await client.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'reviewRequestedAt'
    `;
    expect(columns).toHaveLength(1);
  });

  it("adds `ProfileStatus.DEACTIVATED` (B3)", async () => {
    const client = getTestPrismaClient();
    const labels = await client.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ProfileStatus'
    `;
    expect(labels.map((l) => l.enumlabel)).toContain("DEACTIVATED");
  });

  it("creates the `login_attempt_windows` table (D7/M4)", async () => {
    const client = getTestPrismaClient();
    const tables = await client.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'login_attempt_windows'
    `;
    expect(tables).toHaveLength(1);
  });
});
