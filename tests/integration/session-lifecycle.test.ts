import { beforeEach, describe, expect, it } from "vitest";
import {
  createPrismaSessionPort,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from "@infrastructure/auth/session";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createHospitalProfile } from "./support/fixtures";
import { FakeClock } from "./support/fakeClock";

/**
 * Task 4.20 (M3): absolute expiry rejected, idle expiry rejected, rotation
 * issues a new id on every `create`, logout (`revokeOne`) deletes the row.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("SessionPort lifecycle (4.20, M3)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("resolves a freshly-created session as valid", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    const resolved = await sessions.resolveValid(session.id);

    expect(resolved).not.toBeNull();
    expect(resolved!.accountId).toBe(account.id);
  });

  it("rejects a session past its absolute expiry", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_ABSOLUTE_TTL_MS + 1000);

    expect(await sessions.resolveValid(session.id)).toBeNull();
  });

  it("rejects a session past its idle expiry even before absolute expiry", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_IDLE_TTL_MS + 1000);

    expect(await sessions.resolveValid(session.id)).toBeNull();
  });

  it("touch resets the idle-expiry clock", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_IDLE_TTL_MS - 1000);
    await sessions.touch(session.id);
    clock.advance(SESSION_IDLE_TTL_MS - 1000);

    // Had `touch` not reset lastActiveAt, this would already be idle-expired.
    expect(await sessions.resolveValid(session.id)).not.toBeNull();
  });

  it("issues a fresh id on every create (rotation)", async () => {
    const { account } = await createHospitalProfile(client);
    const sessions = createPrismaSessionPort(client);

    const first = await sessions.create(account.id);
    const second = await sessions.create(account.id);
    expect(first.id).not.toBe(second.id);
  });

  it("logout (revokeOne) deletes exactly the presented session", async () => {
    const { account } = await createHospitalProfile(client);
    const sessions = createPrismaSessionPort(client);

    const first = await sessions.create(account.id);
    const second = await sessions.create(account.id);

    await sessions.revokeOne(first.id);

    expect(await sessions.resolveValid(first.id)).toBeNull();
    expect(await sessions.resolveValid(second.id)).not.toBeNull();
  });
});
