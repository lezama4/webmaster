import { createHmac } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
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

/**
 * pr2b-N2 fix: a bare `SHA-256(email)` is NOT a privacy boundary — email
 * addresses are low-entropy and can be recomputed from likely
 * name+domain combinations, so a leaked `login_attempt_windows` table would
 * let an attacker recover which accounts were targeted. The key is now a
 * server-keyed HMAC-SHA256 instead: without the server secret, the stored
 * `key` column cannot be dictionary-attacked back to a candidate email.
 *
 * Secret source: `RATE_LIMIT_HMAC_SECRET`, falling back to the already-
 * documented `SESSION_SECRET` (both server-only, never sent to a client).
 * A dedicated secret is preferred (separate rotation from the session-
 * cookie-signing secret's own lifecycle) but the fallback keeps this
 * demo-scale deployment from requiring a second secret to configure.
 *
 * Key rotation / retention (documented here per the review's request,
 * since this adapter — not `design.md` — owns the operational detail):
 * rotating `RATE_LIMIT_HMAC_SECRET` invalidates every existing
 * `login_attempt_windows` row's lookup key (old rows become orphaned, never
 * matched again) — treat rotation as equivalent to a full rate-limiter
 * reset, and rotate during a low-traffic window. Row retention: a row is
 * reset in place (not deleted) when its window lapses (see
 * `PrismaLoginRateLimiter.consumeOne`) and deleted outright on a successful
 * login (`recordSuccess`) — an account that is never successfully logged
 * into keeps exactly one row per scoped key indefinitely; a periodic
 * cleanup job (DELETE WHERE now() - "windowStartedAt" > retention period)
 * is the natural place to bound this further and is BACKLOG for Block 1.
 */
function hashKeyPart(value: string): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    // Fail-loud at first use (not at import time) — never silently fall
    // back to an unkeyed hash, which would reintroduce the N2 weakness.
    throw new Error(
      "RATE_LIMIT_HMAC_SECRET (or SESSION_SECRET) must be configured — " +
        "the login-rate-limiter key is a server-keyed HMAC, never a bare hash (pr2b-N2).",
    );
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** One row-key per scoped identifier: `email:<hash>` and, when present, `ip:<hash>` — both checked so a single leaked/rotated IP cannot bypass the per-account limit, and vice versa. */
function scopedKeys(key: LoginAttemptKey): readonly string[] {
  const keys = [`email:${hashKeyPart(key.email)}`];
  if (key.ipHash) keys.push(`ip:${key.ipHash}`);
  return keys;
}

interface WindowRow {
  readonly failureCount: number;
  readonly windowStartedAt: Date;
}

/** True for a root `PrismaClient` (has `$transaction`); false for an already-ambient `Prisma.TransactionClient`, which cannot open a nested transaction. */
function isRootClient(client: PrismaClientOrTx): client is PrismaClient {
  return typeof (client as PrismaClient).$transaction === "function";
}

/**
 * Postgres-backed `LoginRateLimiter` adapter (M4, ADR D7). A single shared,
 * transactional store across every serverless instance — no in-memory
 * counter, which would be ineffective on Vercel (rejected per D7).
 *
 * pr2b-B1 fix: `consumeAttempt` is ONE atomic `INSERT ... ON CONFLICT
 * ("key") DO UPDATE ... RETURNING` per scoped key — the increment-or-reset
 * decision and the write happen in the SAME statement, under Postgres's own
 * row-level serialization for the conflicting key, so no concurrent caller
 * can observe a stale count between a read and a later write. Every scoped
 * key for one attempt (email, and the client key when present) is consumed
 * inside ONE database transaction: either both keys' windows advance
 * together, or (fail-closed) an error denies the whole attempt.
 *
 * Retention: a lapsed window is reset IN PLACE (count -> 1, window ->
 * now) by the same atomic statement rather than deleted-then-reinserted —
 * a delete+reinsert pair would reintroduce exactly the two-step race this
 * fix removes. `recordSuccess` still deletes the row outright on a
 * successful login (a simple, race-free cleanup once authenticated).
 */
export class PrismaLoginRateLimiter implements LoginRateLimiter {
  constructor(
    private readonly client: PrismaClientOrTx,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async consumeAttempt(key: LoginAttemptKey): Promise<boolean> {
    const keys = scopedKeys(key);
    try {
      if (isRootClient(this.client)) {
        return await this.client.$transaction(
          (tx) => this.consumeAll(tx, keys),
          { timeout: 10_000, maxWait: 10_000 },
        );
      }
      // Already inside an ambient transaction (e.g. a caller composing this
      // adapter with another unit of work) — the surrounding transaction
      // already provides the "one transaction" guarantee.
      return await this.consumeAll(this.client, keys);
    } catch {
      // Fail-closed (D7 decision): a DB error denies the attempt rather
      // than silently letting an unbounded burst through.
      return false;
    }
  }

  private async consumeAll(
    tx: PrismaClientOrTx,
    keys: readonly string[],
  ): Promise<boolean> {
    let allowed = true;
    for (const rowKey of keys) {
      const row = await this.consumeOne(tx, rowKey);
      if (row.failureCount > RATE_LIMIT_MAX_FAILURES) {
        allowed = false;
      }
    }
    return allowed;
  }

  private async consumeOne(
    tx: PrismaClientOrTx,
    rowKey: string,
  ): Promise<WindowRow> {
    const now = this.clock.now();
    const rows = await tx.$queryRaw<WindowRow[]>(Prisma.sql`
      INSERT INTO "login_attempt_windows" ("key", "failureCount", "windowStartedAt")
      VALUES (${rowKey}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "failureCount" = CASE
          WHEN (EXTRACT(EPOCH FROM (EXCLUDED."windowStartedAt" - "login_attempt_windows"."windowStartedAt")) * 1000) > ${RATE_LIMIT_WINDOW_MS}
            THEN 1
          ELSE "login_attempt_windows"."failureCount" + 1
        END,
        "windowStartedAt" = CASE
          WHEN (EXTRACT(EPOCH FROM (EXCLUDED."windowStartedAt" - "login_attempt_windows"."windowStartedAt")) * 1000) > ${RATE_LIMIT_WINDOW_MS}
            THEN EXCLUDED."windowStartedAt"
          ELSE "login_attempt_windows"."windowStartedAt"
        END
      RETURNING "failureCount", "windowStartedAt"
    `);
    return rows[0]!;
  }

  async recordSuccess(key: LoginAttemptKey): Promise<void> {
    for (const rowKey of scopedKeys(key)) {
      await this.client.loginAttemptWindow
        .deleteMany({ where: { key: rowKey } })
        .catch(() => undefined);
    }
  }
}
