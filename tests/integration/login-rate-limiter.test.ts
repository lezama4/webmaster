import { beforeEach, describe, expect, it } from "vitest";
import {
  PrismaLoginRateLimiter,
  RATE_LIMIT_MAX_FAILURES,
  RATE_LIMIT_WINDOW_MS,
} from "@infrastructure/auth/loginRateLimiter";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { FakeClock } from "./support/fakeClock";

/**
 * Task 4.26 (M4 pr2-review): attempts within the window count correctly,
 * the window resets after it lapses, and `recordSuccess` resets the
 * window. `consumeAttempt` replaces the old `isAllowed`+`recordFailure`
 * split (pr2b-B1 fix, below) — it is the SAME atomic call that both
 * increments-or-resets the window and returns whether the limit was
 * crossed.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("PrismaLoginRateLimiter (4.26, M4)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("allows attempts up to and including the failure threshold", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      expect(await limiter.consumeAttempt(key)).toBe(true);
    }
  });

  it("denies once the failure threshold is exceeded within the window", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.consumeAttempt(key);
    }
    expect(await limiter.consumeAttempt(key)).toBe(false);
  });

  it("resets the window once it has lapsed", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.consumeAttempt(key);
    }
    expect(await limiter.consumeAttempt(key)).toBe(false);

    clock.advance(RATE_LIMIT_WINDOW_MS + 1000);
    expect(await limiter.consumeAttempt(key)).toBe(true); // reset -> count 1.
  });

  it("recordSuccess resets the rolling window for the key", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.consumeAttempt(key);
    }
    await limiter.recordSuccess(key);
    expect(await limiter.consumeAttempt(key)).toBe(true);

    const rows = await client.loginAttemptWindow.findMany();
    expect(rows).toHaveLength(1); // the successful attempt's own consume.
    expect(rows[0]!.failureCount).toBe(1);
  });

  it("tracks the per-account and per-client keys independently", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const emailOnly = { email: "hospital@vtt.test" };
    const emailPlusIp = { email: "hospital@vtt.test", ipHash: "hashed-ip-1" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.consumeAttempt(emailPlusIp);
    }
    // Same email, no IP this time — still denied because the email-scoped
    // window (recorded alongside the IP-scoped one) is also over threshold.
    expect(await limiter.consumeAttempt(emailOnly)).toBe(false);

    // A different account from the SAME (now-blocked) IP is independent
    // per-account, but the per-IP window still denies it.
    const differentAccountSameIp = { email: "other@vtt.test", ipHash: "hashed-ip-1" };
    expect(await limiter.consumeAttempt(differentAccountSameIp)).toBe(false);
  });

  /**
   * pr2b-B1 (BLOCKER): fires MORE than `RATE_LIMIT_MAX_FAILURES` concurrent
   * attempts for a FRESH key via `Promise.all` — genuine concurrent I/O
   * against real Postgres, no artificial delay needed, since each
   * `consumeAttempt` call is its own round trip. The old `isAllowed`-read +
   * `recordFailure`-write split could lose increments under exactly this
   * concurrency (the `findUnique`-then-`upsert` race). The fix's single
   * atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` is
   * serialized by Postgres's own row-level locking on the conflicting key,
   * so every concurrent call increments exactly once — no lost updates —
   * and the number of calls that see a count still within the limit is
   * exactly bounded.
   */
  it("atomically serializes a concurrent burst — no lost updates, exact permitted count (pr2b-B1)", async () => {
    const limiter = new PrismaLoginRateLimiter(client);
    const key = { email: "burst@vtt.test" };
    const burstSize = RATE_LIMIT_MAX_FAILURES + 7; // > MAX, fired together.

    const results = await Promise.all(
      Array.from({ length: burstSize }, () => limiter.consumeAttempt(key)),
    );

    const permitted = results.filter(Boolean).length;
    const denied = results.length - permitted;
    expect(permitted).toBe(RATE_LIMIT_MAX_FAILURES);
    expect(denied).toBe(burstSize - RATE_LIMIT_MAX_FAILURES);

    // Exact final count — proves no increment was lost to the race.
    const rows = await client.loginAttemptWindow.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.failureCount).toBe(burstSize);
  });

  it("fail-closed: email AND client-key windows advance together in one transaction", async () => {
    const limiter = new PrismaLoginRateLimiter(client);
    const key = { email: "hospital@vtt.test", ipHash: "hashed-ip-1" };
    const burstSize = RATE_LIMIT_MAX_FAILURES + 4;

    await Promise.all(
      Array.from({ length: burstSize }, () => limiter.consumeAttempt(key)),
    );

    const rows = await client.loginAttemptWindow.findMany();
    // Two scoped keys (email + ip) — both advanced by every attempt.
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.failureCount).toBe(burstSize);
    }
  });
});
