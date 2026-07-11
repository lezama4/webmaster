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
 * the window resets after it lapses, expired windows are cleaned up, and
 * the response shape (`isAllowed`) is identical whether the account is
 * unknown or simply locked out — that generic-response guarantee is the
 * `login` use case's job (already covered at the application layer); this
 * test proves the counter/window mechanics the adapter is responsible for.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("PrismaLoginRateLimiter (4.26, M4)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("allows attempts under the failure threshold", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES - 1; i += 1) {
      expect(await limiter.isAllowed(key)).toBe(true);
      await limiter.recordFailure(key);
    }
    expect(await limiter.isAllowed(key)).toBe(true);
  });

  it("denies once the failure threshold is reached within the window", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.recordFailure(key);
    }
    expect(await limiter.isAllowed(key)).toBe(false);
  });

  it("resets the window once it has lapsed", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.recordFailure(key);
    }
    expect(await limiter.isAllowed(key)).toBe(false);

    clock.advance(RATE_LIMIT_WINDOW_MS + 1000);
    expect(await limiter.isAllowed(key)).toBe(true);
  });

  it("cleans up an expired window row instead of retaining it indefinitely", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    await limiter.recordFailure(key);
    clock.advance(RATE_LIMIT_WINDOW_MS + 1000);
    await limiter.isAllowed(key); // opportunistic cleanup on read.

    const rows = await client.loginAttemptWindow.findMany();
    expect(rows).toHaveLength(0);
  });

  it("recordSuccess resets the rolling window for the key", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const key = { email: "hospital@vtt.test" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.recordFailure(key);
    }
    await limiter.recordSuccess(key);
    expect(await limiter.isAllowed(key)).toBe(true);

    const rows = await client.loginAttemptWindow.findMany();
    expect(rows).toHaveLength(0);
  });

  it("tracks the per-account and per-client keys independently", async () => {
    const clock = new FakeClock();
    const limiter = new PrismaLoginRateLimiter(client, clock);
    const emailOnly = { email: "hospital@vtt.test" };
    const emailPlusIp = { email: "hospital@vtt.test", ipHash: "hashed-ip-1" };

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i += 1) {
      await limiter.recordFailure(emailPlusIp);
    }
    // Same email, no IP this time — still denied because the email-scoped
    // window (recorded alongside the IP-scoped one) is also over threshold.
    expect(await limiter.isAllowed(emailOnly)).toBe(false);

    // A different account from the SAME (now-blocked) IP is independent
    // per-account, but the per-IP window still denies it.
    const differentAccountSameIp = { email: "other@vtt.test", ipHash: "hashed-ip-1" };
    expect(await limiter.isAllowed(differentAccountSameIp)).toBe(false);
  });
});
