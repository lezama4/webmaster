export interface Deferred<T = void> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

/** A promise whose resolution the test controls externally — the building block for barrier-based interleaving tests (tasks 4.10-4.17, 4.22). */
export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Tables whose lock-first adapters are exercised by the integration race suite. */
export type LockWaitTable = "slots" | "accounts";

/**
 * Waits for observable PostgreSQL evidence that a second transaction is
 * blocked on the lock-first `SELECT ... FOR UPDATE` for `table`. This is not
 * a timing delay: the first transaction MUST NOT be released until this query
 * observes `wait_event_type = 'Lock'` in `pg_stat_activity` for the second
 * operation. The deadline merely fails a broken test rather than hanging CI.
 */
export async function waitForPostgresLockWait(
  client: PrismaClient,
  table: LockWaitTable,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const queryFragment = table === "slots" ? 'FROM "slots"' : 'FROM "accounts"';

  while (Date.now() < deadline) {
    const rows = await client.$queryRaw<{ readonly waiting: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'active'
          AND wait_event_type = 'Lock'
          AND query LIKE ${`%${queryFragment}%FOR UPDATE%`}
      ) AS "waiting"
    `;
    if (rows[0]?.waiting) return;

    // Yield after each real database observation without using a fixed sleep.
    await Promise.resolve();
  }

  throw new Error(
    `Timed out waiting for a blocked SELECT ... FOR UPDATE on '${table}'. ` +
      "The race was not established, so the test must not release its first transaction.",
  );
}
import type { PrismaClient } from "@prisma/client";
