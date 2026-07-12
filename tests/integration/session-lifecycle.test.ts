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

  it("touch does NOT revive a session past its idle expiry, even though absolute expiry has not been reached (pr2b-M1)", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_IDLE_TTL_MS + 1000); // idle-expired, absolute still far away.

    expect(await sessions.touch(session.id)).toBe(false);
    expect(await sessions.resolveValid(session.id)).toBeNull();

    const row = await client.session.findFirst({ where: { accountId: account.id } });
    expect(row).toBeNull(); // the stale row was deleted, not merely left invalid.
  });

  it("touch does NOT revive a session past its absolute expiry", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_ABSOLUTE_TTL_MS + 1000);

    expect(await sessions.touch(session.id)).toBe(false);
    expect(await sessions.resolveValid(session.id)).toBeNull();
  });

  it("touch denies exactly at the idle-expiry boundary (equality is expired)", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_IDLE_TTL_MS); // exactly at the boundary.

    expect(await sessions.touch(session.id)).toBe(false);
  });

  it("touch denies exactly at the absolute-expiry boundary (equality is expired)", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_ABSOLUTE_TTL_MS); // exactly at the boundary.

    expect(await sessions.touch(session.id)).toBe(false);
  });

  it("touch allows just BEFORE either boundary (1ms under)", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);
    clock.advance(SESSION_IDLE_TTL_MS - 1);

    expect(await sessions.touch(session.id)).toBe(true);
  });

  it("a resolve/touch race across the idle boundary MUST NOT revive the session (pr2b-M1 — the exact gap the review flagged)", async () => {
    const { account } = await createHospitalProfile(client);
    const clock = new FakeClock();
    const sessions = createPrismaSessionPort(client, clock);

    const session = await sessions.create(account.id);

    // A caller resolves the session just BEFORE the idle threshold — valid.
    clock.advance(SESSION_IDLE_TTL_MS - 1000);
    expect(await sessions.resolveValid(session.id)).not.toBeNull();

    // ...but only calls touch AFTER the idle boundary has since passed
    // (e.g. slow downstream work between resolving and touching). The old
    // `touch` (absolute-expiry-only guard) would have reset `lastActiveAt`
    // here and silently revived an idle-expired session.
    clock.advance(2000);
    expect(await sessions.touch(session.id)).toBe(false);

    // The session must now be genuinely, unambiguously dead.
    expect(await sessions.resolveValid(session.id)).toBeNull();
    const row = await client.session.findFirst({ where: { accountId: account.id } });
    expect(row).toBeNull();
  });

  it("persists ONLY a hash of the bearer token — the raw row's own id and the stored tokenHash cannot authenticate (pr2b-N3)", async () => {
    const { account } = await createHospitalProfile(client);
    const sessions = createPrismaSessionPort(client);

    const session = await sessions.create(account.id);
    const row = await client.session.findFirstOrThrow({
      where: { accountId: account.id },
    });

    // The persisted tokenHash is NOT the bearer token the caller received —
    // a leaked row (backup, log, replica) is never a directly usable
    // session (ADR D8's rejected-alternative rationale).
    expect(row.tokenHash).not.toBe(session.id);

    // Neither the row's own database primary key NOR its stored tokenHash
    // value can be presented as a session id and resolve successfully —
    // only the original opaque bearer token can.
    expect(await sessions.resolveValid(row.id)).toBeNull();
    expect(await sessions.resolveValid(row.tokenHash)).toBeNull();
    expect(await sessions.resolveValid(session.id)).not.toBeNull();
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
