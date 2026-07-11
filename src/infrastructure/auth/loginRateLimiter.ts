import { createHash } from "node:crypto";
import type { Clock } from "@domain/shared/Clock";
import type {
  LoginAttemptKey,
  LoginRateLimiter,
} from "@application/ports/LoginRateLimiter";
import type { PrismaClientOrTx } from "../persistence/prisma/client";
import { SystemClock } from "../shared/clock";

/** Rolling window (M4/D7): 15 minutes. */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
/** Max failures allowed within the window before denial. */
export const RATE_LIMIT_MAX_FAILURES = 5;

function hashKeyPart(value: string): string {
  // `key` never stores the raw email/IP (M4) — only a one-way hash.
  return createHash("sha256").update(value).digest("hex");
}

/** One row-key per scoped identifier: `email:<hash>` and, when present, `ip:<hash>` — both checked so a single leaked/rotated IP cannot bypass the per-account limit, and vice versa. */
function scopedKeys(key: LoginAttemptKey): readonly string[] {
  const keys = [`email:${hashKeyPart(key.email)}`];
  if (key.ipHash) keys.push(`ip:${key.ipHash}`);
  return keys;
}

/**
 * Postgres-backed `LoginRateLimiter` adapter (M4, ADR D7). A single shared,
 * transactional store across every serverless instance — no in-memory
 * counter, which would be ineffective on Vercel (rejected per D7).
 * Retention policy: a window past its TTL is purged the next time it is
 * read (`isAllowed`) or on a successful login (`recordSuccess`) — expired
 * windows are never retained indefinitely.
 */
export class PrismaLoginRateLimiter implements LoginRateLimiter {
  constructor(
    private readonly client: PrismaClientOrTx,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async isAllowed(key: LoginAttemptKey): Promise<boolean> {
    const now = this.clock.now();
    for (const rowKey of scopedKeys(key)) {
      const row = await this.client.loginAttemptWindow.findUnique({
        where: { key: rowKey },
      });
      if (!row) continue;

      const expired =
        now.getTime() - row.windowStartedAt.getTime() > RATE_LIMIT_WINDOW_MS;
      if (expired) {
        // Retention/cleanup: purge a fully-lapsed window opportunistically.
        await this.client.loginAttemptWindow
          .deleteMany({ where: { key: rowKey } })
          .catch(() => undefined);
        continue;
      }

      if (row.failureCount >= RATE_LIMIT_MAX_FAILURES) {
        return false;
      }
    }
    return true;
  }

  async recordFailure(key: LoginAttemptKey): Promise<void> {
    const now = this.clock.now();
    for (const rowKey of scopedKeys(key)) {
      const existing = await this.client.loginAttemptWindow.findUnique({
        where: { key: rowKey },
      });
      const windowExpired =
        !existing ||
        now.getTime() - existing.windowStartedAt.getTime() > RATE_LIMIT_WINDOW_MS;

      if (windowExpired) {
        await this.client.loginAttemptWindow.upsert({
          where: { key: rowKey },
          create: { key: rowKey, failureCount: 1, windowStartedAt: now },
          update: { failureCount: 1, windowStartedAt: now },
        });
      } else {
        await this.client.loginAttemptWindow.update({
          where: { key: rowKey },
          data: { failureCount: { increment: 1 } },
        });
      }
    }
  }

  async recordSuccess(key: LoginAttemptKey): Promise<void> {
    for (const rowKey of scopedKeys(key)) {
      await this.client.loginAttemptWindow
        .deleteMany({ where: { key: rowKey } })
        .catch(() => undefined);
    }
  }
}
